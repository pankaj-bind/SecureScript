// src/electron-api.d.ts

// Interface for the Electron API exposed on the window object
export interface ElectronApi {
  applyHarden: (script: string) => Promise<string>;
  // MODIFIED: Add the optional reg_option parameter
  checkStatus: (script: string, reg_option?: string) => Promise<string>;
  revertHardening: (script: string) => Promise<string>;
  getSystemInfo: () => Promise<{ serialNumber: string; username: string }>;
}

// Extend the global Window interface
declare global {
  interface Window {
    electron: ElectronApi;
  }
}