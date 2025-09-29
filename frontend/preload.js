// frontend/preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // NEW
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  runScript: (data) => ipcRenderer.invoke('run-script', data),
  
  // Existing
  getPolicyFiles: (dirPath) => ipcRenderer.invoke('get-policy-files', dirPath),
  getPolicyCounts: (basePath) => ipcRenderer.invoke('get-policy-counts', basePath),
  setUserRight: (policy) => ipcRenderer.invoke('set-user-right', policy),
  setAuditPolicy: (policy) => ipcRenderer.invoke('set-audit-policy', policy),
  setAccountPolicy: (policy) => ipcRenderer.invoke('set-account-policy', policy),
  setCheckAccount: (data) => ipcRenderer.invoke('set-check-account', data),
  setPowershellPolicy: (data) => ipcRenderer.invoke('set-powershell-policy', data),
  setSecurityOption: (data) => ipcRenderer.invoke('set-security-option', data),
  setBannerPolicy: (data) => ipcRenderer.invoke('set-banner-policy', data),
  setRegistrySetting: (data) => ipcRenderer.invoke('set-registry-setting', data),
});