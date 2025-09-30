// src/pages/Report/Windows/SystemAudit.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Policy } from '../../../electron-api.d';
import { createReport, ReportPayload, getTemplateDetails, ProductDetails, Template } from '../../../services/authService';
import { ViewerPageProps } from '../../../pages/ProductDetailPage';

// --- Policy Configuration for Auditing ---
const policyTypeConfigs: { [key: string]: any } = {
  // For auditing, we assume the check is performed by a PowerShell script
  // that outputs "STATUS: PASSED" on success. The `setPowershellPolicy` function
  // in main.js handles this check.
  GENERIC_AUDIT: {
    apiCall: async (policy: Policy) => {
      if (!policy.powershell_args) {
        return { success: false, message: 'No PowerShell script provided for this policy.' };
      }
      const result = await window.electronAPI.setPowershellPolicy({ script: policy.powershell_args });
      return { ...result, currentState: result.message };
    },
    getRecommendedText: (policy: Partial<Policy>) => `Expected state: "${policy.value_data}"`,
    getCurrentState: (apiResult: { message: string }) => apiResult.message || 'Could not retrieve state.',
  },
  REGISTRY_SETTING: {
    apiCall: async (policy: Policy) => {
      const command = `reg query "${policy.reg_key}" /v "${policy.reg_item}"`;
      const result = await window.electronAPI.runScript({ script: command });

      if (!result.success) {
        // Handle cases where the key/value doesn't exist, which might be the desired state.
        if (policy.reg_option === 'MUST_NOT_EXIST') {
          return { success: true, currentState: 'Does not exist (Correct)' };
        }
        return { success: false, currentState: `Failed to query registry: ${result.message}` };
      }
      
      // Parse the output to find the current value
      const output = result.message;
      const lines = output.split('\n');
      const valueLine = lines.find(line => line.trim().startsWith(policy.reg_item!));
      
      let currentValue = 'Not Found';
      if (valueLine) {
        const parts = valueLine.trim().split(/\s+/);
        currentValue = parts.slice(2).join(' ');
      }

      // Normalize values for comparison
      const recommendedValue = String(policy.value_data);
      const isDword = policy.value_type === 'POLICY_DWORD';
      
      let isMatch = false;
      if (isDword) {
        const currentNumber = parseInt(currentValue, 16);
        const recommendedNumber = parseInt(recommendedValue, 10);
        isMatch = currentNumber === recommendedNumber;
      } else {
        isMatch = currentValue.toLowerCase() === recommendedValue.toLowerCase();
      }

      return { success: isMatch, currentState: currentValue };
    },
    getRecommendedText: (policy: Partial<Policy>) => `Value should be: ${policy.value_data}`,
  },
  PASSWORD_POLICY: {
    apiCall: async (policy: Policy) => {
        const result = await window.electronAPI.runScript({ script: 'net accounts' });
        if (!result.success) {
            return { success: false, currentState: `Failed to run 'net accounts': ${result.message}` };
        }

        const output = result.message;
        let currentValue = 'N/A';
        let isSuccess = false;

        const policyMap: { [key: string]: { label: string, parser: (line: string) => string } } = {
            'ENFORCE_PASSWORD_HISTORY': { label: 'Length of password history maintained', parser: line => line.split(':')[1].trim().replace('None', '0') },
            'MAXIMUM_PASSWORD_AGE': { label: 'Maximum password age (days)', parser: line => line.split(':')[1].trim() },
            // Add other password policies here
        };

        const target = policyMap[policy.password_policy!];
        if (target) {
            const line = output.split('\n').find(l => l.trim().startsWith(target.label));
            if (line) {
                currentValue = target.parser(line);
                const recommended = policy.value_data.match(/\d+/)?.[0] || '';
                isSuccess = parseInt(currentValue) >= parseInt(recommended);
            }
        }

        return { success: isSuccess, currentState: currentValue };
    },
    getRecommendedText: (policy: Partial<Policy>) => `Should be set to: "${policy.value_data}"`,
  },
};

const getAuditConfigForPolicy = (policy: Policy) => {
    const type = policy.type || (policy.check_type === 'CONDITIONAL' && policy.condition?.rules?.[0]?.type);
    if (type && policyTypeConfigs[type]) {
        return policyTypeConfigs[type];
    }
    if (policy.powershell_args) {
        return policyTypeConfigs.GENERIC_AUDIT;
    }
    return {
        apiCall: () => Promise.resolve({ success: false, message: 'No audit script configured for this policy type.' }),
        getRecommendedText: (p: Partial<Policy>) => `Expected state: "${p.value_data}"`,
    };
};

interface Status {
  isLoading: boolean;
  feedback: { type: 'success' | 'error'; message: string } | null;
}

const getPolicyKey = (policy: Policy): string => {
  const displayPolicy = policy.check_type === 'CONDITIONAL' ? (policy.then?.report || policy) : policy;
  const match = displayPolicy.description.match(/^\d+(\.\d+)+/);
  return match ? match[0] : (displayPolicy?.description || `policy-${Math.random()}`);
};

interface PolicyWithAuditStatus extends Policy {
    audit_status?: 'Passed' | 'Failed' | 'N/A';
    current_state?: string;
}

const PolicyDetails: React.FC<{ policyData: any }> = ({ policyData }) => {
    const displayKeys: { key: keyof Policy; title: string }[] = [
        { key: 'info', title: 'Info' }, { key: 'Note', title: 'Note' },
        { key: 'solution', title: 'Solution' }, { key: 'Impact', title: 'Impact' },
        { key: 'reference', title: 'Reference' }, { key: 'see_also', title: 'See Also' },
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

const SystemAuditPage: React.FC<ViewerPageProps> = ({ product }) => {
  const { id: templateId } = useParams<{ id: string }>();
  const [policies, setPolicies] = useState<PolicyWithAuditStatus[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyWithAuditStatus | null>(null);
  const [statuses, setStatuses] = useState<{ [key: string]: Status }>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditFeedback, setAuditFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedForAudit, setSelectedForAudit] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchPolicies = async () => {
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
            const template: Template = await getTemplateDetails(templateId);
            setTemplateName(`${template.organization_name} - ${template.benchmark_name}`);
            const fetchedPolicies: PolicyWithAuditStatus[] = template.policies.map((p: any) => ({ ...p, audit_status: 'N/A' }));
            setPolicies(fetchedPolicies);
            if (fetchedPolicies.length > 0) {
                 setSelectedPolicy(fetchedPolicies[0]);
                 setSelectedForAudit(new Set(fetchedPolicies.map(getPolicyKey)));
            }
            const initialStatuses: { [key: string]: Status } = {};
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
    return policies.filter((policy: PolicyWithAuditStatus) => {
        const displayPolicy = policy.check_type === 'CONDITIONAL' ? (policy.then?.report || policy) : policy;
        return displayPolicy.description.toLowerCase().includes(lowercasedQuery);
    });
  }, [searchQuery, policies]);

  const isAllSelected = Array.isArray(filteredPolicies) && filteredPolicies.length > 0 && filteredPolicies.every((p: PolicyWithAuditStatus) => selectedForAudit.has(getPolicyKey(p)));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked && Array.isArray(filteredPolicies)) {
        setSelectedForAudit(new Set(filteredPolicies.map(getPolicyKey)));
    } else {
        setSelectedForAudit(new Set());
    }
  };

  const handleSelection = (policyKey: string, isChecked: boolean) => {
    setSelectedForAudit(prev => {
        const newSet = new Set(prev);
        if (isChecked) newSet.add(policyKey); else newSet.delete(policyKey);
        return newSet;
    });
  };
  
  const handleRunAudit = async () => {
    if (selectedForAudit.size === 0) {
        setAuditFeedback({ type: 'error', message: 'Please select at least one policy to audit.' });
        return;
    }
    if (!window.electronAPI) {
      setAuditFeedback({ type: 'error', message: "Electron API is not available. Cannot run audit." });
      return;
    }
    setIsAuditing(true);
    setAuditFeedback(null);
    let successfulPolicies: string[] = [];
    let failedPolicies: string[] = [];
    const finalReportResults: ReportPayload['policies'] = [];
    setStatuses(Object.keys(statuses).reduce((acc, key) => ({ ...acc, [key]: { isLoading: false, feedback: null } }), {}));
    const policiesToAudit = policies.filter(p => selectedForAudit.has(getPolicyKey(p)));
    
    for (const policy of policiesToAudit) {
        const key = getPolicyKey(policy);
        const config = getAuditConfigForPolicy(policy);
        const policyToSubmit = policy.check_type === 'CONDITIONAL' ? (policy.condition?.rules?.[0] || policy) : policy;
        
        setStatuses(prev => ({ ...prev, [key]: { isLoading: true, feedback: null } }));
        try {
            const result = await config.apiCall(policyToSubmit);
            const currentState = result.currentState || result.message;

            if (result.success) {
                successfulPolicies.push(policy.description);
                finalReportResults.push({ name: policy.description, status: 'Passed', current_state: currentState });
                setPolicies(prev => prev.map(p => p.description === policy.description ? { ...p, audit_status: 'Passed', current_state: currentState } : p));
                setStatuses(prev => ({ ...prev, [key]: { isLoading: false, feedback: { type: 'success', message: `Audit Passed. Details: ${currentState}` } } }));
            } else {
                throw new Error(currentState);
            }
        } catch (err: any) {
            failedPolicies.push(policy.description);
            const currentState = err.message || 'Audit Failed';
            finalReportResults.push({ name: policy.description, status: 'Failed', current_state: currentState });
            setPolicies(prev => prev.map(p => p.description === policy.description ? { ...p, audit_status: 'Failed', current_state: currentState } : p));
            setStatuses(prev => ({ ...prev, [key]: { isLoading: false, feedback: { type: 'error', message: `Audit Failed: ${currentState}` } } }));
        }
    }

    try {
        const sysInfo = await window.electronAPI.getSystemInfo();
        if (!sysInfo.success || !sysInfo.serialNumber) {
           throw new Error(sysInfo.message || "Could not retrieve system serial number for reporting.");
        }
        const serialNumber = sysInfo.serialNumber;
        const reportPayload: ReportPayload = { report_type: 'Audit-Report', serial_number: serialNumber, policies: finalReportResults };
        await createReport(templateId!, reportPayload);
        
        if (failedPolicies.length === 0) {
            setAuditFeedback({ type: 'success', message: `Audit completed successfully for ${successfulPolicies.length} policies! Report generated.` });
        } else {
            setAuditFeedback({ type: 'error', message: `Audit completed with ${failedPolicies.length} failure(s). Report generated.` });
        }
    } catch (error: any) {
        setAuditFeedback({ type: 'error', message: `Audit completed. Error during report generation: ${error.message}` });
    } finally {
        setIsAuditing(false);
    }
  };

  if (initialLoading) return <div className="text-center p-10 dark:text-white">Loading audit policies...</div>;
  if (initialError) return <div className="text-center p-10 text-red-500">{initialError}</div>;

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-4">
        <Link to={`/dashboard`} className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
          ← Back to Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2" title={product.name}>
        System Audit for {templateName}
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mb-6 font-mono text-sm">Template ID: {templateId}</p>

      <div className="flex h-[calc(100vh-14rem)] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
        <aside className="w-[450px] flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-600">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Select Policies to Audit</h2>
            <div className="relative mt-4">
              <input type="text" placeholder="Search policies..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2 pl-4 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm" />
            </div>
            <div className="flex justify-between items-center mt-3 text-sm text-gray-500 dark:text-gray-400">
              <span>Showing {filteredPolicies.length} of {policies.length} policies</span>
            </div>
          </div>

          <div className="p-4 border-b border-gray-200 dark:border-gray-600 space-y-3">
            {auditFeedback && (
              <div className={`p-2 rounded-md text-sm text-center ${auditFeedback.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/50' : 'bg-red-100 text-red-800 dark:bg-red-900/50'}`}>
                {auditFeedback.message}
              </div>
            )}
            <button
              onClick={handleRunAudit}
              disabled={isAuditing || selectedForAudit.size === 0}
              className="w-full h-10 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isAuditing ? 'Running Audit...' : `Run Audit on Selected (${selectedForAudit.size})`}
            </button>
            <div className="flex items-center">
              <input id="select-all-audit" type="checkbox"
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-500 text-blue-600 focus:ring-blue-500 bg-gray-100 dark:bg-gray-900"
                checked={isAllSelected} onChange={handleSelectAll} disabled={filteredPolicies.length === 0} />
              <label htmlFor="select-all-audit" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                Select All ({filteredPolicies.length} visible)
              </label>
            </div>
          </div>

          <ul className="overflow-y-auto flex-grow">
            {Array.isArray(filteredPolicies) && filteredPolicies.map((policy: PolicyWithAuditStatus) => {
              const displayPolicy = policy.check_type === 'CONDITIONAL' ? (policy.then?.report || policy) : policy;
              const key = getPolicyKey(policy);
              const isSelectedForView = selectedPolicy && getPolicyKey(selectedPolicy) === key;
              const isSelectedForAction = selectedForAudit.has(key);
              
              let statusColor = 'bg-gray-400';
              if (policy.audit_status === 'Passed') statusColor = 'bg-green-500';
              if (policy.audit_status === 'Failed') statusColor = 'bg-red-500';
              if (isSelectedForView) statusColor = 'bg-blue-600';

              const baseClass = isSelectedForView ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50';

              return (
                <li key={key} className={`flex items-center transition-colors border-b border-gray-200 dark:border-gray-700 relative ${baseClass}`}>
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusColor} rounded-r-full`}></div>
                  
                  <div className="pl-4">
                    <input type="checkbox" aria-label={`Select policy ${displayPolicy.description}`}
                      className="h-4 w-4 rounded border-gray-300 dark:border-gray-500 text-blue-600 focus:ring-blue-500 bg-gray-100 dark:bg-gray-900"
                      checked={isSelectedForAction} onChange={(e) => handleSelection(key, e.target.checked)} />
                  </div>
                  <button onClick={() => setSelectedPolicy(policy)}
                    className={`w-full text-left p-4 pl-3 text-sm font-medium ${isSelectedForView ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {displayPolicy.description}
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
                <p className="text-xl text-gray-500 dark:text-gray-400">Select a policy to view its details.</p>
              </div>
            </div>
          ) : (
            (() => {
                if (!selectedPolicy) return null; 

              const key = getPolicyKey(selectedPolicy);
              const status = statuses[key];
              const policyToDisplay = selectedPolicy.check_type === 'CONDITIONAL' && selectedPolicy.then?.report ? selectedPolicy.then.report : selectedPolicy;
              const config = getAuditConfigForPolicy(selectedPolicy);
              const recommendedState = config.getRecommendedText(policyToDisplay);
              
              return (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
                  <PolicyDetails policyData={policyToDisplay} />
                  <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Audit Status</h3>
                    <div className="mt-2 bg-gray-50 dark:bg-gray-700 p-4 rounded-md space-y-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Recommended State: 
                            <span className="ml-2 font-mono text-gray-600 dark:text-gray-400 break-words">
                                {recommendedState}
                            </span>
                        </p>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Result: 
                            <span className={`ml-2 font-bold ${selectedPolicy.audit_status === 'Passed' ? 'text-green-600' : selectedPolicy.audit_status === 'Failed' ? 'text-red-600' : 'text-gray-500'}`}>
                                {selectedPolicy.audit_status || 'N/A'}
                            </span>
                        </p>
                    </div>
                  </div>
                  
                  {status?.feedback && (
                    <div className={`p-4 mt-4 rounded-md text-sm break-words whitespace-pre-wrap ${status.feedback.type === 'success'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/50' : 'bg-red-100 text-red-800 dark:bg-red-900/50'}`}>
                      <p className="font-bold">{status.feedback.type === 'success' ? 'Details (Passed):' : 'Details (Failed):'}</p>
                      {status.feedback.message}
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </main>
      </div>
    </div>
  );
};

export default SystemAuditPage;