// src/electron-api.d.ts

// Interface for the Electron API exposed on the window object
export interface ElectronApi {
  // MODIFICATION: Added the optional password parameter
  applyHarden: (script: string, password?: string) => Promise<string>;
  
  // MODIFICATION: Add the optional reg_option parameter
  checkStatus: (script: string, reg_option?: string) => Promise<string>;

  // MODIFICATION: Added the optional password parameter
  revertHardening: (script: string, password?: string) => Promise<string>;

  getSystemInfo: () => Promise<{ serialNumber: string; username: string }>;
}

// Extend the global Window interface
declare global {
  interface Window {
    electron: ElectronApi;
  }
}