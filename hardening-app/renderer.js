// --- DOM Element References ---
const folderUpload = document.getElementById('folder-upload');
const policyList = document.getElementById('policy-list');
const searchBox = document.getElementById('search-box');
const noPoliciesMsg = document.getElementById('no-policies');
const policyCounter = document.getElementById('policy-counter');
const outputSection = document.getElementById('output-section');
const policyInfoDiv = document.getElementById('policy-info');

// Action buttons and status message
const applyBtn = document.getElementById('applyBtn');
const checkBtn = document.getElementById('checkBtn');
const revertBtn = document.getElementById('revertBtn');
const statusMessage = document.getElementById('status-message');

// Script display elements
const hardenScriptTextarea = document.getElementById('harden-script');
const checkScriptTextarea = document.getElementById('check-script');
const revertScriptTextarea = document.getElementById('revert-script');

// --- Data Store ---
let policyDataStore = [];
let currentPolicy = null;

// --- Event Listeners ---
folderUpload.addEventListener('change', handleFolderSelect);
policyList.addEventListener('click', handlePolicySelect);
searchBox.addEventListener('input', handleSearch);

applyBtn.addEventListener('click', async () => {
    if (!currentPolicy) return;
    showStatus('Applying...', 'pending');
    const result = await window.electronAPI.applyHardening(currentPolicy);
    showStatus(result.message, result.success ? 'success' : 'error');
});

checkBtn.addEventListener('click', async () => {
    if (!currentPolicy) return;
    showStatus('Checking...', 'pending');
    const result = await window.electronAPI.checkStatus(currentPolicy);
    showStatus(result.message, result.success ? 'success' : 'error');
});

revertBtn.addEventListener('click', async () => {
    if (!currentPolicy) return;
    showStatus('Reverting...', 'pending');
    const result = await window.electronAPI.revertHardening(currentPolicy);
    showStatus(result.message, result.success ? 'success' : 'error');
});

// Event delegation for copy buttons
outputSection.addEventListener('click', (event) => {
    const button = event.target.closest('.copy-btn');
    if (!button) return;

    const targetId = button.dataset.target;
    const textToCopy = document.getElementById(targetId).value; // Use .value for textarea
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.disabled = true;
        setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
});


/**
 * A natural sort comparator for version-like strings.
 */
function naturalSort(a, b) {
    const regex = /^(\d+(\.\d+)*)/;
    const aMatch = a.description.match(regex);
    const bMatch = b.description.match(regex);

    if (!aMatch || !bMatch) {
        return a.description.localeCompare(b.description);
    }

    const aParts = aMatch[0].split('.').map(Number);
    const bParts = bMatch[0].split('.').map(Number);
    const maxLength = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < maxLength; i++) {
        const aVal = aParts[i] || 0;
        const bVal = bParts[i] || 0;
        if (aVal < bVal) return -1;
        if (aVal > bVal) return 1;
    }

    return aParts.length - bParts.length;
}

/**
 * Handles folder selection, reads, sorts, and parses all JSON files.
 */
async function handleFolderSelect(event) {
    const files = event.target.files;
    if (!files.length) return;

    policyDataStore = [];
    policyList.innerHTML = '';
    noPoliciesMsg.textContent = 'Processing files...';
    policyCounter.textContent = '';

    const filePromises = Array.from(files)
        .filter(file => file.name.endsWith('.json'))
        .map(file => readFile(file));

    let results = await Promise.all(filePromises);
    policyDataStore = results.filter(Boolean); 

    policyDataStore.sort(naturalSort);

    renderPolicyList();
    
    // Automatically select and display the first policy
    if (policyDataStore.length > 0) {
        const firstItem = policyList.querySelector('li');
        if (firstItem) {
            firstItem.click();
        }
    } else {
        outputSection.classList.add('hidden');
    }

    event.target.value = '';
}

/**
 * Reads a single file and returns a parsed JSON object or null.
 */
function readFile(file) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const json = JSON.parse(reader.result);
                if ((json.type === 'REGISTRY_SETTING' || json.type === 'REG_CHECK') && json.description) {
                    resolve(json);
                } else {
                    resolve(null);
                }
            } catch (e) {
                console.error(`Could not parse ${file.name}:`, e);
                resolve(null);
            }
        };
        reader.onerror = () => {
            console.error(`Could not read ${file.name}`);
            resolve(null);
        };
        reader.readAsText(file);
    });
}

/**
 * Renders the list of policies in the left pane.
 */
function renderPolicyList() {
    policyList.innerHTML = '';
    if (policyDataStore.length === 0) {
        noPoliciesMsg.textContent = 'No valid policy files found.';
        noPoliciesMsg.classList.remove('hidden');
    } else {
         noPoliciesMsg.classList.add('hidden');
        policyDataStore.forEach((policy, index) => {
            const listItem = document.createElement('li');
            listItem.dataset.index = index;
            listItem.innerHTML = `<p>${policy.description}</p>`;
            policyList.appendChild(listItem);
        });
    }
    updatePolicyCount();
}

/**
 * Updates the policy counter based on total and visible items.
 */
function updatePolicyCount() {
    const totalItems = policyDataStore.length;
    if (totalItems === 0) {
        policyCounter.textContent = '';
        return;
    }
    const visibleItems = Array.from(policyList.getElementsByTagName('li')).filter(item => item.style.display !== 'none').length;
    policyCounter.textContent = `Showing ${visibleItems} of ${totalItems} policies.`;
}

/**
 * Handles clicks on the policy list to display details.
 */
function handlePolicySelect(event) {
    const listItem = event.target.closest('li');
    if (!listItem) return;

    const currentlyActive = policyList.querySelector('.active');
    if (currentlyActive) currentlyActive.classList.remove('active');
    listItem.classList.add('active');

    const policyIndex = parseInt(listItem.dataset.index, 10);
    currentPolicy = policyDataStore[policyIndex];
    displayPolicyDetails(currentPolicy);
}

/**
 * Filters the policy list based on search input.
 */
function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    Array.from(policyList.getElementsByTagName('li')).forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(searchTerm) ? '' : 'none';
    });
    updatePolicyCount();
}

/**
 * Displays the details of a selected policy in the right pane.
 */
function displayPolicyDetails(data) {
    outputSection.classList.remove('hidden');
    statusMessage.classList.add('hidden');

    applyBtn.disabled = false;
    checkBtn.disabled = false;
    revertBtn.disabled = false;

    if (data.type === 'REG_CHECK' && data.reg_option === 'MUST_NOT_EXIST') {
        policyInfoDiv.innerHTML = `
            <p><strong>Description:</strong> ${data.description || 'N/A'}</p>
            <p><strong>Details:</strong> ${data.info ? data.info.replace(/\\n/g, '<br>') : 'N/A'}</p>
            <p><strong>Check Type:</strong> <code class="revert">Registry Key Must Not Exist</code></p>
            <p><strong>Registry Key to Remove:</strong> <code>${data.value_data}</code></p>
        `;
        revertBtn.disabled = true;
    } else {
        const { description, info, Impact, reg_key, reg_item, value_data, value_type } = data;
        policyInfoDiv.innerHTML = `
            <p><strong>Description:</strong> ${description || 'N/A'}</p>
            <p><strong>Details:</strong> ${info ? info.replace(/\\n/g, '<br>') : 'N/A'}</p>
            <p><strong>Impact:</strong> ${Impact || 'N/A'}</p>
            <p><strong>Registry Key:</strong> <code>${reg_key}</code></p>
            <p><strong>Registry Item:</strong> <code>${reg_item}</code></p>
            <p><strong>Value to Set:</strong> <code>${value_data} (${value_type})</code></p>
        `;
    }
    
    generateAndDisplayScripts(data);
}

/**
 * Generates and displays the PowerShell scripts for the policy.
 */
function generateAndDisplayScripts(data) {
    const { reg_key, reg_item, value_type, value_data, reg_option } = data;

    if (reg_option === 'MUST_NOT_EXIST') {
        const keyToDelete = data.value_data;
        hardenScriptTextarea.value = `reg delete "${keyToDelete}" /f`;
        checkScriptTextarea.value = `reg query "${keyToDelete}"\n\n# This check PASSES if it returns an error (key not found).`;
        revertScriptTextarea.value = `# There is no automatic revert script for this policy.\n# This policy requires a registry key to be absent.`;
        return;
    }
    
    let regType;
    switch (value_type) {
        case 'POLICY_DWORD':
            regType = 'REG_DWORD';
            break;
        case 'POLICY_TEXT':
            regType = 'REG_SZ';
            break;
        default:
            regType = 'REG_SZ';
    }

    hardenScriptTextarea.value = `reg add "${reg_key}" /v "${reg_item}" /t ${regType} /d "${value_data}" /f`;
    checkScriptTextarea.value = `reg query "${reg_key}" /v "${reg_item}"`;
    revertScriptTextarea.value = `reg delete "${reg_key}" /v "${reg_item}" /f`;
}


/**
 * Displays a status message to the user.
 */
function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = 'status-message'; // Reset classes
    statusMessage.classList.add(type);
    statusMessage.classList.remove('hidden');
}
