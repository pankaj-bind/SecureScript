// frontend/src/pages/Report/Windows/ApplyHardeing.tsx

import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Policy } from '../../../electron-api.d';
import { createReport, ReportPayload, getTemplateDetails, ProductDetails } from '../../../services/authService';

// Define a generic props type that any viewer component will accept
export interface ViewerPageProps {
  product: ProductDetails;
}

// --- Policy Configuration (Copied from Windows 11 Standalone Viewer) ---
// This configuration defines how to handle each policy type for script generation/application.
const policyTypeConfigs: { [key: string]: any } = {
  USER_RIGHTS_POLICY: {
    apiCall: (policy: Policy, value: string) => window.electronAPI.setUserRight({ privilege: policy.right_type!, value_data: value, policyName: policy.description }),
    getRecommendedText: (policy: Partial<Policy>) => `Should be set to: "${(policy.value_data || 'No users assigned').replace(/"/g, '')}"`,
    needsInput: (policy: Partial<Policy>) => !policy.value_data || (policy.value_data && policy.value_data.includes('&&')),
    inputType: 'textarea',
    // NEW: Function to extract the applied/desired value for reporting (e.g., from the input/default)
    getAppliedValue: (policy: Partial<Policy>, inputValue: string) => {
        // For user rights, the value is typically a list of SIDs/users. We just report what was attempted to be set.
        return inputValue || policy.value_data || 'No One';
    },
  },
  AUDIT_POLICY_SUBCATEGORY: {
    apiCall: (policy: Policy) => window.electronAPI.setAuditPolicy({ subcategory: `"${policy.audit_policy_subcategory!}"`, value_data: policy.value_data }),
    getRecommendedText: (policy: Partial<Policy>) => `Should be set to: "${policy.value_data}"`,
    needsInput: () => false,
    getAppliedValue: (policy: Partial<Policy>) => policy.value_data || 'None',
  },
  PASSWORD_POLICY: {
    apiCall: (policy: Policy, value: string) => window.electronAPI.setAccountPolicy({ policyName: policy.password_policy!, value }),
    getRecommendedText: (policy: Partial<Policy>) => {
        if (['COMPLEXITY_REQUIREMENTS', 'REVERSIBLE_ENCRYPTION', 'LOCKOUT_ADMINS'].includes(policy.password_policy!)) {
            return `Should be set to: "${policy.value_data}"`;
        }
        return `Recommended value is between ${policy.value_data?.replace(/"/g, '')}`;
    },
    needsInput: (policy: Partial<Policy>) => {
        return !['COMPLEXITY_REQUIREMENTS', 'REVERSIBLE_ENCRYPTION', 'LOCKOUT_ADMINS'].includes(policy.password_policy!);
    },
    inputType: 'number',
    getAppliedValue: (policy: Partial<Policy>, inputValue: string) => inputValue || policy.value_data,
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
        return policy.lockout_policy !== 'LOCKOUT_ADMINS';
    },
    inputType: 'number',
    getAppliedValue: (policy: Partial<Policy>, inputValue: string) => inputValue || policy.value_data,
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
    getAppliedValue: (policy: Partial<Policy>, inputValue: string) => inputValue || policy.value_data || 'N/A',
  },
  AUDIT_POWERSHELL: {
    apiCall: (policy: 
 Policy) => window.electronAPI.setPowershellPolicy({ script: policy.powershell_args! }),
    getRecommendedText: () => 'A PowerShell script must be run for this audit.',
    needsInput: () => false,
    getAppliedValue: () => 'Executed Script',
  },
  ANONYMOUS_SID_SETTING: {
    apiCall: (policy: Policy) => window.electronAPI.setSecurityOption({ policy }),
    getRecommendedText: (policy: Partial<Policy>) => `Should be set to: "${policy.value_data}"`,
    needsInput: () => false,
    getAppliedValue: (policy: Partial<Policy>) => policy.value_data || 'None',
  },
  BANNER_CHECK: {
    apiCall: (policy: Policy, value: string) => window.electronAPI.setBannerPolicy({ policy, newValue: value }),
    getRecommendedText: () => 'An appropriate legal banner should be configured.',
    needsInput: () => true,
    inputType: 'textarea',
    getAppliedValue: (policy: Partial<Policy>, inputValue: string) => inputValue || policy.value_data,
  },
  REGISTRY_SETTING: {
    apiCall: (policy: Policy, value: string) => window.electronAPI.setRegistrySetting({ policy, newValue: value }),
    getRecommendedText: (policy: Partial<Policy>) => `Value should be: ${policy.value_data}.`,
    inputType: (policy: Partial<Policy>) => (policy.value_type === 'POLICY_MULTI_TEXT' ? 'textarea' : 'text'),
    needsInput: (policy: Partial<Policy>) => !!policy.variable,
    getAppliedValue: (policy: Partial<Policy>, inputValue: string) => inputValue || policy.value_data,
  },
};
// --- END Policy Configuration ---

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

interface PolicyWithPassedValue extends Policy {
    passed_value?: string;
    custom_value?: string;
}

const PolicyDetails: React.FC<{ policyData: any }> = ({ policyData }) => {
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


const ApplyHardeingPage: React.FC<ViewerPageProps> = ({ product }) => {
  const { id: templateId } = useParams<{ id: string }>(); // Get templateId from the URL
  const [policies, setPolicies] = useState<PolicyWithPassedValue[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyWithPassedValue | null>(null);
  const [statuses, setStatuses] = useState<{ [key: string]: Status }>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  
  // --- PERSISTENCE & RESET LOGIC START ---
  const [policyValues, setPolicyValues] = useState<{ [key: string]: string }>({});
  const [defaultPolicyValues, setDefaultPolicyValues] = useState<{ [key: string]: string }>({});
  const storageKey = useMemo(() => `product-policy-values-${product.id}`, [product.id]);

  // Load template details, policies, set defaults, and load saved values on mount
  useEffect(() => {
    const fetchAndSetupPolicies = async () => {
        setInitialLoading(true);
        setInitialError(null);

        if (!templateId) {
            setInitialError("Template ID is missing.");
            setInitialLoading(false);
            return;
        }

        if (!window.electronAPI) {
            setInitialError('Electron API is not available. This feature requires the desktop app.');
            setInitialLoading(false);
            return;
        }

        try {
            // Fetch template to get the policies and name
            const template = await getTemplateDetails(templateId); 
            setTemplateName(`${template.organization_name} - ${template.benchmark_name}`);

            // Policies come directly from the template policies field
            const fetchedPolicies: PolicyWithPassedValue[] = template.policies.map((p: any) => p as PolicyWithPassedValue);

            setPolicies(fetchedPolicies);
            if (fetchedPolicies.length > 0) setSelectedPolicy(fetchedPolicies[0]);

            const defaultValues: { [key: string]: string } = {};
            const initialStatuses: { [key: string]: Status } = {};

            fetchedPolicies.forEach(policy => {
                const key = getPolicyKey(policy);
                initialStatuses[key] = { isLoading: false, feedback: null };
                const policyType = (policy.check_type === 'CONDITIONAL') ? policy.condition?.rules?.[0]?.type : policy.type;
                const config = policyType ? policyTypeConfigs[policyType] : null;
                const targetPolicy = policy.check_type === 'CONDITIONAL' ? (policy.condition?.rules?.[0] || {}) : policy;

                if (config?.needsInput?.(targetPolicy)) {
                    let defaultValue = '';
                    
                    // Priority 1: Use the value passed in the saved template (custom_value is resolved to passed_value on the backend)
                    if (policy.passed_value) {
                        defaultValue = String(policy.passed_value);
                    } 
                    // Priority 2: Logic from ProductDetailPage to find default/first value
                    else if (targetPolicy.variable?.default) {
                        defaultValue = targetPolicy.variable.default.replace(/\[|\]/g, '').split('..')[0];
                    } else if ((targetPolicy.value_data || "").includes('..')) {
                        defaultValue = targetPolicy.value_data!.match(/\[(\d+)\.\./)?.[1] || targetPolicy.value_data!.split('..')[0];
                    } else if (targetPolicy.value_type === 'POLICY_MULTI_TEXT') {
                        defaultValue = (targetPolicy.value_data || "").split('&&').map(s => s.trim().replace(/"/g, '')).join('\n');
                    } else if (targetPolicy.account_type === 'ADMINISTRATOR_ACCOUNT') {
                        defaultValue = 'LclAdmin';
                    } else if (targetPolicy.account_type === 'GUEST_ACCOUNT') {
                        defaultValue = 'LclGuest';
                    } else if (targetPolicy.value_data) {
                        defaultValue = targetPolicy.value_data.split('||')[0].replace(/"/g, '').trim();
                    }
                  
                  defaultValues[key] = defaultValue;
                }
            });
            
            setDefaultPolicyValues(defaultValues);
            setStatuses(initialStatuses);
            
            // Load saved values from localStorage (optional, but keeps changes if user navigates away)
            const savedValuesRaw = localStorage.getItem(storageKey);
            const savedValues = savedValuesRaw ? JSON.parse(savedValuesRaw) : {};
            setPolicyValues({ ...defaultValues, ...savedValues });


        } catch (err: any) {
            setInitialError(`An error occurred while loading policies: ${err.message}`);
        } finally {
            setInitialLoading(false);
        }
    };
    fetchAndSetupPolicies();
  }, [templateId, storageKey]);

  // Save values to localStorage whenever they change
  useEffect(() => {
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
      setStatuses(prev => ({ ...prev, [key]: { isLoading: false, feedback: null } })); // Clear status
    }
  };
  // --- PERSISTENCE & RESET LOGIC END ---

  const [selectedForApplication, setSelectedForApplication] = useState<Set<string>>(new Set());
  const [isApplyingHardening, setIsApplyingHardening] = useState(false);
  const [applyFeedback, setApplyFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPolicies = useMemo(() => {
    if (!searchQuery.trim()) return policies;
    const lowercasedQuery = searchQuery.toLowerCase();
    return policies.filter((policy: PolicyWithPassedValue) => {
        const displayPolicy = policy.check_type === 'CONDITIONAL' ? (policy.then?.report || policy) : policy;
        return displayPolicy.description.toLowerCase().includes(lowercasedQuery);
    });
  }, [searchQuery, policies]);

  const isAllSelected = Array.isArray(filteredPolicies) && filteredPolicies.length > 0 && filteredPolicies.every((p: PolicyWithPassedValue) => selectedForApplication.has(getPolicyKey(p)));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked && Array.isArray(filteredPolicies)) {
        setSelectedForApplication(new Set(filteredPolicies.map(getPolicyKey)));
    } else {
        setSelectedForApplication(new Set());
    }
  };


  const handleSelection = (policyKey: string, isChecked: boolean) => {
    setSelectedForApplication(prev => {
        const newSet = new Set(prev);
        if (isChecked) newSet.add(policyKey); else newSet.delete(policyKey);
        return newSet;
    });
  };

  const handleApplySelected = async () => {
    if (selectedForApplication.size === 0) {
        setApplyFeedback({ type: 'error', message: 'Please select at least one policy to apply.' });
        return;
    }

    if (!window.electronAPI) {
      setApplyFeedback({ type: 'error', message: "Electron API is not available. Cannot apply hardening." });
      return;
    }

    setIsApplyingHardening(true);
    setApplyFeedback(null);
    let allSucceeded = true;
    let successfulPolicies: string[] = [];
    let failedPolicies: string[] = [];
    
    // UPDATED: Array to hold the final status for the report payload, now including state details
    const finalReportResults: (ReportPayload['policies'][0] & { previous_state: string; current_state: string })[] = [];


    // Reset all statuses before starting the batch application
    setStatuses(Object.keys(statuses).reduce((acc, key) => ({ ...acc, [key]: { isLoading: false, feedback: null } }), {}));


    const policiesToApply = policies.filter(p => selectedForApplication.has(getPolicyKey(p)));
    
    // Step 1: Apply policies individually
    for (const policy of policiesToApply) {
        const key = getPolicyKey(policy);
        const policyType = (policy.check_type === 'CONDITIONAL') ? policy.condition?.rules?.[0]?.type : policy.type;
        const config = policyType ? policyTypeConfigs[policyType] : null;
        const policyToSubmit = policy.check_type === 'CONDITIONAL' ? (policy.condition?.rules?.[0] || policy) : policy;

        // Determine the value that was attempted to be set
        const valueToSubmit = config?.needsInput?.(policyToSubmit) ? policyValues[key] : policyToSubmit.value_data;
        const currentStateValue = config?.getAppliedValue?.(policyToSubmit, valueToSubmit) || 'N/A';
        
        // Placeholder for the actual system's "Previous State" before hardening
        // Using the passed_value from the template as a proxy for the system's previous desired state, 
        // or a simple placeholder string if unavailable.
        // NOTE: For true previous state, a pre-hardening audit function is needed in main.js
        const previousStateValue = policy.passed_value || 'Not Audited (Baseline)'; 
        
        if (!config) {
            allSucceeded = false;
            failedPolicies.push(policy.description);
            finalReportResults.push({ 
                name: policy.description, 
                status: 'Failed',
                previous_state: previousStateValue,
                current_state: currentStateValue
            }); // Collect failure
            setStatuses(prev => ({ ...prev, [key]: { isLoading: false, feedback: { type: 'error', message: 'Invalid policy configuration.' } } }));
            continue;
        }

        // Set loading status for current policy
        setStatuses(prev => ({ ...prev, [key]: { isLoading: true, feedback: null } }));

        try {
            const result = await config.apiCall(policyToSubmit, valueToSubmit);

            if (result.success) {
                successfulPolicies.push(policy.description);
                finalReportResults.push({ 
                    name: policy.description, 
                    status: 'Passed',
                    previous_state: previousStateValue,
                    current_state: currentStateValue 
                }); // Collect success
                setStatuses(prev => ({ ...prev, [key]: { isLoading: false, feedback: { type: 'success', message: `Applied: ${result.message}` } } }));
            } else {
                allSucceeded = false;
                failedPolicies.push(policy.description);
                finalReportResults.push({ 
                    name: policy.description, 
                    status: 'Failed',
                    previous_state: previousStateValue,
                    current_state: currentStateValue 
                }); // Collect failure
                setStatuses(prev => ({ ...prev, [key]: { isLoading: false, feedback: { type: 'error', message: `Failed: ${result.message}` } } }));
            }
        } catch (err: any) {
            allSucceeded = false;
            failedPolicies.push(policy.description);
            finalReportResults.push({ 
                name: policy.description, 
                status: 'Failed',
                previous_state: previousStateValue,
                current_state: currentStateValue 
            }); // Collect failure
            setStatuses(prev => ({ ...prev, [key]: { isLoading: false, feedback: { type: 'error', message: `IPC Error: ${err.message}` } } }));
        }
    }

    // Step 2: Generate Audit Report with results
    try {
        const sysInfo = await window.electronAPI.getSystemInfo(); 
        if (!sysInfo.success || !sysInfo.serialNumber) {
            // Note: The previous logic failed here. This should now be fixed in main.js using PowerShell.
            throw new Error(sysInfo.message || "Could not retrieve system serial number for reporting. Report generation aborted.");
        }
        const serialNumber = sysInfo.serialNumber;
        
        // Use the collected results array for the report payload
        const templatePayload: ReportPayload = {
            report_type: 'Hardening-Report',
            serial_number: serialNumber,
            policies: finalReportResults, // Now contains status, previous_state, and current_state
        };
        
        await createReport(templateId!, templatePayload);
        
        // Final feedback reflects the actual status and mentions report generation
        if (failedPolicies.length === 0) {
            setApplyFeedback({ type: 'success', message: `Hardening applied successfully to ${successfulPolicies.length} policies! A Hardening Report was generated and saved to your dashboard.` });
        } else {
            setApplyFeedback({ type: 'error', message: `Hardening completed with ${failedPolicies.length} failure(s). A Hardening Report was generated and saved to your dashboard.` });
        }

    } catch (error: any) {
        let finalMessage = `Hardening applied. Error during report generation: ${error.message}`;
        if (failedPolicies.length > 0) {
             finalMessage = `Hardening completed with failures. Error during report generation: ${error.message}`;
        } else if (successfulPolicies.length > 0) {
             finalMessage = `Hardening succeeded, but report generation failed: ${error.message}`;
        }
        
        setApplyFeedback({ type: 'error', message: finalMessage });
    } finally {
        setIsApplyingHardening(false);
    }
  };


  const handlePolicySubmit = async (policy: PolicyWithPassedValue) => {
    const key = getPolicyKey(policy);
    const policyType = (policy.check_type === 'CONDITIONAL') ? policy.condition?.rules?.[0]?.type : policy.type;
    const config = policyType ? policyTypeConfigs[policyType] : null;
    const policyToApply = policy.check_type === 'CONDITIONAL' ? (policy.condition?.rules?.[0] || policy) : policy;
    
    if (!config || !policyToApply || !key) {
      setStatuses(prev => ({ ...prev, [key]: { isLoading: false, feedback: { type: 'error', message: 'Invalid policy configuration.' } } }));
      return;
    }

    setStatuses(prev => ({ ...prev, [key]: { isLoading: true, feedback: null } }));

    try {
      const valueToSubmit = config.needsInput(policyToApply) ? policyValues[key] : policyToApply.value_data;
      const result = await config.apiCall(policyToApply, valueToSubmit);
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

  const resolvePolicyVariables = (text: string, policy: Partial<Policy>): string => {
    if (!text || !text.includes('@')) {
      return text;
    }
    return text.replace(/@(\w+)@/g, (match, variableName) => {
      const targetPolicy = policy.check_type === 'CONDITIONAL' ? 
      (policy.condition?.rules?.[0] || {}) : policy;
      if (targetPolicy.variable && targetPolicy.variable.name === variableName) {
        return targetPolicy.variable.default;
      }
      return match; 
    });
  };

  if (initialLoading) return <div className="text-center p-10 dark:text-white">Loading policies...</div>;
  if (initialError) return <div className="text-center p-10 text-red-500">{initialError}</div>;

  return (
    <div className="container mx-auto px-4 
 sm:px-6 lg:px-8 py-8">
      <div className="mb-4">
        <Link to={`/dashboard`} className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
          ← Back to Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2" title={product.name}>
        Apply Hardening for {templateName}
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mb-6 font-mono text-sm">Template ID: {templateId}</p>

      <div className="flex h-[calc(100vh-14rem)] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">

        <aside 
          className="w-[450px] flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-600">

            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Select Policies to Apply</h2>
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
            <div className="flex justify-between items-center mt-3 text-sm 
 text-gray-500 dark:text-gray-400">
              <span>Showing {filteredPolicies.length} of {policies.length} policies</span>
            </div>
          </div>

          <div className="p-4 border-b border-gray-200 dark:border-gray-600 space-y-3">
            {applyFeedback && (
              <div className={`p-2 rounded-md text-sm text-center 
 ${applyFeedback.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/50' : 'bg-red-100 text-red-800 dark:bg-red-900/50'}`}>
                {applyFeedback.message}
              </div>
            )}
            <button
              onClick={handleApplySelected}
              disabled={selectedForApplication.size === 0 || isApplyingHardening}
              className="w-full h-10 px-4 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isApplyingHardening ? 'Applying Hardening...' : `Apply Hardening to Selected (${selectedForApplication.size})`}
            </button>
            <div className="flex items-center">
              <input
                id="select-all-apply"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-500 text-red-600 focus:ring-red-500 bg-gray-100 dark:bg-gray-900"
                checked={isAllSelected}
                onChange={handleSelectAll}
                disabled={filteredPolicies.length === 0}
              />
              <label htmlFor="select-all-apply" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                Select All ({filteredPolicies.length} visible)
              </label>
            </div>

          </div>

          <ul className="overflow-y-auto flex-grow">
            {Array.isArray(filteredPolicies) && filteredPolicies.map((policy: PolicyWithPassedValue) => {
              const displayPolicy = policy.check_type === 'CONDITIONAL' ? (policy.then?.report || policy) : policy;
              const key = getPolicyKey(policy);
              const isSelectedForView = selectedPolicy && getPolicyKey(selectedPolicy) === key;
              const isSelectedForApplication = selectedForApplication.has(key);
              const currentStatus = statuses[key];
              
              const baseClass = isSelectedForView ? 'bg-red-50 dark:bg-red-900/30' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50';
              const indicatorColor = currentStatus?.feedback?.type === 'success' ? 'bg-green-500' : currentStatus?.feedback?.type === 'error' ? 'bg-red-500' : isSelectedForView ? 'bg-red-600' : 'bg-gray-400';

              return (
                <li key={key} className={`flex items-center transition-colors border-b border-gray-200 dark:border-gray-700 relative ${baseClass}`}>
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${indicatorColor} rounded-r-full`}></div>

                  <div className="pl-4">
                    <input
                      type="checkbox"
                      aria-label={`Select policy ${displayPolicy.description}`}
                      className="h-4 w-4 rounded border-gray-300 dark:border-gray-500 text-red-600 focus:ring-red-500 bg-gray-100 dark:bg-gray-900"
                      checked={isSelectedForApplication}
                      onChange={(e) => handleSelection(key, e.target.checked)}
                    />
                  </div>
                  <button
                    onClick={() => setSelectedPolicy(policy)}
                    className={`w-full text-left p-4 pl-3 text-sm font-medium ${isSelectedForView ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}
                  >
                    {displayPolicy.description}
                    {currentStatus?.isLoading && <span className="ml-2 text-xs text-blue-500">(Applying...)</span>}
                    {currentStatus?.feedback && <span className={`ml-2 text-xs ${currentStatus.feedback.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>({currentStatus.feedback.type})</span>}
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
                <p className="text-xl text-gray-500 dark:text-gray-400">Select a policy from the list to view its details and apply individually.</p>
              </div>
            </div>
          ) : (
            (() => {
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
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/50' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                      {status.feedback.message}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row justify-end items-center gap-4 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                    {showInput && renderPolicyInput(selectedPolicy)}

                    {showInput && (
                      <button
                        onClick={() => handleResetValue(selectedPolicy)}
                        disabled={policyValues[key] === defaultPolicyValues[key] || status?.isLoading}
                        className="h-12 w-full sm:w-auto px-6 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 
focus:ring-gray-500 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      onClick={() => handlePolicySubmit(selectedPolicy)}
                      disabled={Object.values(statuses).some(s => s.isLoading)}
                      className="h-12 w-full sm:w-auto px-6 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-red-400 transition-colors"
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
};

export default ApplyHardeingPage;