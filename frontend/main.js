// frontend/main.js

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec: execCallback } = require('child_process');
const fs = require('fs');
const os = require('os');
const util = require('util');

const exec = util.promisify(execCallback);

const isDev = !app.isPackaged;
const lgpoPath = path.join(__dirname, 'LGPO.exe');

// Correctly resolve the absolute path to the backend's media directory.
const mediaRoot = path.resolve(__dirname, '..', 'backend', 'media');

// Define the absolute path to WMIC for robust execution (Retained but no longer used in getSystemInfo, 
// kept here for reference if needed elsewhere)
const wmicPath = 'C:\\Windows\\System32\\wbem\\wmic.exe';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../build/index.html')}`
  );

  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

// --- System Info Logic ---
async function getSystemInfo() {
  try {
    // FIX: Switch to PowerShell to fetch the serial number for better reliability across different Windows environments.
    const command = 'powershell.exe -Command "Get-CimInstance -ClassName Win32_Bios | Select-Object -ExpandProperty SerialNumber"';
    const { stdout } = await exec(command);
    
    // PowerShell output often includes trailing whitespace/newlines
    const serialNumber = stdout.trim();
    
    if (!serialNumber) {
         throw new Error("PowerShell command returned an empty serial number.");
    }

    return { success: true, serialNumber };
  } catch (error) {
    console.error('Failed to get system serial number:', error);
    return { success: false, message: `Failed to get serial number: ${error.message}` };
  }
}

// --- Generic Script Runner ---
async function runScript(script) {
  if (!script || script.trim() === '') {
    return { success: false, message: 'Script is empty.' };
  }
  try {
    const { stdout, stderr } = await exec(script);
    if (stderr) {
      // For commands like `reg query`, stderr might be used for "not found" messages which are not errors in our audit case.
      // We will consider any stderr as a potential failure for simplicity here.
      throw new Error(stderr);
    }
    return { success: true, message: stdout || 'Script executed successfully.' };
  } catch (error) {
    // error.message often includes stderr, so we can just use that.
    return { success: false, message: `Script failed: ${error.message}` };
  }
}


// --- USER RIGHTS POLICY LOGIC ---
const sidMap = {
  'Administrators': '*S-1-5-32-544',
  'Remote Desktop Users': '*S-1-5-32-555',
  'LOCAL SERVICE': '*S-1-5-19',
  'NETWORK SERVICE': '*S-1-5-20',
  'SERVICE': '*S-1-5-6',
  'NT VIRTUAL MACHINE\\Virtual Machines': '*S-1-5-83-0',
  'Virtual Machines': '*S-1-5-83-0',
};

function parseValueDataToSids(valueData) {
  if (!valueData || valueData.trim() === '') return '';
  const names = valueData.split('&&').map(name => name.replace(/"/g, '').trim());
  const sids = names.map(name => sidMap[name]).filter(Boolean);
  return sids.join(',');
}

async function applyUserRightPolicy(privilege, valueData) {
  const tempDir = os.tmpdir();
  const infPath = path.join(tempDir, `policy-${privilege}.inf`);
  const sdbPath = path.join(tempDir, `policy-${privilege}.sdb`);
  const logPath = path.join(tempDir, `secedit-${privilege}.log`);
  const sids = parseValueDataToSids(valueData);

  const cleanupFiles = async () => {
    for (const file of [infPath, sdbPath, logPath]) {
      try {
        if (fs.existsSync(file)) await fs.promises.unlink(file);
      } catch (e) { console.error(`Failed to delete temp file ${file}:`, e); }
    }
  };

  try {
    const infContent = [
      '[Unicode]', 'Unicode=yes', '[Version]', 'signature="$CHICAGO$"', 'Revision=1',
      '[Privilege Rights]', `${privilege} = ${sids}`,
    ].join('\r\n');
    await fs.promises.writeFile(infPath, infContent, 'utf16le');
    await exec(`secedit /import /db "${sdbPath}" /cfg "${infPath}" /log "${logPath}"`);
    await exec(`secedit /configure /db "${sdbPath}" /log "${logPath}"`);
    await exec('gpupdate /force');
    return { success: true, message: `Policy for '${privilege}' was applied successfully.` };
  } catch (error) {
    let logContent = 'No log file available.';
    try {
      if (fs.existsSync(logPath)) {
        logContent = await fs.promises.readFile(logPath, 'utf-8');
      }
    } catch (logError) { logContent = `Could not read log file: ${logError.message}`; }
    const errorMessage = `Failed to apply policy. Log: [${logContent.trim()}] Error: ${error.stderr || error.message}`;
    return { success: false, message: errorMessage };
  } finally {
    await cleanupFiles();
  }
}

// --- AUDIT POLICY LOGIC using LGPO.exe ---
async function applyAuditPolicy(subcategory, valueData) {
  const tempDir = os.tmpdir();
  const policyFilePath = path.join(tempDir, `auditpolicy-${Date.now()}.txt`);
  let auditValue = 0;
  const values = valueData.toLowerCase();
  if (values.includes('success') && values.includes('failure')) {
    auditValue = 3;
  } else if (values.includes('success')) {
    auditValue = 1;
  } else if (values.includes('failure')) {
    auditValue = 2;
  }
  const policyContent = [
    '[System Access]',
    'MACHINE\\System\\CurrentControlSet\\Control\\Lsa\\SCENoApplyLegacyAuditPolicy = 4,1',
    '',
    '[Advanced Audit Policy]',
    `${subcategory} = ${auditValue}`,
  ].join('\r\n');
  try {
    if (!fs.existsSync(lgpoPath)) {
      throw new Error(`LGPO.exe not found at ${lgpoPath}. Please place it in the 'public' directory.`);
    }
    await exec(`"${lgpoPath}" /t "${policyFilePath}"`);
    await exec('gpupdate /force');
    return { success: true, message: `Audit policy for "${subcategory}" was set successfully and is visible in the GUI.` };
  } catch (error) {
    return { success: false, message: `Failed to apply audit policy. Error: ${error.stderr || error.message}` };
  } finally {
    if (fs.existsSync(policyFilePath)) {
      await fs.promises.unlink(policyFilePath);
    }
  }
}

// --- Helper for Secedit-based policies ---
async function applySeceditSystemAccessPolicy(settingName, value, friendlyName) {
    const tempDir = os.tmpdir();
    const infPath = path.join(tempDir, `policy-${settingName}.inf`);
    const sdbPath = path.join(tempDir, `policy-${settingName}.sdb`);
    const logPath = path.join(tempDir, `secedit-${settingName}.log`);

    const cleanupFiles = async () => {
        for (const file of [infPath, sdbPath, logPath]) {
            try {
                if (fs.existsSync(file)) await fs.promises.unlink(file);
            } catch (e) { console.error(`Failed to delete temp file ${file}:`, e); }
        }
    };

    try {
        const infContent = [
            '[Unicode]', 'Unicode=yes', '[Version]', 'signature="$CHICAGO$"', 'Revision=1',
            '[System Access]', `${settingName} = ${value}`,
        ].join('\r\n');
        await fs.promises.writeFile(infPath, infContent, 'utf16le');
        await exec(`secedit /import /db "${sdbPath}" /cfg "${infPath}" /log "${logPath}"`);
        await exec(`secedit /configure /db "${sdbPath}" /log "${logPath}"`);
        await exec('gpupdate /force');
        return { success: true, message: `${friendlyName} was set successfully.` };
    } catch (error) {
        let logContent = 'No log file available.';
        try {
            if (fs.existsSync(logPath)) {
                logContent = await fs.promises.readFile(logPath, 'utf-8');
            }
        } catch (logError) { logContent = `Could not read log file: ${logError.message}`; }
        const errorMessage = `Failed to apply policy ${friendlyName}. Log: [${logContent.trim()}] Error: ${error.stderr || error.message}`;
        return { success: false, message: errorMessage };
    } finally {
        await cleanupFiles();
    }
}

// --- UNIFIED AND FIXED: PASSWORD & LOCKOUT POLICY LOGIC ---
async function applyAccountPolicy(policyName, value) {
    // A unified map of all account policies to their corresponding 'secedit' setting names and value transformations.
    const policySettingMap = {
        // --- Password Policies ---
        'COMPLEXITY_REQUIREMENTS': {
            setting: 'PasswordComplexity',
            transform: val => String(val).toLowerCase() === 'enabled' ? '1' : '0',
            friendlyName: 'Password complexity policy'
        },
        'REVERSIBLE_ENCRYPTION': {
            setting: 'ClearTextPassword',
            transform: val => String(val).toLowerCase() === 'enabled' ? '1' : '0',
            friendlyName: 'Reversible encryption policy'
        },
        'ENFORCE_PASSWORD_HISTORY': {
            setting: 'PasswordHistorySize',
            transform: val => String(val), // Use value directly
            friendlyName: 'Enforce password history'
        },
        'MAXIMUM_PASSWORD_AGE': {
            setting: 'MaximumPasswordAge',
            transform: val => String(val), // Use value directly
            friendlyName: 'Maximum password age'
        },
        'MINIMUM_PASSWORD_AGE': {
            setting: 'MinimumPasswordAge',
            transform: val => String(val), // Use value directly
            friendlyName: 'Minimum password age'
        },
        'MINIMUM_PASSWORD_LENGTH': {
            setting: 'MinimumPasswordLength',
            transform: val => String(val), // Use value directly
            friendlyName: 'Minimum password length'
        },
        // --- Lockout Policies ---
        'LOCKOUT_ADMINS': {
            setting: 'EnableAdminAccountLockout',
            transform: val => String(val).toLowerCase() === 'enabled' ? '1' : '0',
            friendlyName: 'Administrator account lockout policy'
        },
        'LOCKOUT_DURATION': {
            setting: 'AccountLockoutDuration',
            transform: val => String(val), // Use value directly
            friendlyName: 'Lockout duration'
        },
        'LOCKOUT_THRESHOLD': {
            setting: 'AccountLockoutThreshold',
            transform: val => String(val), // Use value directly
            friendlyName: 'Lockout threshold'
        },
        'LOCKOUT_RESET': {
            setting: 'ResetLockoutCount',
            transform: val => String(val), // Use value directly
            friendlyName: 'Reset lockout counter after'
        },
    };

    const config = policySettingMap[policyName];

    // Check if the policy is supported by this unified handler
    if (config) {
        const seceditValue = config.transform(value);
        // All policies in the map will be applied using the secedit helper function
        return applySeceditSystemAccessPolicy(config.setting, seceditValue, config.friendlyName);
    }

    // If the policy name is not found in our map, it's unsupported.
    return { success: false, message: `Policy '${policyName}' is not supported.` };
}


// --- CHECK ACCOUNT POLICY LOGIC ---
async function applyCheckAccountPolicy(policy, newValue) {
    const { account_type, value_data, value_type, check_type } = policy;
    let command, successMessage;
    switch (account_type) {
        case 'GUEST_ACCOUNT':
            if (value_data === 'Disabled') {
                command = 'net user Guest /active:no';
                successMessage = "Guest account has been disabled.";
            } else if (value_type === 'POLICY_TEXT' && check_type === 'CHECK_NOT_EQUAL') {
                if (!newValue || newValue.trim() === '') return { success: false, message: 'A new name for the Guest account is required.'};
                // FIX: Use absolute path for WMIC
                command = `"${wmicPath}" useraccount where name='Guest' rename "${newValue.trim()}"`;
                successMessage = `Guest account renamed to "${newValue.trim()}".`;
            }
            break;
        case 'ADMINISTRATOR_ACCOUNT':
             if (value_type === 'POLICY_TEXT' && check_type === 'CHECK_NOT_REGEX') {
                if (!newValue || newValue.trim() === '') return { success: false, message: 'A new name for the Administrator account is required.'};
                // FIX: Use absolute path for WMIC
                command = `"${wmicPath}" useraccount where name='Administrator' rename "${newValue.trim()}"`;
                successMessage = `Administrator account renamed to "${newValue.trim()}".`;
            }
            break;
        default:
            return { success: false, message: `Unsupported account type: ${account_type}` };
    }
    if (!command) {
        return { success: false, message: `No action defined for policy: ${policy.description}` };
    }
    // FIX: Execute commands via cmd.exe for robustness (removed the nested cmd.exe /c since we are providing the absolute path to WMIC)
    try {
        await exec(command);
        return { success: true, message: successMessage };
    } catch (error) {
        return { success: false, message: `Failed to apply account check policy. Error: ${error.stderr || error.message}` };
    }
}

// --- POWERSHELL POLICY LOGIC ---
async function applyPowershellPolicy(script) {
    if (!script || script.trim() === '') {
        return { success: false, message: 'PowerShell script is empty.' };
    }
    // This command is already running via powershell.exe so it should be fine.
    const command = `powershell.exe -ExecutionPolicy Bypass -Command "& {${script}}"`; 
    try {
        const { stdout, stderr } = await exec(command);
        if (stderr) {
            console.warn(`PowerShell stderr (may not be an error): ${stderr}`);
        }
        const resultMessage = stdout || 'Script executed without output.';
        // The success check here seems specific to your audit script output
        const success = resultMessage.includes('STATUS: PASSED');
        return { success, message: resultMessage };
    } catch (error) {
        return { success: false, message: `PowerShell execution failed. Error: ${error.stderr || error.message}` };
    }
}

// --- REGISTRY-BASED POLICY LOGIC ---
async function applyRegistrySettingPolicy(policy, newValue) {
    const { reg_key, reg_item, value_type, reg_include_hku_users, value_data } = policy;

    if (!reg_key || !reg_item) {
        return { success: false, message: 'Policy is missing registry key or item information.' };
    }

    const finalValue = newValue !== undefined && newValue !== null ? newValue : value_data;
    
    const regTypeMap = {
        'POLICY_DWORD': 'REG_DWORD',
        'POLICY_TEXT': 'REG_SZ',
        'POLICY_MULTI_TEXT': 'REG_MULTI_SZ',
    };
    const regType = regTypeMap[value_type];
    if (!regType) {
        return { success: false, message: `Unsupported value_type: ${value_type}` };
    }
    
    let formattedValue = finalValue;
    if (regType === 'REG_MULTI_SZ') {
        formattedValue = finalValue.split('\n').filter(Boolean).join('\\0');
    }
    
    // Prefix reg command with cmd.exe /c for robustness
    const buildCommand = (key) => `cmd.exe /c reg add "${key}" /v "${reg_item}" /t ${regType} /d "${formattedValue}" /f`;

    try {
        if (reg_include_hku_users && reg_key.startsWith("HKU\\")) {
            // FIX: Execute reg query via cmd.exe
            const { stdout } = await exec('cmd.exe /c reg query HKU');
            const lines = stdout.split('\r\n').map(l => l.trim()).filter(Boolean);
            // This logic to find user SIDs seems fragile, but we keep it for policy execution logic compatibility
            const userSids = lines.filter(l => l.startsWith('S-1-5-21-') && !l.endsWith('-500') && !l.endsWith('-501'));

            if (userSids.length === 0) {
                return { success: false, message: 'No user profiles found to apply HKU setting to.' };
            }

            for (const sid of userSids) {
                const userRegKey = reg_key.replace("HKU\\", `${sid}\\`);
                const command = buildCommand(userRegKey);
                console.log(`Executing for user SID: ${command}`);
                await exec(command);
            }
            // After applying to all HKU users, apply to HKCU for the current user's immediate effect
            const commandHKCU = buildCommand(reg_key.replace("HKU\\", "HKCU\\"));
            await exec(commandHKCU);
            
            return { success: true, message: `Policy applied to ${userSids.length} user profile(s) and current user (HKCU).` };
        } else {
            const command = buildCommand(reg_key);
            console.log(`Executing: ${command}`);
            await exec(command);
            await exec('cmd.exe /c gpupdate /force'); // FIX: Execute gpupdate via cmd.exe
            return { success: true, message: `Registry policy for '${reg_item}' was set successfully.` };
        }
    } catch (error) {
        return { success: false, message: `Failed to apply registry policy. Error: ${error.stderr || error.message}` };
    }
}

async function applySecurityOptionPolicy(policy) {
   // This is specifically for the ANONYMOUS_SID_SETTING which is a REG_DWORD
   return applyRegistrySettingPolicy(policy, policy.value_data === 'Disabled' ? '1' : '0');
}

async function applyBannerPolicy(policy, newValue) {
    // BANNER_CHECK is a REG_SZ setting
    return applyRegistrySettingPolicy(policy, newValue);
}

// --- IPC HANDLERS ---
async function findAllJsonFiles(dir) {
  // ... (unchanged)
  const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      return findAllJsonFiles(res);
    } else if (res.toLowerCase().endsWith('.json')) {
      return res;
    }
    return [];
  }));
  return Array.prototype.concat(...files);
}

ipcMain.handle('get-policy-files', async (event, dirPath) => {
  try {
    const fullPath = path.join(mediaRoot, dirPath); // Construct the full path
    const jsonFilePaths = await findAllJsonFiles(fullPath);
    // Filter out metadata.json and script.json
    const filteredPaths = jsonFilePaths.filter(filePath => {
        const filename = path.basename(filePath).toLowerCase();
        return filename !== 'metadata.json' && filename !== 'script.json';
    });

    const policies = await Promise.all(filteredPaths.map(async (filePath) => {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    }));

    const getPolicyDescription = (policy) => {
      if (policy.description) return policy.description;
      if (policy.check_type === 'CONDITIONAL') {
        return policy.then?.report?.description || '';
      }
      return '';
    };

    policies.sort((a, b) => {
      const descA = getPolicyDescription(a);
      const descB = getPolicyDescription(b);
      const numA = parseFloat(descA);
      const numB = parseFloat(descB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return descA.localeCompare(descB);
    });
    
    return { success: true, data: policies };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-policy-counts', async (event, basePath) => {
  try {
    const fullPath = path.join(mediaRoot, basePath); // Construct the full path
    const jsonFilePaths = await findAllJsonFiles(fullPath);
    // Filter out metadata.json and script.json for consistency
    const jsonFiles = jsonFilePaths.filter(file => {
        const filename = path.basename(file).toLowerCase();
        return filename !== 'metadata.json' && filename !== 'script.json';
    });

    const counts = {};
    await Promise.all(jsonFiles.map(async (filePath) => {
      try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const policy = JSON.parse(content);
        let policyType = policy.type;
        if (!policyType && policy.check_type === 'CONDITIONAL') {
           policyType = policy.condition?.rules?.[0]?.type;
        }
        if (policyType) {
           counts[policyType] = (counts[policyType] || 0) + 1;
        }
      } catch (e) {
        console.warn(`Could not parse or process file ${filePath}: ${e.message}`);
      }
    }));
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    return { success: true, data: { counts, total } };
  } catch (error) {
    console.error('Failed to get policy counts:', error);
    return { success: false, message: error.message };
  }
});

// Register all handlers
ipcMain.handle('get-system-info', getSystemInfo);
ipcMain.handle('run-script', async (event, { script }) => runScript(script));
ipcMain.handle('set-user-right', async (event, { privilege, value_data }) => applyUserRightPolicy(privilege, value_data));
ipcMain.handle('set-audit-policy', async (event, { subcategory, value_data }) => applyAuditPolicy(subcategory, value_data));
ipcMain.handle('set-account-policy', async (event, { policyName, value }) => applyAccountPolicy(policyName, value));
ipcMain.handle('set-check-account', async (event, { policy, newValue }) => applyCheckAccountPolicy(policy, newValue));
ipcMain.handle('set-powershell-policy', async (event, { script }) => applyPowershellPolicy(script));
ipcMain.handle('set-security-option', async (event, { policy }) => applySecurityOptionPolicy(policy));
ipcMain.handle('set-banner-policy', async (event, { policy, newValue }) => applyBannerPolicy(policy, newValue));
ipcMain.handle('set-registry-setting', async (event, { policy, newValue }) => applyRegistrySettingPolicy(policy, newValue));

// --- APP LIFECYCLE ---
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
