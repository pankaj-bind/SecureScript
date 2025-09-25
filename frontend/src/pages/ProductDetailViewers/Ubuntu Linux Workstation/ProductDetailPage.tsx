// src/pages/ProductDetailViewers/Ubuntu Linux Workstation/ProductDetailPage.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProductDetails, ProductDetails, createTemplate, updateProductScripts } from '../../../services/authService';
import axios from 'axios';

// --- Type Interfaces ---
interface AuditFile {
    name: string;
    url: string;
}

interface Policy {
    description: string;
    info?: string;
    solution?: string;
    cmd?: string;
    Impact?: string;
    [key: string]: any; // Allow other properties
}

interface PolicyDetailViewProps {
    policy: Policy | null;
    customScripts: Record<string, any> | null;
    onSave: (policyId: string, scripts: { hardeningScript: string; auditScript: string; revertHardeningScript: string; }) => Promise<void>;
}

// --- NEW COMPONENT: Password Prompt Modal ---
interface PasswordPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (password: string) => void;
}

const PasswordPromptModal: React.FC<PasswordPromptModalProps> = ({ isOpen, onClose, onSubmit }) => {
    const [password, setPassword] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password) {
            onSubmit(password);
            setPassword(''); // Clear password after submit
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Admin Privileges Required</h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    This action requires sudo permissions. Please enter your administrator password to continue.
                </p>
                <form onSubmit={handleSubmit}>
                    <div className="mt-4">
                        <label htmlFor="admin-password" className="sr-only">Password</label>
                        <input
                            id="admin-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Sudo Password"
                            autoFocus
                        />
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                            disabled={!password}
                        >
                            Execute
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// --- Helper Components (PolicyDetailView is MODIFIED) ---
const PolicyDetailView: React.FC<PolicyDetailViewProps> = ({ policy, customScripts, onSave }) => {
    const [hardenScript, setHardenScript] = useState('');
    const [checkScript, setCheckScript] = useState('');
    const [revertScript, setRevertScript] = useState('');
    const [executionResult, setExecutionResult] = useState<string | null>(null);
    const [executionError, setExecutionError] = useState<string | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // --- State for the password modal ---
    const [isPromptOpen, setIsPromptOpen] = useState(false);
    const [actionToExecute, setActionToExecute] = useState<'apply' | 'revert' | null>(null);


    useEffect(() => {
        if (policy) {
            setExecutionResult(null);
            setExecutionError(null);
            
            const policyIdMatch = policy.description.match(/^(\d+(\.\d+)*)/);
            const policyId = policyIdMatch ? policyIdMatch[0] : policy.description;

            // Check for pre-saved custom scripts first
            if (policyId && customScripts && customScripts[policyId]) {
                const scripts = customScripts[policyId];
                setHardenScript(scripts.hardeningScript || '# No custom hardening script provided.');
                setCheckScript(scripts.auditScript || '# No custom audit script provided.');
                setRevertScript(scripts.revertHardeningScript || '# No custom revert script provided.');
                return;
            }

            // --- Linux Script Generation Logic ---
            let generatedHarden = `# Remediation for: ${policy.description}`;
            let generatedCheck = policy.cmd || `# No audit command found for: ${policy.description}`;
            let generatedRevert = `# Revert script for: ${policy.description}`;

            // Logic for kernel module disabling policies
            const moduleMatch = policy.description.match(/Ensure (\w+) kernel module is not available/);
            if (moduleMatch) {
                const moduleName = moduleMatch[1];
                generatedHarden = `#!/bin/sh\n# Disables the '${moduleName}' kernel module.\n\n# Blacklist the module to prevent loading\n(echo "install ${moduleName} /bin/false" >> /etc/modprobe.d/${moduleName}.conf)\n(echo "blacklist ${moduleName}" >> /etc/modprobe.d/${moduleName}.conf)\n\n# Unload the module if it is currently loaded\nrmmod ${moduleName}`;
                generatedCheck = `#!/bin/sh\n# Checks if '${moduleName}' is disabled.\n\nlsmod | grep "${moduleName}" || echo "Module not loaded"\n! grep -P -- '^(install|blacklist)\\s+${moduleName}\\b' /etc/modprobe.d/* && echo "Module not configured to be disabled"`;
                generatedRevert = `#!/bin/sh\n# Enables the '${moduleName}' kernel module.\n\nrm -f /etc/modprobe.d/${moduleName}.conf\nmodprobe ${moduleName}`;
            }

            // Logic for filesystem partition checks (e.g., /tmp)
            if (policy.description.includes('/tmp is a separate partition')) {
                 generatedHarden = `# To configure /tmp as a separate partition, you must manually\n# create a partition or logical volume and add an entry to /etc/fstab.\n# Example for tmpfs:\n# echo 'tmpfs /tmp tmpfs defaults,rw,nosuid,nodev,noexec,relatime 0 0' >> /etc/fstab\n# systemctl unmask tmp.mount\n# mount /tmp`;
                 generatedCheck = `findmnt -nk /tmp`;
                 generatedRevert = `# To revert, remove the corresponding line from /etc/fstab and reboot.\n# Example: sed -i '/\\/tmp/d' /etc/fstab`;
            }

            setHardenScript(generatedHarden);
            setCheckScript(generatedCheck);
            setRevertScript(generatedRevert);
        }
    }, [policy, customScripts]);
    
    // --- Updated execution logic ---
    const handlePasswordSubmit = async (password: string) => {
        setIsPromptOpen(false);
        if (!actionToExecute) return;

        setIsExecuting(true);
        setExecutionResult(null);
        setExecutionError(null);

        const scriptToRun = actionToExecute === 'apply' ? hardenScript : revertScript;
        
        try {
            let result;
            if (actionToExecute === 'apply') {
                // MODIFICATION: Added `as any` to bypass the stale type error
                result = await (window.electron.applyHarden as any)(scriptToRun, password);
            } else { // 'revert'
                 // MODIFICATION: Added `as any` to bypass the stale type error
                result = await (window.electron.revertHardening as any)(scriptToRun, password);
            }
            setExecutionResult(`Success:\n${result || 'The operation completed successfully.'}`);
        } catch (error: any) {
            if (error.toString().toLowerCase().includes('incorrect password')) {
                setExecutionError('Error: Incorrect password provided for sudo.');
            } else {
                setExecutionError(`Error:\n${error.toString()}`);
            }
        } finally {
            setIsExecuting(false);
            setActionToExecute(null);
        }
    };

    const handleExecute = async (action: 'apply' | 'check' | 'revert') => {
        const needsSudo = action === 'apply' || action === 'revert';

        if (needsSudo) {
            setActionToExecute(action);
            setIsPromptOpen(true);
        } else {
            // Directly execute 'check' action without a password
            setIsExecuting(true);
            setExecutionResult(null);
            setExecutionError(null);
            try {
                const result = await window.electron.checkStatus(checkScript);
                setExecutionResult(`Success:\n${result || 'The operation completed successfully.'}`);
            } catch (error: any) {
                setExecutionError(`Error:\n${error.toString()}`);
            } finally {
                setIsExecuting(false);
            }
        }
    };


    const handleSave = async () => {
        if (!policy) return;
        const policyIdMatch = policy.description.match(/^(\d+(\.\d+)*)/);
        const policyId = policyIdMatch ? policyIdMatch[0] : policy.description;

        setIsSaving(true);
        await onSave(policyId, {
            hardeningScript: hardenScript,
            auditScript: checkScript,
            revertHardeningScript: revertScript,
        });
        setIsSaving(false);
    };


    if (!policy) {
        return <div className="p-6 text-gray-500">Select a policy to see the details.</div>;
    }

    const { description, info, Impact, solution } = policy;

    const CopyButton: React.FC<{ textToCopy: string }> = ({ textToCopy }) => {
        const [copied, setCopied] = useState(false);
        const handleCopy = () => {
            navigator.clipboard.writeText(textToCopy).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            });
        };
        return (
            <button onClick={handleCopy} className="absolute top-2 right-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-xs font-semibold py-1 px-2 rounded">
                {copied ? 'Copied!' : 'Copy'}
            </button>
        );
    };

    return (
        <>
            {/* Render the modal */}
            <PasswordPromptModal
                isOpen={isPromptOpen}
                onClose={() => setIsPromptOpen(false)}
                onSubmit={handlePasswordSubmit}
            />

            <div className="p-6">
                <h2 className="text-xl font-bold mb-4 pb-2 border-b dark:border-gray-600">{description}</h2>
                
                <div className="space-y-3 text-sm mb-6">
                    <p><strong>Details:</strong> <span className="text-gray-600 dark:text-gray-300" dangerouslySetInnerHTML={{ __html: info?.replace(/\\n/g, '<br>') || 'N/A' }}></span></p>
                    {Impact && <p><strong>Impact:</strong> <span className="text-gray-600 dark:text-gray-300">{Impact}</span></p>}
                    {solution && <p><strong>Suggested Solution:</strong> <span className="text-gray-600 dark:text-gray-300" dangerouslySetInnerHTML={{ __html: solution?.replace(/\\n/g, '<br>') }}></span></p>}
                </div>

                <div className="flex space-x-2 mb-4">
                     <button onClick={() => handleExecute('apply')} disabled={isExecuting} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isExecuting ? 'Working...' : 'Apply Hardening'}
                    </button>
                    <button onClick={() => handleExecute('check')} disabled={isExecuting} className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isExecuting ? 'Working...' : 'Check Status'}
                    </button>
                    <button onClick={() => handleExecute('revert')} disabled={isExecuting} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isExecuting ? 'Working...' : 'Revert Hardening'}
                    </button>
                </div>

                {executionResult && <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 rounded-md text-xs font-mono whitespace-pre-wrap">{executionResult}</div>}
                {executionError && <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-md text-xs font-mono whitespace-pre-wrap">{executionError}</div>}
                
                <div className="space-y-4">
                    <div>
                        <h3 className="font-semibold mb-1">Hardening Script</h3>
                        <div className="relative">
                            <textarea value={hardenScript} onChange={e => setHardenScript(e.target.value)} rows={6} className="w-full p-2 font-mono text-xs bg-gray-100 dark:bg-gray-900 rounded-md resize-y border border-gray-300 dark:border-gray-600"></textarea>
                            <CopyButton textToCopy={hardenScript} />
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold mb-1">Audit Script</h3>
                        <div className="relative">
                            <textarea value={checkScript} onChange={e => setCheckScript(e.target.value)} rows={6} className="w-full p-2 font-mono text-xs bg-gray-100 dark:bg-gray-900 rounded-md resize-y border border-gray-300 dark:border-gray-600"></textarea>
                            <CopyButton textToCopy={checkScript} />
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold mb-1">Revert Script</h3>
                        <div className="relative">
                            <textarea value={revertScript} onChange={e => setRevertScript(e.target.value)} rows={6} className="w-full p-2 font-mono text-xs bg-gray-100 dark:bg-gray-900 rounded-md resize-y border border-gray-300 dark:border-gray-600"></textarea>
                            <CopyButton textToCopy={revertScript} />
                        </div>
                    </div>
                </div>
                 <div className="mt-6 flex justify-end">
                    <button onClick={handleSave} disabled={isSaving} className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed">
                        {isSaving ? "Saving..." : "Save Scripts for this Policy"}
                    </button>
                 </div>
            </div>
        </>
    );
};

// --- Main Page Component (No changes needed here) ---
const ProductDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [product, setProduct] = useState<ProductDetails | null>(null);
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPolicies, setSelectedPolicies] = useState<Set<string>>(new Set());
    const [templateMessage, setTemplateMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [customScripts, setCustomScripts] = useState<Record<string, any> | null>({});

    const naturalSort = useCallback((a: Policy, b: Policy) => {
        const regex = /^(\d+(\.\d+)*)/;
        const aMatch = a.description.match(regex);
        const bMatch = b.description.match(regex);
        if (!aMatch || !bMatch) return a.description.localeCompare(b.description);
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
    }, []);

    useEffect(() => {
        if (!id) { setError('No product ID provided.'); setIsLoading(false); return; }
        const fetchProductData = async () => {
            try {
                const productData = await getProductDetails(id);
                setProduct(productData);
                if (productData.script_json_url) {
                    try {
                        const scriptResponse = await axios.get(productData.script_json_url);
                        setCustomScripts(scriptResponse.data);
                    } catch (scriptError) {
                        console.warn("Could not load remote script.json, using local fallback.", scriptError);
                        setCustomScripts({});
                    }
                } else {
                     setCustomScripts({});
                }
                if (productData.audit_files && productData.audit_files.length > 0) {
                    const filePromises = productData.audit_files
                        .filter((file: AuditFile) => file.name !== 'metadata.json')
                        .map((file: AuditFile) => axios.get(file.url).then(res => res.data));
                    const policyContents = await Promise.all(filePromises);
                    const validPolicies = policyContents.filter(p => p && p.description);
                    validPolicies.sort(naturalSort);
                    setPolicies(validPolicies);
                    if (validPolicies.length > 0) setSelectedPolicy(validPolicies[0]);
                }
            } catch (err) {
                setError('Could not fetch product data.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchProductData();
    }, [id, naturalSort]);

    const filteredPolicies = useMemo(() => {
        if (!searchQuery.trim()) return policies;
        return policies.filter(policy => policy.description.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [searchQuery, policies]);

    const handlePolicySelection = (description: string) => {
        setSelectedPolicies(prev => {
            const newSelection = new Set(prev);
            newSelection.has(description) ? newSelection.delete(description) : newSelection.add(description);
            return newSelection;
        });
    };

    const handleSelectAllChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const filteredDescriptions = filteredPolicies.map(p => p.description);
        if (e.target.checked) {
            setSelectedPolicies(prev => new Set([...prev, ...filteredDescriptions]));
        } else {
            setSelectedPolicies(prev => {
                const newSet = new Set(prev);
                filteredDescriptions.forEach(desc => newSet.delete(desc));
                return newSet;
            });
        }
    };
    
    const handleCreateTemplate = async () => {
        if (selectedPolicies.size === 0) {
            setTemplateMessage("Please select at least one policy to create a template.");
            setTimeout(() => setTemplateMessage(null), 3000);
            return;
        }
        const selectedPolicyObjects = policies.filter(p => selectedPolicies.has(p.description));
        const policiesToSave = selectedPolicyObjects.map(policy => {
            const policyIdMatch = policy.description.match(/^(\d+(\.\d+)*)/);
            const policyId = policyIdMatch ? policyIdMatch[0] : policy.description;
            let scripts = { hardeningScript: '', auditScript: '', revertHardeningScript: '' };
            if (policyId && customScripts && customScripts[policyId]) {
                scripts = customScripts[policyId];
            }
            return { ...policy, ...scripts };
        });
        try {
            await createTemplate({ product: product!.id, policies: policiesToSave });
            setTemplateMessage("Template created successfully!");
            setSelectedPolicies(new Set());
        } catch (error) {
            console.error("Template creation failed:", error);
            setTemplateMessage("Failed to create template.");
        } finally {
            setTimeout(() => setTemplateMessage(null), 3000);
        }
    };

    const handleSavePolicyScripts = async (policyId: string, newScripts: { hardeningScript: string; auditScript: string; revertHardeningScript: string; }) => {
        if (!product) return;
        
        setTemplateMessage(null);
        setError(null);

        const updatedCustomScripts = {
            ...(customScripts || {}),
            [policyId]: newScripts
        };

        try {
            await updateProductScripts(product.id, updatedCustomScripts);
            setCustomScripts(updatedCustomScripts);
            setTemplateMessage("Scripts saved successfully!");
        } catch (err) {
            setError("Failed to save updated scripts to the server.");
            console.error("Failed to save scripts:", err);
        } finally {
            setTimeout(() => setTemplateMessage(null), 3000);
        }
    };
    
    if (isLoading) return <div className="text-center p-10">Loading product details...</div>;
    if (!product) return <div className="text-center p-10"><p className="text-red-500">{error || 'Product not found.'}</p><Link to="/" className="text-blue-500">Back to Directory</Link></div>;
    const isAllFilteredSelected = filteredPolicies.length > 0 && filteredPolicies.every(p => selectedPolicies.has(p.description));

    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <header className="mb-8">
                {product.organization_id && <Link to={`/organization/${product.organization_id}`} className="text-blue-600 dark:text-blue-400 hover:underline text-sm">← Back to Organization</Link>}
                <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mt-2">{product.name}</h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">Security Policies (Ubuntu Linux Workstation Viewer)</p>
            </header>
            <div className="flex flex-col md:flex-row gap-8">
                <aside className="md:w-1/3 lg:w-1/4">
                    <input type="search" placeholder="Search policies..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full py-2 px-3 text-gray-700 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-200 mb-4" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Showing {filteredPolicies.length} of {policies.length} policies.</p>
                    <div className="space-y-2">
                        <button onClick={handleCreateTemplate} className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700">Create Template ({selectedPolicies.size})</button>
                        {templateMessage && <p className={`text-sm text-center mt-2 ${error ? 'text-red-500' : 'text-green-500'}`}>{templateMessage || error}</p>}
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-700 mt-4 pt-4">
                        <div className="flex items-center">
                            <input id="select-all-checkbox" type="checkbox" className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" checked={isAllFilteredSelected} onChange={handleSelectAllChange} disabled={filteredPolicies.length === 0} />
                            <label htmlFor="select-all-checkbox" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">Select All ({filteredPolicies.length} visible)</label>
                        </div>
                    </div>
                    <ul className="space-y-1 overflow-y-auto max-h-[65vh] pr-2 rounded-md mt-2">
                        {filteredPolicies.map(policy => (
                            <li key={policy.description} className="flex items-center">
                                <input type="checkbox" checked={selectedPolicies.has(policy.description)} onChange={() => handlePolicySelection(policy.description)} className="mr-2" />
                                <button onClick={() => setSelectedPolicy(policy)} className={`w-full text-left px-3 py-2 rounded-md transition-colors duration-200 text-sm ${selectedPolicy?.description === policy.description ? 'bg-blue-600 text-white font-semibold' : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{policy.description}</button>
                            </li>
                        ))}
                    </ul>
                </aside>
                <main className="md:w-2/3 lg:w-3/4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md min-h-[70vh]">
                        <PolicyDetailView 
                            policy={selectedPolicy} 
                            customScripts={customScripts}
                            onSave={handleSavePolicyScripts}
                        />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default ProductDetailPage;