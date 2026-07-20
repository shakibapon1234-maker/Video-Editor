const { app, BrowserWindow, session, dialog } = require('electron');

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
        mainWindow = new BrowserWindow({
            width: 1400,
            height: 900,
            minWidth: 1000,
            minHeight: 650,
            title: 'Studio Flow - Video Editor',
            autoHideMenuBar: true,
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false
            }
        });

        mainWindow.loadURL('http://localhost:4000');
        mainWindow.on('closed', () => {
            mainWindow = null;
        });
    }

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
