const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use the ipcRenderer.
// These functions now pass the selected policy object to the main process.
contextBridge.exposeInMainWorld('electronAPI', {
    applyHardening: (policy) => ipcRenderer.invoke('apply-hardening', policy),
    revertHardening: (policy) => ipcRenderer.invoke('revert-hardening', policy),
    checkStatus: (policy) => ipcRenderer.invoke('check-status', policy)
});
