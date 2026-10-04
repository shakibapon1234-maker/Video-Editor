const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
    getAlwaysOnTop: () => ipcRenderer.invoke('get-always-on-top'),
    setAlwaysOnTop: (flag) => ipcRenderer.invoke('set-always-on-top', flag),
    copyImageToClipboard: (dataUrl) => ipcRenderer.invoke('copy-image-to-clipboard', dataUrl),
    saveFastJoinVideo: (downloadUrl, filename) => ipcRenderer.invoke('save-fast-join-video', downloadUrl, filename),
    onFastJoinSaveProgress: (callback) => {
        const listener = (_event, progress) => callback(progress);
        ipcRenderer.on('fast-join-save-progress', listener);
        return () => ipcRenderer.removeListener('fast-join-save-progress', listener);
    },
    getPathForFile: (file) => {
        try {
            if (webUtils && typeof webUtils.getPathForFile === 'function') {
                return webUtils.getPathForFile(file) || '';
            }
        } catch (_) {}
        return (file && file.path) ? file.path : '';
    }
});
