// preload.js

console.log('--- PRELOAD SCRIPT LOADED ---');

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  applyHarden: (script, password) => ipcRenderer.invoke('apply-harden', script, password),
  // MODIFIED: Pass the second argument to the main process
  checkStatus: (script, reg_option) => ipcRenderer.invoke('check-status', script, reg_option),
  revertHardening: (script, password) => ipcRenderer.invoke('revert-hardening', script, password),
  // --- ADD THIS LINE ---
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
});