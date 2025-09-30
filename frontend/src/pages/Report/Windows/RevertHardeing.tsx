// frontend/src/pages/Report/Windows/RevertHardeing.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Policy } from '../../../electron-api.d';
import { createReport, ReportPayload, getTemplateDetails, ProductDetails, Template } from '../../../services/authService';
import { ViewerPageProps } from '../../../pages/ProductDetailPage';

// --- Policy Configuration (Scripts for Revert execution) ---
// This configuration defines how to handle each policy type for direct application/reversion.
const policyTypeConfigs: { [key: string]: any } = {
  // Generic helper function to get the value that was *set* during hardening.
  getAppliedValue: (policy: Partial<Policy>) => policy.passed_value || policy.value_data || 'N/A',
  
 
  USER_RIGHTS_POLICY: {
    // API call uses the value (which is the original state) to set the policy back.
    apiCall: (policy: Policy, value: string) => window.electronAPI.setUserRight({ privilege: policy.right_type!, value_data: value, policyName: policy.description }),
  },
  AUDIT_POLICY_SUBCATEGORY: {
    apiCall: (policy: Policy) => window.electronAPI.setAuditPolicy({ subcategory: `"${policy.audit_policy_subcategory!}"`, value_data: policy.value_data }),
  },
  PASSWORD_POLICY: {
    apiCall: (policy: Policy, value: string) => window.electronAPI.setAccountPolicy({ policyName: policy.password_policy!, value }),
  },
  LOCKOUT_POLICY: {
    apiCall: (policy: Policy, value: string) => window.electronAPI.setAccountPolicy({ 
 policyName: policy.lockout_policy!, value }),
  },
  CHECK_ACCOUNT: {
    apiCall: (policy: Policy, value: string) => window.electronAPI.setCheckAccount({ policy, newValue: value }),
  },
  // REMOVED: AUDIT_POWERSHELL configuration. This will be handled in handleRunRevert where 'revertScript' is in scope.
  ANONYMOUS_SID_SETTING: {
    apiCall: (policy: Policy) => window.electronAPI.setSecurityOption({ policy }),
  },
  BANNER_CHECK: {
    apiCall: (policy: Policy, value: string) => window.electronAPI.setBannerPolicy({ policy, newValue: value }),
  },
 
  REGISTRY_SETTING: {
    apiCall: (policy: Policy, value: string) => window.electronAPI.setRegistrySetting({ policy, newValue: value }),
  },
};
// --- END Policy Configuration ---

interface Status {
  isLoading: boolean;
  feedback: { type: 'success' | 'error'; message: string } | null;
}

const getPolicyKey = (policy: Policy): string => {
  const displayPolicy = policy.check_type === 'CONDITIONAL' ? (policy.then?.report || policy) : policy;
  const match = displayPolicy.description.match(/^\d+(\.\d+)+/);
  return match ? match[0] : (displayPolicy?.description || `policy-${Math.random()}`);
};

interface PolicyWithRevertStatus extends Policy {
    revert_status?: 'Passed' | 'Failed' | 'N/A';
    revert_value?: string; // The value used to revert the policy
    passed_value?: string; // Re-introduced for clarity in using original values
}

const PolicyDetails: React.FC<{ policyData: any }> = ({ policyData }) => {
    // Re-use PolicyDetails structure
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
                policyData[key] 
 && (
                    <div key={key}>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-4">{title}</h3>
                        <p className="mt-1 text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words">
                          
{String(policyData[key])}
                        </p>
         
            </div>
                )
            ))}
             <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-4">Target Revert State</h3>
             <p className="mt-1 text-gray-600 
 dark:text-gray-400 whitespace-pre-wrap break-words">
                {policyData.value_data || 'N/A (The original compliant state)'}
            </p>
        </>
    );
};


const RevertHardeingPage: React.FC<ViewerPageProps> = ({ product }) => {
  const { id: templateId } = useParams<{ id: string }>();
  const [policies, setPolicies] = useState<PolicyWithRevertStatus[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyWithRevertStatus | null>(null);
  const [statuses, setStatuses] = useState<{ [key: string]: Status }>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [templateName, 
setTemplateName] = useState('');
  const [revertScript, setRevertScript] = useState(''); // NEW state to hold the revert script
  
  const [isReverting, setIsReverting] = useState(false);
  const [revertFeedback, setRevertFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedForRevert, setSelectedForRevert] = useState<Set<string>>(new Set());

  // Load policies from the template on mount
  useEffect(() => {
    const fetchPolicies = async () => {
        setInitialLoading(true);
        setInitialError(null);

        if (!templateId) {
            setInitialError("Template ID is missing.");
            setInitialLoading(false);
    
         return;
        }

        try {
            const template: Template = await getTemplateDetails(templateId);
            setTemplateName(`${template.organization_name} - ${template.benchmark_name}`);
            setRevertScript(template.revert_script || ''); // Set the revert script
            
  
           // Policies come directly from the template policies field
            const fetchedPolicies: PolicyWithRevertStatus[] = template.policies.map((p: any) => ({
                 ...p,
                 revert_status: 'N/A', // Initialize status
                 passed_value: p.passed_value, // Ensure passed_value is carried through
             }));

            setPolicies(fetchedPolicies);
            if (fetchedPolicies.length > 0) {
                 setSelectedPolicy(fetchedPolicies[0]);
                 setSelectedForRevert(new Set(fetchedPolicies.map(getPolicyKey))); // Select all by default
     
            }
            
            // Initialize statuses for the UI indicators
            const initialStatuses: { [key: string]: 
Status } = {};
            fetchedPolicies.forEach(policy => {
                initialStatuses[getPolicyKey(policy)] = { isLoading: false, feedback: null };
            });
            setStatuses(initialStatuses);

        } catch (err: any) {
            setInitialError(`An error occurred while loading template details: ${err.message}`);
        } finally {
           
 setInitialLoading(false);
        }
    };
    fetchPolicies();
  }, [templateId]);


  const filteredPolicies = useMemo(() => {
    if (!searchQuery.trim()) return policies;
    const lowercasedQuery = searchQuery.toLowerCase();
    return policies.filter((policy: PolicyWithRevertStatus) => {
        const displayPolicy = policy.check_type === 'CONDITIONAL' ? (policy.then?.report || policy) : policy;
        return displayPolicy.description.toLowerCase().includes(lowercasedQuery);
    });
  }, [searchQuery, policies]);

  const isAllSelected = Array.isArray(filteredPolicies) && filteredPolicies.length > 0 
 && filteredPolicies.every((p: PolicyWithRevertStatus) => selectedForRevert.has(getPolicyKey(p)));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked && Array.isArray(filteredPolicies)) {
        setSelectedForRevert(new Set(filteredPolicies.map(getPolicyKey)));
    } else {
        setSelectedForRevert(new Set());
    }
  };

  const handleSelection = (policyKey: string, isChecked: boolean) => {
  
  setSelectedForRevert(prev => {
        const newSet = new Set(prev);
        if (isChecked) newSet.add(policyKey); else newSet.delete(policyKey);
        return newSet;
    });
  };
  
  const handleRunRevert = async () => {
    if (selectedForRevert.size === 0) {
        setRevertFeedback({ type: 'error', message: 'Please select at least one policy to revert.' });
        return;
 }

    if (!window.electronAPI) {
      setRevertFeedback({ type: 'error', message: "Electron API is not available. Cannot revert hardening." });
      return;
    }

    setIsReverting(true);
    setRevertFeedback(null);
    let allSucceeded = true;
    let successfulPolicies: string[] = [];
    let failedPolicies: string[] = [];
    
    // Array to hold the final status for the report payload
    const finalReportResults: ReportPayload['policies'] = [];

    // Reset all statuses before starting the batch application
    setStatuses(Object.keys(statuses).reduce((acc, key) => ({ ...acc, [key]: { isLoading: false, feedback: null } }), {}));


    const policiesToRevert = policies.filter(p => selectedForRevert.has(getPolicyKey(p)));
    
    // Step 1: Revert policies individually
    for (const policy of policiesToRevert) {
        const key = getPolicyKey(policy);
        const policyType = (policy.check_type === 'CONDITIONAL') ? policy.condition?.rules?.[0]?.type : policy.type;
        const config = policyType ?
policyTypeConfigs[policyType] : null;
        const policyToSubmit = policy.check_type === 'CONDITIONAL' ? (policy.condition?.rules?.[0] || policy) : policy;

        // The value used for reversion is the original compliant/default value (policy.value_data)
        const valueToSubmit = policyToSubmit.value_data || '';
        const revertValue = policyToSubmit.value_data || 'Default/No One'; 
        
        // Placeholder: The state of the system *before* reverting (i.e., the hardened state)
        const previousStateValue = 'Hardened (Placeholder)'; 
        
        if (!config || (!config.apiCall && policyType !== 'AUDIT_POWERSHELL')) {

             allSucceeded = false;
            failedPolicies.push(policy.description);
            finalReportResults.push({ 
                name: policy.description, 
                status: 'Failed',
                previous_state: previousStateValue,
             current_state: 'Revert handler not configured.'
            }); 
            setStatuses(prev => ({ ...prev, [key]: { isLoading: false, feedback: { type: 'error', message: 'Revert handler not configured.' } } }));
            continue;
        }

        setStatuses(prev => ({ ...prev, [key]: { isLoading: true, feedback: null } }));
        try {
            // Special handling for AUDIT_POWERSHELL: Run the entire revert script if selected
            if (policyType === 'AUDIT_POWERSHELL') {
                 if (!revertScript) {
                    throw new Error('No PowerShell revert script available.');
                }
                 const result = await window.electronAPI.runScript({ script: revertScript });
                 
                 if (result.success) {
                    successfulPolicies.push(policy.description);
                    finalReportResults.push({ 
                        name: policy.description, 
                        status: 'Passed',
       
                  previous_state: previousStateValue,
                        current_state: 'Reverted (Script Execution)'
                    });
                    setPolicies(prev => prev.map(p => p.description === policy.description ? { ...p, revert_status: 'Passed', revert_value: 'Script Execution' } : p));
                    setStatuses(prev => ({ ...prev, [key]: { isLoading: false, feedback: { type: 'success', message: `Reverted: ${result.message}` } } }));
                 } else {
                    throw new Error(result.message);
                 }
                
            } else {
                
                const result = await config.apiCall(policyToSubmit, valueToSubmit);

                if (result.success) {
                    
                    successfulPolicies.push(policy.description);
                    finalReportResults.push({ 
             
             name: policy.description, 
                        status: 'Passed',
                        previous_state: previousStateValue,
                        current_state: revertValue // The state after successful reversion
                    });
                    setPolicies(prev => prev.map(p => p.description === policy.description ? { ...p, revert_status: 'Passed', revert_value: revertValue } : p));
                    setStatuses(prev => ({ ...prev, [key]: { isLoading: false, feedback: { type: 'success', message: `Reverted: ${result.message}` } } }));
                } else {
                    throw new Error(result.message);
                }
            }
        } catch (err: any) {
 
            allSucceeded = false;
            failedPolicies.push(policy.description);
            finalReportResults.push({ 
                name: policy.description, 
                status: 'Failed',
                previous_state: previousStateValue,
             current_state: `Failed: ${err.message}`
            }); 
            setPolicies(prev => prev.map(p => p.description === policy.description ? { ...p, revert_status: 'Failed', revert_value: `Failed: ${err.message}` } : p));
            setStatuses(prev => ({ ...prev, [key]: { isLoading: false, feedback: { type: 'error', message: `Failed: ${err.message}` } } }));
        }
    }

    // Step 2: Generate Report
    try {
        const sysInfo = await window.electronAPI.getSystemInfo();
        if (!sysInfo.success || !sysInfo.serialNumber) {
  
           throw new Error(sysInfo.message || "Could not retrieve system serial number for reporting.");
        }
        const serialNumber = sysInfo.serialNumber;
        
        const reportPayload: ReportPayload = {
          
          report_type: 'Revert-Hardening-Report',
            serial_number: serialNumber,
            policies: finalReportResults,
       
  };
        
        await createReport(templateId!, reportPayload);
        
        if (failedPolicies.length === 0) {
            setRevertFeedback({ type: 'success', message: `Reversion applied successfully to ${successfulPolicies.length} policies! Report generated.` });
        } else {
            setRevertFeedback({ type: 'error', message: `Reversion completed with ${failedPolicies.length} failure(s). Report generated.` });
        }

    } catch (error: any) {
        setRevertFeedback({ type: 'error', message: `Reversion applied. Error during report generation: ${error.message}` });
    } finally {
        setIsReverting(false);
    }
  };


  const selectedPolicyConfig = useMemo(() => {
    if (!selectedPolicy) return null;
    const policyType = (selectedPolicy.check_type === 'CONDITIONAL') ? selectedPolicy.condition?.rules?.[0]?.type : selectedPolicy.type;
    
 return policyType ? policyTypeConfigs[policyType] : null;
  }, [selectedPolicy]);

  if (initialLoading) return <div className="text-center p-10 dark:text-white">Loading policies...</div>;
  if (initialError) return <div className="text-center p-10 text-red-500">{initialError}</div>;

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-4">
      
      <Link to={`/dashboard`} className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
          ← Back to Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2" title={product.name}>
        Revert Hardening for {templateName}
      </h1>
      <p 
 className="text-gray-500 dark:text-gray-400 mb-6 font-mono text-sm">Template 
 ID: {templateId}</p>

      <div className="flex h-[calc(100vh-14rem)] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">

        <aside className="w-[450px] flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-600">

            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Select Policies to Revert</h2>
            <div className="relative mt-4">
            
   <input
                type="text"
                placeholder="Search policies..."
            
     value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2 pl-4 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
  
           <div className="flex justify-between items-center mt-3 text-sm text-gray-500 dark:text-gray-400">
              <span>Showing {filteredPolicies.length} of {policies.length} policies</span>
            </div>
          </div>

          <div className="p-4 border-b border-gray-200 dark:border-gray-600 space-y-3">
            {revertFeedback && (
     
          <div className={`p-2 rounded-md text-sm text-center 
 ${revertFeedback.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/50' : 'bg-red-100 text-red-800 dark:bg-red-900/50'}`}>
                {revertFeedback.message}
      
         </div>
            )}
            <button
              onClick={handleRunRevert}
              disabled={isReverting || selectedForRevert.size === 0}
              
 className="w-full h-10 px-4 bg-orange-600 text-white font-semibold rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isReverting ? 'Reverting...' : `Revert Selected Policies (${selectedForRevert.size})`}
            </button>
            <div className="flex items-center">
              <input
   
              id="select-all-revert"
                type="checkbox"
                className="h-4 w-4 
rounded border-gray-300 dark:border-gray-500 text-orange-600 focus:ring-orange-500 bg-gray-100 dark:bg-gray-900"
                checked={isAllSelected}
                onChange={handleSelectAll}
                disabled={filteredPolicies.length === 0}
              />
         
      <label htmlFor="select-all-revert" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                Select All ({filteredPolicies.length} visible)
              </label>
            </div>

          </div>

          <ul className="overflow-y-auto flex-grow">
           
  {Array.isArray(filteredPolicies) && filteredPolicies.map((policy: PolicyWithRevertStatus) => {
              const displayPolicy = policy.check_type === 'CONDITIONAL' ? (policy.then?.report || policy) : policy;
              const key = getPolicyKey(policy);
              const isSelectedForView = selectedPolicy && getPolicyKey(selectedPolicy) === key;
              const isSelectedForAction = 
selectedForRevert.has(key);
              
              let statusColor = 'bg-gray-400';
              if (policy.revert_status === 'Passed') statusColor = 'bg-green-500';
              if (policy.revert_status === 'Failed') statusColor = 'bg-red-500';

              const baseClass = isSelectedForView ? 'bg-orange-50 dark:bg-orange-900/30' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50';

              return (
                <li key={key} className={`flex items-center transition-colors border-b border-gray-200 dark:border-gray-700 relative ${baseClass}`}>
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusColor} 
 rounded-r-full`}></div>
                  
                  <div className="pl-4">
                    <input
                      type="checkbox"
         
              aria-label={`Select policy ${displayPolicy.description}`}
                      className="h-4 w-4 rounded border-gray-300 dark:border-gray-500 text-orange-600 focus:ring-orange-500 bg-gray-100 dark:bg-gray-900"
  
                     checked={isSelectedForAction}
                      onChange={(e) => handleSelection(key, e.target.checked)}
                    />
                
   </div>

                  <button
                    onClick={() => setSelectedPolicy(policy)}
                    className={`w-full text-left p-4 pl-3 text-sm font-medium ${isSelectedForView ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'}`}
             
          >
                    {displayPolicy.description}
                  
   {policy.revert_status && (
                        <span className={`ml-2 text-xs font-semibold ${policy.revert_status === 'Passed' ? 'text-green-500' : policy.revert_status === 'Failed' ? 'text-red-500' : 'text-gray-500'}`}>
                            ({policy.revert_status})
              
           </span>
                    )}
                  </button>
                </li>
              );
            })}
       
    </ul>

        </aside>

        <main className="w-2/3 overflow-y-auto p-8">
          {!selectedPolicy ? (
         
          <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-xl text-gray-500 dark:text-gray-400">Select policies to revert or run the full reversion process.</p>
              </div>
            </div>
          ) 
 : (
            (() => {
                if (!selectedPolicy) return null; 

              const policyToDisplay = selectedPolicy.check_type === 'CONDITIONAL' && selectedPolicy.then?.report ? selectedPolicy.then.report : selectedPolicy;

              return (
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">

                  <PolicyDetails policyData={policyToDisplay} />

        
           {/* Display Revert Results if available */}
                  <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Revert Execution Status</h3>
                    
      
               <div className="mt-2 bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Status: 
        
                     <span className={`ml-2 font-bold ${selectedPolicy.revert_status === 'Passed' ? 'text-green-600' : selectedPolicy.revert_status === 'Failed' ? 'text-red-600' : 'text-gray-500'}`}>
     
                            {selectedPolicy.revert_status || 'N/A'}
                            </span>
                        </p>
           
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-2">
                            Revert Value Used: 
                            <span className="ml-2 font-mono text-gray-600 dark:text-gray-400 break-words">
 
                                {selectedPolicy.revert_value || 'Run reversion first.'}
     
                        </span>
                        </p>
                    </div>
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

export default RevertHardeingPage;