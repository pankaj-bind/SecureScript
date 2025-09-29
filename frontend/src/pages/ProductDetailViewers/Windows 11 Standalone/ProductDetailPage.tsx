// src/pages/ProductDetailViewers/Windows 11 Standalone/ProductDetailPage.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Policy } from '../../../electron-api.d';
import { createTemplate } from '../../../services/authService';
import { ViewerPageProps } from '../../../pages/ProductDetailPage';

const policyTypeConfigs: { [key: string]: any } = {
  USER_RIGHTS_POLICY: {
    apiCall: (policy: Policy, value: string) => window.electronAPI.setUserRight({ privilege: policy.right_type!, value_data: value, policyName: policy.description }),
    // FIXED: Unterminated string constant by keeping the template literal on one line
    getRecommendedText: (policy: Partial<Policy>) => `Should be set to: "${(policy.value_data || 'No users assigned').replace(/"/g, '')}"`,
    needsInput: (policy: Partial<Policy>) => !policy.value_data || (policy.value_data && policy.value_data.includes('&&')),
    inputType: 'textarea',
  },
  AUDIT_POLICY_SUBCATEGORY: {
    apiCall: (policy: Policy) => window.electronAPI.setAuditPolicy({ subcategory: `"${policy.audit_policy_subcategory!}"`, value_data: policy.value_data }),
    getRecommendedText: (policy: Partial<Policy>) => `Should be set to: "${policy.value_data}"`,
    needsInput: () => false,
  },
  PASSWORD_POLICY: {
    apiCall: (policy: Policy, value: string) => window.electronAPI.setAccountPolicy({ policyName: policy.password_policy!, value }),
    getRecommendedText: (policy: Partial<Policy>) => {
        // MODIFIED: Added 'LOCKOUT_ADMINS' to the list of policies with a fixed recommended state.
        if (['COMPLEXITY_REQUIREMENTS', 'REVERSIBLE_ENCRYPTION', 'LOCKOUT_ADMINS'].includes(policy.password_policy!)) {
            return `Should be set to: "${policy.value_data}"`;
        }
        return `Recommended value is between ${policy.value_data?.replace(/"/g, '')}`;
    },
    needsInput: (policy: Partial<Policy>) => {
        // MODIFIED: Added 'LOCKOUT_ADMINS' 
        return !['COMPLEXITY_REQUIREMENTS', 'REVERSIBLE_ENCRYPTION', 'LOCKOUT_ADMINS'].includes(policy.password_policy!);
    },
    inputType: 'number',
  },
  LOCKOUT_POLICY: {
    apiCall: (policy: Policy, value: string) => window.electronAPI.setAccountPolicy({ 
 policyName: policy.lockout_policy!, value }),
    getRecommendedText: (policy: Partial<Policy>) => {
        if (policy.lockout_policy === 'LOCKOUT_ADMINS') {
            return `Should be set to: "${policy.value_data}"`;
        }
        return `Recommended value is between ${policy.value_data?.replace(/"/g, '')}`;
    },
    needsInput: (policy: Partial<Policy>) => {
        // Do not show an input for the fixed admin lockout policy
        return policy.lockout_policy !== 'LOCKOUT_ADMINS';
    },
    inputType: 'number',
  },
  CHECK_ACCOUNT: {
    apiCall: (policy: Policy, value: string) => window.electronAPI.setCheckAccount({ policy, newValue: value }),
    getRecommendedText: (policy: Partial<Policy>) => {
        if (policy.value_data === 'Disabled') return 'Account should be disabled.';
        if (policy.check_type === 'CHECK_NOT_EQUAL') return `Account name should not be "${policy.value_data}".`;
        if (policy.check_type === 'CHECK_NOT_REGEX') return `Account name should not match regex "${policy.value_data}".`;
        return 'Check account status or name.';
    },
    needsInput: (policy: Partial<Policy>) => policy.check_type !== 'CHECK_EQUAL',
    inputType: 'text',
  },
  AUDIT_POWERSHELL: {
    apiCall: (policy: 
 Policy) => window.electronAPI.setPowershellPolicy({ script: policy.powershell_args! }),
    getRecommendedText: () => 'A PowerShell script must be run for this audit.',
    needsInput: () => false,
  },
  ANONYMOUS_SID_SETTING: {
    apiCall: (policy: Policy) => window.electronAPI.setSecurityOption({ policy }),
    getRecommendedText: (policy: Partial<Policy>) => `Should be set to: "${policy.value_data}"`,
    needsInput: () => false,
  },
  BANNER_CHECK: {
    apiCall: (policy: Policy, value: string) => window.electronAPI.setBannerPolicy({ policy, newValue: value }),
    getRecommendedText: () => 'An appropriate legal banner should be configured.',
    needsInput: () => true,
    inputType: 'textarea',
  },
  REGISTRY_SETTING: {
    apiCall: (policy: Policy, value: string) => window.electronAPI.setRegistrySetting({ policy, newValue: value }),
    getRecommendedText: (policy: Partial<Policy>) => `Value should be: ${policy.value_data}.`,
    needsInput: (policy: Partial<Policy>) => !!policy.variable,
    inputType: (policy: Partial<Policy>) => (policy.value_type === 'POLICY_MULTI_TEXT' ? 'textarea' : 'text'),
  },
};

interface Status {
  isLoading: boolean;
  feedback: { type: 'success' | 'error'; message: string } | null;
}

const getPolicyKey = (policy: Policy): string => {
  const displayPolicy = policy.check_type === 'CONDITIONAL' ? (policy.then?.report || policy) : policy;
  // Use the policy number (e.g., "1.1.1") as the key for state management
  const match = displayPolicy.description.match(/^\d+(\.\d+)+/);
  return match ? match[0] : (displayPolicy?.description || `policy-${Math.random()}`);
};

// Extend the Policy interface locally for frontend use
interface PolicyWithPassedValue extends Policy {
    passed_value?: string;
    custom_value?: string;
}

const PolicyDetails: React.FC<{ policyData: any 
 }> = ({ policyData }) => {
    // Note: We use 'any' here as the object structure is dynamic and validated on API boundaries
    const displayKeys: { key: keyof Policy; title: string }[] = [
        { key: 'info', title: 'Info' },
        { key: 'Note', title: 'Note' },
        { key: 'solution', title: 'Solution' },
        { key: 'Impact', title: 'Impact' },
        { key: 'reference', title: 'Reference' },
        { key: 'see_also', title: 'See Also' },
    ];

    if (!policyData) return null;

    return (
        <>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{policyData.description}</h2>
            {displayKeys.map(({ key, title }) => (
                policyData[key] && (
                    <div key={key}>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-4">{title}</h3>
                        <p className="mt-1 text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words">
                            {String(policyData[key])}
                        </p>
                    </div>
                )
            ))}
        </>
    );
};


const ProductDetailPage: React.FC<ViewerPageProps> = ({ product }) => {
  const [policies, setPolicies] = useState<PolicyWithPassedValue[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyWithPassedValue | null>(null);
  const [statuses, setStatuses] = useState<{ [key: string]: Status }>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const navigate = useNavigate();

  // --- PERSISTENCE & RESET LOGIC START ---
  const [policyValues, setPolicyValues] = useState<{ [key: string]: string }>({});
  const [defaultPolicyValues, setDefaultPolicyValues] = useState<{ [key: string]: string }>({});
  const storageKey = useMemo(() => `product-policy-values-${product.id}`, [product.id]);

  // Load values from localStorage on initial component mount
  useEffect(() => {
    const fetchAndSetupPolicies = async () => {
        setInitialLoading(true);
        setInitialError(null);

        const policyDirectoryPath = product.audit_json_output_path;

        if (!policyDirectoryPath) {
            setInitialError("Audit file path is not configured for this product.");
            setInitialLoading(false);
            return;
        }

        if (!window.electronAPI) {
            setInitialError('Electron API is not available.');
            setInitialLoading(false);
            return;
        }

        try {
            const result = await window.electronAPI.getPolicyFiles(policyDirectoryPath);
            if (result.success && result.data) {
                const filteredPolicies: PolicyWithPassedValue[] = result.data.filter(p => {
                    // Check for null or undefined policy object before accessing properties
                    if (!p || !p.description) {
                        const rawJson = JSON.stringify(p).toLowerCase();
                        return !rawJson.includes('metadata.json') && !rawJson.includes('script.json');
                    }
                    // Extract the policy to check if it's not a metadata/script file
                    const displayPolicy = p.check_type === 'CONDITIONAL' ? (p.then?.report || p) : p;
                    const description = displayPolicy.description.toLowerCase();
                    return description !== 'metadata.json' && description !== 'script.json';
                });

                setPolicies(filteredPolicies);
                if (filteredPolicies.length > 0) setSelectedPolicy(filteredPolicies[0]);

                const defaultValues: { [key: string]: string } = {};
                const initialStatuses: { [key: string]: Status } = {};

                filteredPolicies.forEach(policy => {
                    const key = getPolicyKey(policy);
                    initialStatuses[key] = { isLoading: false, feedback: null };
                    const policyType = (policy.check_type === 'CONDITIONAL') ? policy.condition?.rules?.[0]?.type : policy.type;
                    const config = policyType ? policyTypeConfigs[policyType] : null;
                    const targetPolicy = policy.check_type === 'CONDITIONAL' ? 
                    (policy.condition?.rules?.[0] || {}) : policy;

                    if (config?.needsInput?.(targetPolicy)) {
                        let defaultValue = '';
                        // Prioritize existing passed_value if available (e.g., from an imported template)
                        if (policy.passed_value) {
                             defaultValue = String(policy.passed_value);
                        } else if (targetPolicy.variable?.default) {
                            defaultValue = targetPolicy.variable.default.replace(/\[|\]/g, '').split('..')[0];
                        } else if ((targetPolicy.value_data || "").includes('..')) {
                          defaultValue = targetPolicy.value_data!.match(/\[(\d+)\.\./)?.[1] || targetPolicy.value_data!.split('..')[0];
                        } else if (targetPolicy.value_type === 'POLICY_MULTI_TEXT') {
                          defaultValue = (targetPolicy.value_data || "").split('&&').map(s => s.trim().replace(/"/g, '')).join('\n');
                        } else if (targetPolicy.account_type === 'ADMINISTRATOR_ACCOUNT') {
                          defaultValue = 'LclAdmin';
                        } else 
 if (targetPolicy.account_type === 'GUEST_ACCOUNT') {
                          defaultValue = 'LclGuest';
                        } else if (targetPolicy.value_data) {
                          defaultValue = targetPolicy.value_data.split('||')[0].replace(/"/g, '').trim();
                        }
                      defaultValues[key] = defaultValue;
                    }
                });
                
                setDefaultPolicyValues(defaultValues);
                setStatuses(initialStatuses);
                
                // Load saved values from localStorage and merge with defaults
                const savedValuesRaw = localStorage.getItem(storageKey);
                const savedValues = savedValuesRaw ? JSON.parse(savedValuesRaw) : {};
                setPolicyValues({ ...defaultValues, ...savedValues });

            } else {
                setInitialError(result.message || 'Failed to load policies.');
            }
        } catch (err: any) {
            setInitialError(`An error occurred while fetching policies: ${err.message}`);
        } finally {
            setInitialLoading(false);
        }
    };
    fetchAndSetupPolicies();
  }, [product.audit_json_output_path, product.id, storageKey]);

  // Save values to localStorage whenever they change
  useEffect(() => {
    // Avoid saving the initial empty state
    if (Object.keys(policyValues).length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(policyValues));
    }
  }, [policyValues, storageKey]);

  // Handler to reset a value to its default
  const handleResetValue = (policy: PolicyWithPassedValue) => {
    const key = getPolicyKey(policy);
    const defaultValue = defaultPolicyValues[key];
    if (defaultValue !== undefined) {
      setPolicyValues(prev => ({ ...prev, [key]: defaultValue }));
    }
  };
  // --- PERSISTENCE & RESET LOGIC END ---

  const [selectedForTemplate, setSelectedForTemplate] = useState<Set<string>>(new Set());
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [templateFeedback, setTemplateFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // CORRECTED: Fixed the arrow function syntax and implicit 'policy' type.
  const filteredPolicies = useMemo(() => {
    if (!searchQuery.trim()) return policies;
    const lowercasedQuery = searchQuery.toLowerCase();
    // FIX: Moved '=>' to same line and added explicit type for 'policy'
    return policies.filter((policy: PolicyWithPassedValue) => {
        const displayPolicy = policy.check_type === 'CONDITIONAL' ? (policy.then?.report || policy) : policy;
        return displayPolicy.description.toLowerCase().includes(lowercasedQuery);
    });
  }, [searchQuery, policies]);

  // FIX: Added explicit type for 'p' in .every() and ensured filteredPolicies is treated as an array
  const isAllSelected = Array.isArray(filteredPolicies) && filteredPolicies.length > 0 && filteredPolicies.every((p: PolicyWithPassedValue) => selectedForTemplate.has(getPolicyKey(p)));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    // FIX: Ensure filteredPolicies is treated as an array
    if (e.target.checked && Array.isArray(filteredPolicies)) {
        setSelectedForTemplate(new Set(filteredPolicies.map(getPolicyKey)));
    } else {
        setSelectedForTemplate(new Set());
    }
  };


  const handleTemplateSelection = (policyKey: string, isChecked: boolean) => {
    setSelectedForTemplate(prev => {
        const newSet = new Set(prev);
        if (isChecked) newSet.add(policyKey); else newSet.delete(policyKey);
        return newSet;
    });
  };

  const handleCreateTemplate = async () => {
    if (selectedForTemplate.size === 0) {
        setTemplateFeedback({ type: 'error', message: 'Please select at least one policy.' });
        return;
    }
    setIsCreatingTemplate(true);
    setTemplateFeedback(null);
    try {
        const policiesToSubmit = policies
            .filter(p => selectedForTemplate.has(getPolicyKey(p)))
            .map(p => {
                const key = getPolicyKey(p);
                const policyType = p.type || p.condition?.rules?.[0]?.type;
                const config = policyType ? policyTypeConfigs[policyType] : null;
                const targetPolicy = p.check_type === 'CONDITIONAL' ? (p.condition?.rules?.[0] || {}) : p;
                
                // Deep clone the policy object
                const clonedPolicy = JSON.parse(JSON.stringify(p));

                // Check if the policy is the type that needs user input AND has a value in state
                if (config?.needsInput?.(targetPolicy) && policyValues[key] !== undefined) {
                    // Inject the user-defined value into a custom field for the backend to handle
                    clonedPolicy.custom_value = policyValues[key]; 
                }
                
                return clonedPolicy;
            });
            
        await createTemplate({ product: product.id, policies: policiesToSubmit });
        setTemplateFeedback({ type: 'success', message: 'Template created successfully! Redirecting...' 
 });
        setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err: any) {
        setTemplateFeedback({ type: 'error', message: err.response?.data?.error || 'Failed to create template.' });
    } finally {
        setIsCreatingTemplate(false);
    }
  };

  const handlePolicySubmit = async (policy: PolicyWithPassedValue) => {
    const key = getPolicyKey(policy);
    const policyType = (policy.check_type === 'CONDITIONAL') ? policy.condition?.rules?.[0]?.type : policy.type;
    const config = policyType ? policyTypeConfigs[policyType] : null;
    // FIX: Added null checks for selectedPolicy
    const policyToApply = policy.check_type === 'CONDITIONAL' ? (policy.condition?.rules?.[0] || null) : policy;
    
    if (!config || !policyToApply || !key) {
      setStatuses(prev => ({ ...prev, [key]: { isLoading: false, feedback: { type: 'error', message: 'Invalid policy configuration.' } } }));
      return;
    }

    setStatuses(prev => ({ ...prev, [key]: { isLoading: true, feedback: null } }));

    try {
      // For fixed policies, use the value_data directly. Otherwise, use the state value.
      const valueToSubmit = config.needsInput(policyToApply) ? policyValues[key] : policyToApply.value_data;
      const result = await config.apiCall(policyToApply, valueToSubmit);
      // FIXED: Corrected setStatuses usage to maintain the correct type structure
      setStatuses(prev => ({ 
        ...prev, 
        [key]: { isLoading: false, feedback: { type: result.success ? 'success' : 'error', message: result.message } } 
      }));
    } catch (err: any) {
      setStatuses(prev => ({
        ...prev, 
        [key]: { isLoading: false, feedback: { type: 'error', message: `An IPC error occurred: ${err.message}` } } 
      }));
    }
  };
  
  const selectedPolicyConfig = useMemo(() => {
    if (!selectedPolicy) return null;
    const policyType = (selectedPolicy.check_type === 'CONDITIONAL') ? selectedPolicy.condition?.rules?.[0]?.type : selectedPolicy.type;
    return policyType ? policyTypeConfigs[policyType] : null;
  }, [selectedPolicy]);

  // FIX: Added null check for selectedPolicy
  const renderPolicyInput = (policy: PolicyWithPassedValue) => {
    if (!policy) return null;

    const key = getPolicyKey(policy);
    const config = selectedPolicyConfig;
    const targetPolicy = policy.check_type === 'CONDITIONAL' ? (policy.condition?.rules?.[0] || {}) : policy;

    if (!config || !config.needsInput?.(targetPolicy)) {
        return null;
    }

    const inputType = typeof config.inputType === 'function' ? config.inputType(targetPolicy) : config.inputType;
    const InputComponent = inputType === 'textarea' ? 'textarea' : 'input';
    
    return (
      <InputComponent
        type={inputType === 'textarea' ? undefined : inputType}
        value={policyValues[key] || ''}
        rows={inputType === 'textarea' ? 5 : undefined}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setPolicyValues(prev => ({ ...prev, [key]: e.target.value }))}
        className="block w-full max-w-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 
 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition px-4 py-2"
        placeholder="Enter required value..."
      />
    );
  };

  // Updated helper function to handle Partial<Policy>
  const resolvePolicyVariables = (text: string, policy: Partial<Policy>): string => {
    if (!text || !text.includes('@')) {
      return text;
    }
    // Match all instances of @VARIABLE@
    return text.replace(/@(\w+)@/g, (match, variableName) => {
      const targetPolicy = policy.check_type === 'CONDITIONAL' ? (policy.condition?.rules?.[0] || {}) : policy;
      if (targetPolicy.variable && targetPolicy.variable.name === variableName) {
        return targetPolicy.variable.default;
      }
      return match; // Return the original placeholder if no match is found
    });
  };

  if (initialLoading) return <div className="text-center p-10 dark:text-white">Loading policies...</div>;
  if (initialError) return <div className="text-center p-10 text-red-500">{initialError}</div>;

  return (
    <div className="container mx-auto px-4 
 sm:px-6 lg:px-8 py-8">
      <div className="mb-4">
        {product.organization_id && (
          <Link to={`/organization/${product.organization_id}`} className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
            ← Back to Organization
          </Link>
        )}
      </div>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6" title={product.name}>
        {product.name}
    
      </h1>

      <div className="flex h-[calc(100vh-12rem)] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">

        <aside className="w-[450px] flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-600">

            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Security Policies</h2>
            <div className="relative mt-4">
              <input
                type="text"
                placeholder="Search policies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2 pl-4 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 
 focus:border-blue-500 text-sm"
              />
            </div>
            <div className="flex justify-between items-center mt-3 text-sm text-gray-500 dark:text-gray-400">
              <span>Showing {filteredPolicies.length} of {policies.length} policies</span>
            </div>
          </div>

          <div className="p-4 border-b border-gray-200 dark:border-gray-600 space-y-3">
            {/* FIX: Added proper null check for templateFeedback */}
            {templateFeedback && (
              <div className={`p-2 rounded-md text-sm text-center 
 ${templateFeedback.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {templateFeedback.message}
              </div>
            )}
            <button
              onClick={handleCreateTemplate}
              
              disabled={selectedForTemplate.size === 0 || isCreatingTemplate}
              className="w-full h-10 px-4 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"

            >
              {isCreatingTemplate ? 'Creating...' : `Create Template (${selectedForTemplate.size})`}
            </button>
            <div className="flex items-center">
              <input
                id="select-all"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-500 text-blue-600 focus:ring-blue-500 bg-gray-100 dark:bg-gray-900"

                checked={isAllSelected}
                onChange={handleSelectAll}
              
                disabled={filteredPolicies.length === 0}
              />
              <label htmlFor="select-all" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                Select All ({filteredPolicies.length} visible)
              </label>
            </div>

          </div>

          <ul className="overflow-y-auto flex-grow">
            {/* FIX: Cast filteredPolicies as an array to resolve TypeScript error */}
            {Array.isArray(filteredPolicies) && filteredPolicies.map((policy: PolicyWithPassedValue) => {
              const displayPolicy = policy.check_type === 'CONDITIONAL' ? (policy.then?.report || policy) : policy;
              const key = getPolicyKey(policy);
              const isSelectedForTemplate = selectedForTemplate.has(key);
              const isSelectedForView = selectedPolicy && getPolicyKey(selectedPolicy) === key;
              return (
                <li key={key} className={`flex items-center transition-colors border-b border-gray-200 dark:border-gray-700 relative ${isSelectedForView ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}>
                  {isSelectedForView && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r-full"></div>}

                  <div className="pl-4">
                    <input
                      type="checkbox"
                      aria-label={`Select policy ${displayPolicy.description}`}
                      className="h-4 w-4 rounded border-gray-300 dark:border-gray-500 text-blue-600 focus:ring-blue-500 bg-gray-100 dark:bg-gray-900"

                      checked={isSelectedForTemplate}
                      onChange={(e) => handleTemplateSelection(key, e.target.checked)}
                   
                    />
                  </div>
                  <button
                    onClick={() => setSelectedPolicy(policy)}

                    className={`w-full text-left p-4 pl-3 text-sm font-medium ${isSelectedForView ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}
                  >
                    {displayPolicy.description}
                  </button>
                </li>
              );
            })}
          </ul>

        </aside>

        <main className="w-2/3 
 overflow-y-auto p-8">
          {!selectedPolicy ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-xl text-gray-500 dark:text-gray-400">Select a policy from the list to view its details.</p>
              </div>
            </div>
          ) : (
            (() => {
                // FIX: Added null check for selectedPolicy
              if (!selectedPolicy) return null; 

              const key = getPolicyKey(selectedPolicy);
              const status = statuses[key];
              const policyToDisplay = selectedPolicy.check_type === 'CONDITIONAL' && selectedPolicy.then?.report ? selectedPolicy.then.report : selectedPolicy;
              const config = selectedPolicyConfig;
      
              const targetPolicy = selectedPolicy.check_type === 'CONDITIONAL' ? (selectedPolicy.condition?.rules?.[0] || {}) : selectedPolicy;
              const showInput = config?.needsInput?.(targetPolicy);

              return (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">

                  <PolicyDetails policyData={policyToDisplay} />

                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Recommended State</h3>
                    <p className="mt-1 text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words">
                      {resolvePolicyVariables(
                      
                        config?.getRecommendedText(targetPolicy) || '',

                        targetPolicy
                      )}
                    </p>
                  </div>

                  {status?.feedback && (
                    <div className={`p-4 mt-4 rounded-md text-sm break-words whitespace-pre-wrap ${status.feedback.type === 'success'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                      {status.feedback.message}
                
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row justify-end items-center gap-4 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                    {showInput &&
                      // FIX: Added null check to renderPolicyInput call
                      renderPolicyInput(selectedPolicy)}

                    {showInput && (
                      <button
                        onClick={() => handleResetValue(selectedPolicy)}
                        disabled={policyValues[key] === defaultPolicyValues[key] || status?.isLoading}
              
                        className="h-12 w-full sm:w-auto px-6 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"

                      >
                        Reset
                      </button>
                    )}
                    <button
                      onClick={() =>
                        handlePolicySubmit(selectedPolicy)}
                      disabled={Object.values(statuses).some(s => s.isLoading)}
 
                      className="h-12 w-full sm:w-auto px-6 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 transition-colors"
                    >
                      {status?.isLoading ? 'Applying...' : 'Apply Policy'}
                    </button>

                  </div>
                </div>
              );
            })()
          )}
        </main>
      </div>
    </div>
  );
  // FIX: Removed trailing semicolon here, fixing the syntax error on line 583
};

export default ProductDetailPage;