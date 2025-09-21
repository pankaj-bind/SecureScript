require('electron-reload')(__dirname, {
  electron: require(`${__dirname}/node_modules/electron`)
});

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
// Correctly import and configure the regedit module
const regeditCore = require('regedit');
const regedit = regeditCore.promisified;

// Set the path for vbs scripts used by the regedit module.
// This is important for when the app is packaged.
regeditCore.setExternalVBSLocation(path.join(__dirname, 'resources/regedit/vbs'));

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            // The preload script is essential for secure communication
            preload: path.join(__dirname, 'preload.js')
        }
    });

    win.loadFile('index.html');
    // Optional: Uncomment to open DevTools on start
    // win.webContents.openDevTools();
};

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// --- IPC Handlers for Registry Operations ---

/**
 * Applies a hardening setting based on the provided policy.
 */
ipcMain.handle('apply-hardening', async (event, policy) => {
    try {
        const { reg_key, reg_item, value_type, value_data } = policy;
        if (!reg_key || !reg_item) {
            return { success: false, message: 'Invalid policy data for applying.' };
        }

        // Handle policies where the action is to delete a key
        if (policy.type === 'REG_CHECK' && policy.reg_option === 'MUST_NOT_EXIST') {
             await regedit.deleteKey(policy.value_data);
             return { success: true, message: `Key ${policy.value_data} successfully deleted.` };
        }

        let regType = 'REG_SZ';
        if (value_type === 'POLICY_DWORD') {
            regType = 'REG_DWORD';
        }

        const valueToSet = {
            [reg_key]: {
                [reg_item]: {
                    value: regType === 'REG_DWORD' ? parseInt(value_data, 10) : value_data,
                    type: regType
                }
            }
        };

        await regedit.createKey(reg_key);
        await regedit.putValue(valueToSet);
        
        return { success: true, message: 'Hardening applied successfully!' };
    } catch (error) {
        console.error('Failed to apply hardening:', error);
        return { success: false, message: `Error: ${error.message}. Try running as Administrator.` };
    }
});

/**
 * Reverts a hardening setting by deleting the registry value.
 */
ipcMain.handle('revert-hardening', async (event, policy) => {
    try {
        const { reg_key, reg_item } = policy;
        if (!reg_key || !reg_item) {
            return { success: false, message: 'Invalid policy data for reverting.' };
        }
        
        const valuePath = `${reg_key}\\${reg_item}`;
        await regedit.deleteValue(valuePath);

        return { success: true, message: 'Hardening reverted successfully!' };
    } catch (error) {
        if (error.message.includes('find the key')) {
             return { success: true, message: 'Reverted (value was not set).' };
        }
        console.error('Failed to revert hardening:', error);
        return { success: false, message: `Error: ${error.message}. Try running as Administrator.` };
    }
});

/**
 * Checks the current status of a policy's registry setting.
 */
ipcMain.handle('check-status', async (event, policy) => {
    try {
        const { reg_key, reg_item, value_data, reg_option } = policy;

        // Handle policies that require a key to NOT exist
        if (reg_option === 'MUST_NOT_EXIST') {
            const keyToCheck = policy.value_data;
            const keys = await regedit.list(keyToCheck);
            if (keys[keyToCheck] && keys[keyToCheck].exists) {
                return { success: false, status: 'Not Compliant', message: `Key '${keyToCheck}' exists but should be absent.` };
            } else {
                return { success: true, status: 'Compliant', message: `Key '${keyToCheck}' does not exist, as required.` };
            }
        }
        
        if (!reg_key || !reg_item) {
            return { success: false, status: 'Error', message: 'Invalid policy data for checking.' };
        }

        const result = await regedit.list(reg_key);
        
        if (!result[reg_key] || !result[reg_key].exists) {
            return { success: false, status: 'Key Not Found', message: `Registry key ${reg_key} not found.` };
        }

        const keyValues = result[reg_key].values;
        if (!keyValues[reg_item]) {
            return { success: false, status: 'Value Not Found', message: `Item '${reg_item}' not found in key.` };
        }

        const currentValue = keyValues[reg_item].value;
        const expectedValue = policy.value_type === 'POLICY_DWORD' ? parseInt(value_data, 10) : value_data;

        if (currentValue == expectedValue) {
            return { success: true, status: 'Compliant', message: `Status: Compliant. Current value is '${currentValue}'.` };
        } else {
            return { success: false, status: 'Not Compliant', message: `Status: Not Compliant. Current value is '${currentValue}', expected '${expectedValue}'.` };
        }
    } catch (error) {
        console.error('Failed to check status:', error);
        // A common "error" is the key not existing, which can be a valid state.
        if (error.message.includes('find the key')) {
             return { success: false, status: 'Key Not Found', message: `Registry key ${policy.reg_key} not found.` };
        }
        return { success: false, status: 'Error', message: `Error: ${error.message}.` };
    }
});

