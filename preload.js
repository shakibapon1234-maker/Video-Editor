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
    },
    // Screen Recorder — lists all recordable screens and windows
    getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
    // Screen Recorder — set chosen source ID so getDisplayMedia captures it
    setSelectedScreenSource: (sourceId) => ipcRenderer.invoke('set-selected-screen-source', sourceId),
    // Screen Recorder — opens a Save dialog and writes the recorded WebM to disk
    saveScreenRecording: (arrayBuffer, suggestedName) =>
        ipcRenderer.invoke('save-screen-recording', arrayBuffer, suggestedName),
});

