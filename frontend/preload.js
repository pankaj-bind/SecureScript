// preload.js

console.log('--- PRELOAD SCRIPT LOADED ---');

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  applyHarden: (script) => ipcRenderer.invoke('apply-harden', script),
  // MODIFIED: Pass the second argument to the main process
  checkStatus: (script, reg_option) => ipcRenderer.invoke('check-status', script, reg_option),
  revertHardening: (script) => ipcRenderer.invoke('revert-hardening', script),
  // --- ADD THIS LINE ---
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
});