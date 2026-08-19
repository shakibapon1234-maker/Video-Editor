const { app, BrowserWindow, session, dialog, ipcMain, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

try {
    app.setAppUserModelId('com.shakib.videoeditor');
} catch (_) {}

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

    process.env.SF_DATA_DIR = app.getPath('userData');

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

    app.whenReady().then(() => {
        session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
            callback(permission === 'media');
        });

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
                const message = error.code === 'EADDRINUSE'
                    ? 'Another copy of Studio Flow (or something else) is already using port 4000. Close it and try again.'
                    : String(error && error.stack || error);
                dialog.showErrorBox(error.code === 'EADDRINUSE' ? 'Studio Flow is already running' : 'Studio Flow server error', message);
                app.quit();
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
