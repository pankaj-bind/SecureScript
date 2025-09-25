// main.js

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { exec } = require('child_process');
const os = require('os');

// Helper function to execute shell commands
const executeScript = (script, options = {}) => {
  const { password } = options;
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'powershell.exe' : '/bin/sh';

    let command = script;
    // If a password is provided on a non-Windows OS, use sudo.
    if (password && !isWindows) {
      const escapedScript = script.replace(/'/g, "'\\''");
      command = `echo '${password}' | sudo -S -p '' sh -c '${escapedScript}'`;
    }

    exec(command, { shell }, (error, stdout, stderr) => {
      if (error) {
        // Handle incorrect password error specifically
        if (stderr.toLowerCase().includes('incorrect password')) {
          return reject('sudo: incorrect password');
        }
        return reject(stderr || error.message);
      }
      resolve(stdout);
    });
  });
};

const getSerialNumber = () => {
  return new Promise((resolve, reject) => {
    const platform = process.platform;
    let command;

    if (platform === 'win32') {
      command = 'Get-CimInstance -ClassName Win32_BIOS | Select-Object SerialNumber';
    } else if (platform === 'darwin') {
      command = "system_profiler SPHardwareDataType | awk '/Serial/ {print $4}'";
    } else if (platform === 'linux') {
      command = 'cat /sys/class/dmi/id/product_serial';
    } else {
      return resolve('N/A');
    }

    const shell = platform === 'win32' ? 'powershell.exe' : '/bin/sh';
    exec(command, { shell }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Serial Number Error: ${stderr || error.message}`);
        return resolve('Unavailable');
      }

      if (platform === 'win32') {
         const lines = stdout.trim().split(/\r?\n/);
          // The actual serial number is on the 3rd line (index 2)
          const serial = lines.length > 2 ? lines[2].trim() : 'Unavailable';
          resolve(serial);
      } else {
          const serial = stdout.replace(/\n/g, '').trim();
          resolve(serial || 'Unavailable');
      }
    });
  });
};


// Handle IPC messages from the renderer
ipcMain.handle('apply-harden', async (event, script, password) => executeScript(script, { password }));
// MODIFIED: Pass reg_option from IPC to executeScript
ipcMain.handle('check-status', async (event, script, reg_option) => executeScript(script, reg_option));
ipcMain.handle('revert-hardening', async (event, script, password) => executeScript(script, { password }));
// --- ADD THIS NEW HANDLER ---
ipcMain.handle('get-system-info', async () => {
  return {
    serialNumber: await getSerialNumber(),
    username: os.userInfo().username,
  };
});


function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../build/index.html')}`
  );

  if (isDev) {
   win.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});