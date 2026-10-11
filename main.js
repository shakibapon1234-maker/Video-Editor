const { app, BrowserWindow, session, dialog, ipcMain, clipboard, nativeImage, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { pipeline } = require('stream/promises');

// Electron keeps IndexedDB/localStorage under userData (normally on C: on
// Windows). When that drive fills up, autosaves silently fail and the
// renderer has nothing to restore after refresh. Keep the existing profile
// where it is while it has room; otherwise move a complete copy to a drive
// with space before Chromium's default session is created.
function configureUserDataStorage() {
    const currentPath = app.getPath('userData');
    const currentRoot = path.parse(currentPath).root;
    const markerName = '.studio-flow-userdata-ready';
    const roots = process.platform === 'win32'
        ? Array.from({ length: 26 }, (_, index) => `${String.fromCharCode(65 + index)}:\\`)
        : [path.parse(currentPath).root];
    const volumes = roots.map((root) => {
        try {
            const stats = fs.statfsSync(root);
            return { root, free: Number(stats.bavail) * Number(stats.bsize) };
        } catch (_) { return null; }
    }).filter(Boolean);

    // Reuse a previously migrated profile first, so each launch stays on the
    // same drive even if free-space rankings change.
    const existingProfile = volumes
        .map(({ root }) => path.join(root, 'StudioFlowData', 'userData'))
        .find((candidate) => candidate !== currentPath && fs.existsSync(path.join(candidate, markerName)));
    if (existingProfile) {
        app.setPath('userData', existingProfile);
        return existingProfile;
    }

    const currentVolume = volumes.find(({ root }) => root.toLowerCase() === currentRoot.toLowerCase());
    if (currentVolume && currentVolume.free >= 3 * 1024 ** 3) return currentPath;

    const destinationVolume = volumes
        .filter(({ root, free }) => root.toLowerCase() !== currentRoot.toLowerCase() && free >= 1024 ** 3)
        .sort((a, b) => b.free - a.free)[0];
    if (!destinationVolume) return currentPath;

    const destination = path.join(destinationVolume.root, 'StudioFlowData', 'userData');
    try {
        fs.mkdirSync(destination, { recursive: true });
        if (fs.existsSync(currentPath)) {
            fs.cpSync(currentPath, destination, {
                recursive: true,
                force: false,
                errorOnExist: false,
                filter: (source) => path.resolve(source) !== path.resolve(destination)
            });
        }
        fs.writeFileSync(path.join(destination, markerName), 'profile copy completed');
        app.setPath('userData', destination);
        console.warn(`Studio Flow user data is using ${destination} because ${currentRoot} is low on disk space.`);
        return destination;
    } catch (error) {
        console.error('Could not move Studio Flow storage to a drive with free space:', error);
        return currentPath;
    }
}

try {
    app.setAppUserModelId('com.shakib.videoeditor');
} catch (_) {}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
} else {
    let mainWindow = null;

    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    process.env.SF_DATA_DIR = configureUserDataStorage();

    function createWindow() {
        const iconPath = path.join(__dirname, 'icon.png');
        mainWindow = new BrowserWindow({
            icon: fs.existsSync(iconPath) ? iconPath : undefined,
            width: 1400,
            height: 900,
            minWidth: 1000,
            minHeight: 650,
            title: 'Studio Flow - Video Editor',
            autoHideMenuBar: true,
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                backgroundThrottling: false, // Prevents render slowdown when window is minimized or in background
                preload: path.join(__dirname, 'preload.js')
            }
        });

        mainWindow.loadURL('http://localhost:4000');
        mainWindow.webContents.on('render-process-gone', (event, details) => {
            console.error('Renderer process gone:', details);
        });
        mainWindow.on('closed', () => {
            mainWindow = null;
        });
    }

    ipcMain.handle('toggle-always-on-top', () => {
        if (mainWindow) {
            const newState = !mainWindow.isAlwaysOnTop();
            mainWindow.setAlwaysOnTop(newState);
            return newState;
        }
        return false;
    });

    ipcMain.handle('get-always-on-top', () => {
        return mainWindow ? mainWindow.isAlwaysOnTop() : false;
    });

    ipcMain.handle('set-always-on-top', (event, flag) => {
        if (mainWindow) {
            mainWindow.setAlwaysOnTop(!!flag);
            return mainWindow.isAlwaysOnTop();
        }
        return false;
    });

    // Chromium's web clipboard permission can reject image copying from a
    // localhost Electron page. Use Electron's native clipboard instead.
    ipcMain.handle('copy-image-to-clipboard', (event, dataUrl) => {
        try {
            if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png')) return false;
            const image = nativeImage.createFromDataURL(dataUrl);
            if (image.isEmpty()) return false;
            clipboard.writeImage(image);
            return !clipboard.readImage().isEmpty();
        } catch (error) {
            console.error('Native image clipboard copy failed:', error);
            return false;
        }
    });

    // --- Screen Recorder: tracking chosen source for getDisplayMedia ---
    let pendingCapturerSourceId = null;

    ipcMain.handle('set-selected-screen-source', (event, sourceId) => {
        pendingCapturerSourceId = sourceId;
        return true;
    });

    // --- Screen Recorder: list all capturable sources (screens + windows) ---
    // The renderer cannot call desktopCapturer.getSources() directly in Electron
    // 13+ without a privileged main-process bridge. We return a plain array of
    // { id, name, thumbnailDataUrl } objects that the renderer can display in a
    // picker UI.
    ipcMain.handle('get-screen-sources', async () => {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['window', 'screen'],
                thumbnailSize: { width: 320, height: 180 }
            });
            return sources.map(s => ({
                id: s.id,
                name: s.name,
                thumbnailDataUrl: s.thumbnail.toDataURL()
            }));
        } catch (err) {
            console.error('desktopCapturer.getSources error:', err);
            return [];
        }
    });

    // --- Screen Recorder: save the recorded video blob to disk ---
    // The renderer sends the recorded video as a Uint8Array buffer after
    // MediaRecorder finishes. We open a native Save-As dialog and write it
    // to the chosen path so the user can import it directly into the editor.
    ipcMain.handle('save-screen-recording', async (event, arrayBuffer, suggestedName) => {
        const safeName = path.basename(String(suggestedName || 'screen-recording.webm'))
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
        const choice = await dialog.showSaveDialog(mainWindow, {
            title: 'Save Screen Recording',
            defaultPath: path.join(app.getPath('videos'), safeName),
            filters: [
                { name: 'WebM Video', extensions: ['webm'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        if (choice.canceled || !choice.filePath) return { canceled: true };
        try {
            await fs.promises.writeFile(choice.filePath, Buffer.from(arrayBuffer));
            return { canceled: false, filePath: choice.filePath };
        } catch (writeErr) {
            throw new Error(`Could not save recording: ${writeErr.message}`);
        }
    });

    // Download a completed fast-join result straight to the path selected by
    // the user. Streaming keeps large 30–40 minute videos out of renderer RAM.
    ipcMain.handle('save-fast-join-video', async (event, downloadUrl, filename) => {
        if (typeof downloadUrl !== 'string' || !/^\/api\/fast-join\/fastjoin_[a-zA-Z0-9_-]+\/download$/.test(downloadUrl)) {
            throw new Error('Invalid fast-join download request.');
        }
        const cleanName = path.basename(String(filename || 'joined-video.mp4')).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
        const extension = path.extname(cleanName).replace('.', '').toLowerCase() || 'mp4';
        const choice = await dialog.showSaveDialog(mainWindow, {
            title: 'Save joined video',
            defaultPath: path.join(app.getPath('videos'), cleanName || 'joined-video.mp4'),
            filters: [{ name: 'Video', extensions: [extension] }, { name: 'All Files', extensions: ['*'] }]
        });
        if (choice.canceled || !choice.filePath) return { canceled: true };

        await new Promise((resolve, reject) => {
            const request = http.get(`http://127.0.0.1:4000${downloadUrl}`, (response) => {
                if (response.statusCode !== 200) {
                    response.resume();
                    reject(new Error(`Download failed (HTTP ${response.statusCode}).`));
                    return;
                }
                const total = Number(response.headers['content-length']) || 0;
                let received = 0;
                response.on('data', (chunk) => {
                    received += chunk.length;
                    event.sender.send('fast-join-save-progress', { loaded: received, total, percent: total ? Math.round(received / total * 100) : 0 });
                });
                pipeline(response, fs.createWriteStream(choice.filePath))
                    .then(resolve)
                    .catch(async (error) => {
                        await fs.promises.unlink(choice.filePath).catch(() => {});
                        reject(error);
                    });
            });
            request.on('error', reject);
        });
        return { canceled: false, filePath: choice.filePath };
    });

    app.whenReady().then(() => {
        session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
            return permission === 'media' || permission === 'display-capture';
        });

        session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
            callback(permission === 'media' || permission === 'display-capture');
        });

        session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
            try {
                const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
                let chosen = null;
                if (pendingCapturerSourceId) {
                    chosen = sources.find(s => s.id === pendingCapturerSourceId);
                }
                if (!chosen && sources.length > 0) {
                    chosen = sources[0];
                }
                if (!chosen) {
                    callback({});
                    return;
                }
                callback({ video: chosen, audio: 'loopback' });
            } catch (err) {
                console.error('setDisplayMediaRequestHandler error:', err);
                callback({});
            }
        });

        if (process.platform === 'win32') {
            try {
                require('child_process').execSync(
                    'powershell -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue; if ($c) { $c | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 200 }"',
                    { stdio: 'ignore', timeout: 3000 }
                );
            } catch (_) {}
        }

        let serverModule;
        try {
            serverModule = require('./server.js');
        } catch (error) {
            dialog.showErrorBox('Studio Flow failed to start', String(error && error.stack || error));
            app.quit();
            return;
        }

        const { server } = serverModule;
        if (server.listening) {
            createWindow();
        } else {
            server.once('listening', createWindow);
            server.once('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    http.get('http://127.0.0.1:4000', () => {
                        createWindow();
                    }).on('error', () => {
                        dialog.showErrorBox('Studio Flow is already running', 'Another copy of Studio Flow (or another app) is already using port 4000. Close it and try again.');
                        app.quit();
                    });
                } else {
                    dialog.showErrorBox('Studio Flow server error', String(error && error.stack || error));
                    app.quit();
                }
            });
        }
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
}
