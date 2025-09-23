// src/pages/ProductDetailViewers/Windows 11 Standalone/ProductDetailPage.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProductDetails, ProductDetails, createTemplate } from '../../../services/authService';
import axios from 'axios';
import customScripts from './scripts.json'; // Import the viewer's specific scripts

// --- Type Interfaces ---
interface AuditFile {
    name: string;
    url: string;
}

interface Policy {
    description: string;
    info?: string;
    Impact?: string;
    reg_key?: string;
    reg_item?: string;
    value_data?: string;
    value_type?: string;
    reg_option?: string;
    type?: string;
    [key: string]: any;
}

// --- Helper Components ---

const PolicyDetailView: React.FC<{ policy: Policy | null }> = ({ policy }) => {
    const [hardenScript, setHardenScript] = useState('');
    const [checkScript, setCheckScript] = useState('');
    const [revertScript, setRevertScript] = useState('');
    const [executionResult, setExecutionResult] = useState<string | null>(null);
    const [executionError, setExecutionError] = useState<string | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);

    useEffect(() => {
        if (policy) {
            setExecutionResult(null);
            setExecutionError(null);

            // Extract policy number from description
            const policyIdMatch = policy.description.match(/^(\d+(\.\d+)*)/);
            const policyId = policyIdMatch ? policyIdMatch[0] : null;

            // Check if a custom script exists for this policy ID
            if (policyId && (customScripts as any)[policyId]) {
                const scripts = (customScripts as any)[policyId];
                setHardenScript(scripts.hardeningScript || '# No custom hardening script provided.');
                setCheckScript(scripts.auditScript || '# No custom audit script provided.');
                setRevertScript(scripts.revertHardeningScript || '# No custom revert script provided.');
                return; // Exit early
            }

            // Fallback to dynamic script generation
            const { reg_key, reg_item, value_data, value_type, reg_option } = policy;

            if (reg_option === 'MUST_NOT_EXIST' && value_data) {
                const keyToDelete = value_data;
                setHardenScript(`reg delete "${keyToDelete}" /f`);
                setCheckScript(`reg query "${keyToDelete}"\n\n# This check PASSES if it returns an error (key not found).`);
                setRevertScript(`# There is no automatic revert script for this policy.\n# This policy requires a registry key to be absent.`);
                return;
            }

            if (!reg_key || !reg_item) {
                setHardenScript('# Invalid policy data: Missing registry key or item.');
                setCheckScript('# Invalid policy data');
                setRevertScript('# Invalid policy data');
                return;
            }

            let regType = 'REG_SZ';
            if (value_type === 'POLICY_DWORD') {
                regType = 'REG_DWORD';
            }

            setHardenScript(`reg add "${reg_key}" /v "${reg_item}" /t ${regType} /d "${value_data}" /f`);
            setCheckScript(`reg query "${reg_key}" /v "${reg_item}"`);
            setRevertScript(`reg delete "${reg_key}" /v "${reg_item}" /f`);
        }
    }, [policy]);

    const handleScriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'hardenScript') {
            setHardenScript(value);
        } else if (name === 'checkScript') {
            setCheckScript(value);
        } else if (name === 'revertScript') {
            setRevertScript(value);
        }
    };

    const handleExecute = async (action: 'apply' | 'check' | 'revert') => {
        setIsExecuting(true);
        setExecutionResult(null);
        setExecutionError(null);

        try {
            let result;
            if (action === 'apply') {
                result = await window.electron.applyHarden(hardenScript);
            } else if (action === 'check') {
                result = await window.electron.checkStatus(checkScript);
            } else {
                result = await window.electron.revertHardening(revertScript);
            }
            setExecutionResult(`Success: ${result || 'The operation completed successfully.'}`);
        } catch (error: any) {
            setExecutionError(`Error: ${error.toString()}`);
        } finally {
            setIsExecuting(false);
        }
    };

    if (!policy) {
        return <div className="p-6 text-gray-500">Select a policy to see the details.</div>;
    }

    const { description, info, Impact, reg_key, reg_item, value_data, value_type } = policy;

    const CopyButton: React.FC<{ textToCopy: string }> = ({ textToCopy }) => {
        const [copied, setCopied] = useState(false);
        const handleCopy = () => {
            navigator.clipboard.writeText(textToCopy).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            });
        };
        return (
            <button
                onClick={handleCopy}
                className="absolute top-2 right-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-xs font-semibold py-1 px-2 rounded"
            >
                {copied ? 'Copied!' : 'Copy'}
            </button>
        );
    };

    return (
        <div className="p-6">
            <h2 className="text-xl font-bold mb-4 pb-2 border-b dark:border-gray-600">{description}</h2>

            <div className="space-y-3 text-sm mb-6">
                <p><strong>Details:</strong> <span className="text-gray-600 dark:text-gray-300" dangerouslySetInnerHTML={{ __html: info?.replace(/\\n/g, '<br>') || 'N/A' }}></span></p>
                {Impact && <p><strong>Impact:</strong> <span className="text-gray-600 dark:text-gray-300">{Impact}</span></p>}
                {reg_key && <p><strong>Registry Key:</strong> <code className="bg-gray-100 dark:bg-gray-700 p-1 rounded text-xs">{reg_key}</code></p>}
                {reg_item && <p><strong>Registry Item:</strong> <code className="bg-gray-100 dark:bg-gray-700 p-1 rounded text-xs">{reg_item}</code></p>}
                {value_data && <p><strong>Value:</strong> <code className="bg-gray-100 dark:bg-gray-700 p-1 rounded text-xs">{value_data} {value_type ? `(${value_type})` : ''}</code></p>}
            </div>

            <div className="flex space-x-2 mb-4">
                <button
                    onClick={() => handleExecute('apply')}
                    disabled={isExecuting}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isExecuting ? 'Working...' : 'Apply Hardening'}
                </button>
                <button
                    onClick={() => handleExecute('check')}
                    disabled={isExecuting}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isExecuting ? 'Working...' : 'Check Status'}
                </button>
                <button
                    onClick={() => handleExecute('revert')}
                    disabled={isExecuting}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isExecuting ? 'Working...' : 'Revert Hardening'}
                </button>
            </div>

            {executionResult && <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 rounded-md text-xs font-mono whitespace-pre-wrap">{executionResult}</div>}
            {executionError && <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-md text-xs font-mono whitespace-pre-wrap">{executionError}</div>}

            <div className="space-y-4">
                <div>
                    <h3 className="font-semibold mb-1">Hardening Script</h3>
                    <div className="relative">
                        <textarea 
                            name="hardenScript"
                            value={hardenScript}
                            onChange={handleScriptChange}
                            rows={6}
                            className="w-full p-2 font-mono text-xs bg-gray-100 dark:bg-gray-900 rounded-md resize-y"
                        ></textarea>
                        <CopyButton textToCopy={hardenScript} />
                    </div>
                </div>
                <div>
                    <h3 className="font-semibold mb-1">Check Status Script</h3>
                    <div className="relative">
                        <textarea
                            name="checkScript"
                            value={checkScript}
                            onChange={handleScriptChange}
                            rows={6}
                            className="w-full p-2 font-mono text-xs bg-gray-100 dark:bg-gray-900 rounded-md resize-y"
                        ></textarea>
                        <CopyButton textToCopy={checkScript} />
                    </div>
                </div>
                <div>
                    <h3 className="font-semibold mb-1">Revert Hardening Script</h3>
                    <div className="relative">
                        <textarea
                            name="revertScript"
                            value={revertScript}
                            onChange={handleScriptChange}
                            rows={6}
                            className="w-full p-2 font-mono text-xs bg-gray-100 dark:bg-gray-900 rounded-md resize-y"
                        ></textarea>
                        <CopyButton textToCopy={revertScript} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Main Page Component ---

const generateScriptForPolicies = (policies: Policy[], scriptType: 'hardeningScript' | 'auditScript' | 'revertHardeningScript'): string => {
    const scriptParts: string[] = [];

    for (const policy of policies) {
        let scriptPart = '';
        const policyIdMatch = policy.description.match(/^(\d+(\.\d+)*)/);
        const policyId = policyIdMatch ? policyIdMatch[0] : null;

        if (policyId && (customScripts as any)[policyId]) {
            scriptPart = (customScripts as any)[policyId][scriptType] || '';
        }
        else {
            const { reg_key, reg_item, value_data, value_type, reg_option } = policy;
            if (scriptType === 'hardeningScript') {
                if (reg_option === 'MUST_NOT_EXIST' && value_data) {
                    scriptPart = `reg delete "${value_data}" /f`;
                } else if (reg_key && reg_item) {
                    const regType = value_type === 'POLICY_DWORD' ? 'REG_DWORD' : 'REG_SZ';
                    scriptPart = `reg add "${reg_key}" /v "${reg_item}" /t ${regType} /d "${value_data}" /f`;
                }
            } else if (scriptType === 'auditScript') {
                if (reg_option === 'MUST_NOT_EXIST' && value_data) {
                    scriptPart = `reg query "${value_data}"`;
                } else if (reg_key && reg_item) {
                    scriptPart = `reg query "${reg_key}" /v "${reg_item}"`;
                }
            } else if (scriptType === 'revertHardeningScript') {
                if (reg_option === 'MUST_NOT_EXIST' && value_data) {
                    scriptPart = `# No automatic revert for MUST_NOT_EXIST policy: ${policy.description}`;
                } else if (reg_key && reg_item) {
                    scriptPart = `reg delete "${reg_key}" /v "${reg_item}" /f`;
                }
            }
        }

        if (scriptPart) {
            scriptParts.push(`# Policy: ${policy.description}\n${scriptPart}`);
        }
    }

    return scriptParts.join('\n\n');
};

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

    const naturalSort = useCallback((a: Policy, b: Policy) => {
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
    }, []);

    useEffect(() => {
        if (!id) {
            setError('No product ID provided.');
            setIsLoading(false);
            return;
        }

        const fetchProductData = async () => {
            try {
                const productData = await getProductDetails(id);
                setProduct(productData);

                if (productData.audit_files && productData.audit_files.length > 0) {
                    const filePromises = productData.audit_files
                        .filter((file: AuditFile) => file.name !== 'metadata.json')
                        .map((file: AuditFile) => axios.get(file.url).then(res => res.data));

                    const policyContents = await Promise.all(filePromises);

                    // MODIFICATION START: Handle conditional and direct policy structures
                    const validPolicies = policyContents.reduce((acc: Policy[], data) => {
                        if (data && data.check_type === 'CONDITIONAL' && data.then && data.then.report) {
                            // This is a conditional policy, extract the report object
                            acc.push(data.then.report);
                        } else if (data && data.description) {
                            // This is a direct policy object
                            acc.push(data);
                        }
                        return acc;
                    }, []);
                    // MODIFICATION END

                    validPolicies.sort(naturalSort);
                    setPolicies(validPolicies);

                    if (validPolicies.length > 0) {
                        setSelectedPolicy(validPolicies[0]);
                    }
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
        return policies.filter(policy =>
            policy.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery, policies]);

    const handlePolicySelection = (description: string) => {
        setSelectedPolicies(prev => {
            const newSelection = new Set(prev);
            if (newSelection.has(description)) {
                newSelection.delete(description);
            } else {
                newSelection.add(description);
            }
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

    const isAllFilteredSelected = filteredPolicies.length > 0 && filteredPolicies.every(p => selectedPolicies.has(p.description));
    const handleCreateTemplate = async () => {
        if (selectedPolicies.size === 0) {
            setTemplateMessage("Please select at least one policy to create a template.");
            return;
        }

        const policiesToSave = policies.filter(p => selectedPolicies.has(p.description));
        try {
            // Corrected payload to match the CreateTemplatePayload interface
            await createTemplate({
                product: product!.id,
                policies: policiesToSave,
            });
            setTemplateMessage("Template created successfully!");
            setSelectedPolicies(new Set());
        } catch (error) {
            setTemplateMessage("Failed to create template.");
        }
    };

    if (isLoading) {
        return <div className="text-center p-10">Loading product details...</div>;
    }

    if (!product) {
        return (
            <div className="text-center p-10">
                <p className="text-red-500">{error || 'Product not found.'}</p>
                <Link to="/" className="text-blue-500">Back to Directory</Link>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <header className="mb-8">
                {product.organization_id && (
                    <Link to={`/organization/${product.organization_id}`} className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
                        ← Back to Organization
                    </Link>
                )}
                <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mt-2">{product.name}</h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">Security Policies</p>
            </header>

            <div className="flex flex-col md:flex-row gap-8">
                <aside className="md:w-1/3 lg:w-1/4">
                    <div className="mb-4">
                        <input
                            type="search"
                            placeholder="Search policies..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full py-2 px-3 text-gray-700 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-200"
                        />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        Showing {filteredPolicies.length} of {policies.length} policies.
                    </p>
                    <div className="space-y-2">
                        <button
                            onClick={handleCreateTemplate}
                            className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700"
                        >
                            Create Template ({selectedPolicies.size})
                        </button>
                        {templateMessage && <p className="text-sm text-center">{templateMessage}</p>}
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-700 mt-4 pt-4">
                        <div className="flex items-center">
                            <input
                                id="select-all-checkbox"
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                checked={isAllFilteredSelected}
                                onChange={handleSelectAllChange}
                                disabled={filteredPolicies.length === 0}
                            />
                            <label htmlFor="select-all-checkbox" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                Select All ({filteredPolicies.length} visible)
                            </label>
                        </div>
                    </div>
                    <ul className="space-y-1 overflow-y-auto max-h-[65vh] pr-2 rounded-md mt-2">
                        {filteredPolicies.map(policy => (
                            <li key={policy.description} className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={selectedPolicies.has(policy.description)}
                                    onChange={() => handlePolicySelection(policy.description)}
                                    className="mr-2"
                                />
                                <button
                                    onClick={() => setSelectedPolicy(policy)}
                                    className={`w-full text-left px-3 py-2 rounded-md transition-colors duration-200 text-sm ${selectedPolicy?.description === policy.description
                                            ? 'bg-blue-600 text-white font-semibold'
                                            : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    {policy.description}
                                </button>
                            </li>
                        ))}
                    </ul>
                </aside>

                <main className="md:w-2/3 lg:w-3/4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md min-h-[70vh]">
                        <PolicyDetailView policy={selectedPolicy} />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default ProductDetailPage;