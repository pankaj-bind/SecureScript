// frontend/src/pages/Report/Windows/RevertHardeing.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Policy } from '../../../electron-api.d';
import { createReport, ReportPayload, getTemplateDetails, Template } from '../../../services/authService';
import { ViewerPageProps } from '../../../pages/ProductDetailPage';

// --- Policy Configuration for Revert ---
const policyTypeConfigs: { [key: string]: any } = {
  USER_RIGHTS_POLICY: {
    apiCall: (policy: Policy, value: string) => window.electronAPI.setUserRight({ privilege: policy.right_type!, value_data: value, policyName: policy.description }),
  },
  AUDIT_POLICY_SUBCATEGORY: {
    apiCall: (policy: Policy) => window.electronAPI.setAuditPolicy({ subcategory: `"${policy.audit_policy_subcategory!}"`, value_data: policy.value_data }),
  },
  PASSWORD_POLICY: {
    apiCall: (policy: Policy, value: string) => window.electronAPI.setAccountPolicy({ policyName: policy.password_policy!, value }),
  },
  LOCKOUT_POLICY: {
    apiCall: (policy: Policy, value: string) => window.electronAPI.setAccountPolicy({ policyName: policy.lockout_policy!, value }),
  },
  CHECK_ACCOUNT: {
    apiCall: (policy: Policy, value: string) => window.electronAPI.setCheckAccount({ policy, newValue: value }),
  },
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
  revert_value?: string;
  passed_value?: string;
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
      <h2 className="text-xl font-semibold text-win-text-primary">{policyData.description}</h2>
      {displayKeys.map(({ key, title }) => (
        policyData[key] && (
          <div key={key} className="mt-4">
            <h3 className="text-sm font-medium text-win-accent mb-1">{title}</h3>
            <p className="text-sm text-win-text-secondary whitespace-pre-wrap break-words leading-relaxed">
              {String(policyData[key])}
            </p>
          </div>
        )
      ))}
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
  const [templateName, setTemplateName] = useState('');
  const [revertScript, setRevertScript] = useState('');

  const [isReverting, setIsReverting] = useState(false);
  const [revertFeedback, setRevertFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedForRevert, setSelectedForRevert] = useState<Set<string>>(new Set());

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
        setRevertScript(template.revert_script || '');

        const fetchedPolicies: PolicyWithRevertStatus[] = template.policies.map((p: any) => ({
          ...p,
          revert_status: 'N/A',
          passed_value: p.passed_value,
        }));

        setPolicies(fetchedPolicies);
        if (fetchedPolicies.length > 0) {
          setSelectedPolicy(fetchedPolicies[0]);
          setSelectedForRevert(new Set(fetchedPolicies.map(getPolicyKey)));
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
    return policies.filter((policy: PolicyWithRevertStatus) => {
      const displayPolicy = policy.check_type === 'CONDITIONAL' ? (policy.then?.report || policy) : policy;
      return displayPolicy.description.toLowerCase().includes(lowercasedQuery);
    });
  }, [searchQuery, policies]);

  const isAllSelected = Array.isArray(filteredPolicies) && filteredPolicies.length > 0 && filteredPolicies.every((p: PolicyWithRevertStatus) => selectedForRevert.has(getPolicyKey(p)));

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
    let successfulPolicies: string[] = [];
    let failedPolicies: string[] = [];
    const finalReportResults: ReportPayload['policies'] = [];

    setStatuses(Object.keys(statuses).reduce((acc, key) => ({ ...acc, [key]: { isLoading: false, feedback: null } }), {}));

    const policiesToRevert = policies.filter(p => selectedForRevert.has(getPolicyKey(p)));

    for (const policy of policiesToRevert) {
      const key = getPolicyKey(policy);
      const policyType = (policy.check_type === 'CONDITIONAL') ? policy.condition?.rules?.[0]?.type : policy.type;
      const config = policyType ? policyTypeConfigs[policyType] : null;
      const policyToSubmit = policy.check_type === 'CONDITIONAL' ? (policy.condition?.rules?.[0] || policy) : policy;

      const valueToSubmit = policyToSubmit.value_data || '';
      const revertValue = policyToSubmit.value_data || 'Default/No One';
      const previousStateValue = 'Hardened (Placeholder)';

      if (!config || (!config.apiCall && policyType !== 'AUDIT_POWERSHELL')) {
        failedPolicies.push(policy.description);
        finalReportResults.push({ name: policy.description, status: 'Failed', previous_state: previousStateValue, current_state: 'Revert handler not configured.' });
        setStatuses(prev => ({ ...prev, [key]: { isLoading: false, feedback: { type: 'error', message: 'Revert handler not configured.' } } }));
        continue;
      }

      setStatuses(prev => ({ ...prev, [key]: { isLoading: true, feedback: null } }));
      try {
        if (policyType === 'AUDIT_POWERSHELL') {
          if (!revertScript) {
            throw new Error('No PowerShell revert script available.');
          }
          const result = await window.electronAPI.runScript({ script: revertScript });

          if (result.success) {
            successfulPolicies.push(policy.description);
            finalReportResults.push({ name: policy.description, status: 'Passed', previous_state: previousStateValue, current_state: 'Reverted (Script Execution)' });
            setPolicies(prev => prev.map(p => p.description === policy.description ? { ...p, revert_status: 'Passed', revert_value: 'Script Execution' } : p));
            setStatuses(prev => ({ ...prev, [key]: { isLoading: false, feedback: { type: 'success', message: `Reverted: ${result.message}` } } }));
          } else {
            throw new Error(result.message);
          }
        } else {
          const result = await config.apiCall(policyToSubmit, valueToSubmit);

          if (result.success) {
            successfulPolicies.push(policy.description);
            finalReportResults.push({ name: policy.description, status: 'Passed', previous_state: previousStateValue, current_state: revertValue });
            setPolicies(prev => prev.map(p => p.description === policy.description ? { ...p, revert_status: 'Passed', revert_value: revertValue } : p));
            setStatuses(prev => ({ ...prev, [key]: { isLoading: false, feedback: { type: 'success', message: `Reverted: ${result.message}` } } }));
          } else {
            throw new Error(result.message);
          }
        }
      } catch (err: any) {
        failedPolicies.push(policy.description);
        finalReportResults.push({ name: policy.description, status: 'Failed', previous_state: previousStateValue, current_state: `Failed: ${err.message}` });
        setPolicies(prev => prev.map(p => p.description === policy.description ? { ...p, revert_status: 'Failed', revert_value: `Failed: ${err.message}` } : p));
        setStatuses(prev => ({ ...prev, [key]: { isLoading: false, feedback: { type: 'error', message: `Failed: ${err.message}` } } }));
      }
    }

    try {
      const sysInfo = await window.electronAPI.getSystemInfo();
      if (!sysInfo.success || !sysInfo.serialNumber) {
        throw new Error(sysInfo.message || "Could not retrieve system serial number for reporting.");
      }

      const reportPayload: ReportPayload = {
        report_type: 'Revert-Hardening-Report',
        serial_number: sysInfo.serialNumber,
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

  if (initialLoading) return (
    <div className="min-h-screen bg-win-bg-solid flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-win-accent border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-sm text-win-text-secondary">Loading policies...</p>
      </div>
    </div>
  );

  if (initialError) return (
    <div className="min-h-screen bg-win-bg-solid flex items-center justify-center">
      <div className="win-card max-w-md text-center">
        <svg className="w-12 h-12 mx-auto text-red-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-sm text-red-400">{initialError}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-win-bg-solid">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <div className="mb-4">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-win-text-secondary hover:text-win-accent transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        {/* Page Title */}
        <h1 className="text-xl font-semibold text-win-text-primary mb-1 truncate" title={product.name}>
          {product.name}
        </h1>
        <p className="text-xs text-win-text-tertiary font-mono mb-4">Template ID: {templateId}</p>

        {/* Main Layout */}
        <div className="flex h-[calc(100vh-10rem)] gap-4">
          {/* Sidebar */}
          <aside className="w-[400px] flex-shrink-0 win-card flex flex-col overflow-hidden">
            {/* Sidebar Header */}
            <div className="p-4 border-b border-win-border-subtle">
              <h2 className="text-sm font-medium text-win-text-primary mb-3">Security Policies</h2>
              {/* Search */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-win-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search policies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="win-input pl-9 text-sm"
                />
              </div>
              <p className="text-xs text-win-text-tertiary mt-2">{filteredPolicies.length} of {policies.length} policies</p>
            </div>

            {/* Actions */}
            <div className="p-4 border-b border-win-border-subtle space-y-3">
              {revertFeedback && (
                <div className={`p-2.5 rounded-win text-xs flex items-center gap-2 ${
                  revertFeedback.type === 'success'
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {revertFeedback.type === 'success' ? (
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  )}
                  {revertFeedback.message}
                </div>
              )}
              <button
                onClick={handleRunRevert}
                disabled={isReverting || selectedForRevert.size === 0}
                className="w-full win-btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isReverting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Reverting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    Revert Hardening ({selectedForRevert.size})
                  </>
                )}
              </button>
              <label className="flex items-center gap-2 text-sm text-win-text-secondary cursor-pointer hover:text-win-text-primary transition-colors">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-win-border-subtle bg-win-bg-layer text-win-accent focus:ring-win-accent/50 focus:ring-offset-0"
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  disabled={filteredPolicies.length === 0}
                />
                Select all ({filteredPolicies.length})
              </label>
            </div>

            {/* Policy List */}
            <ul className="overflow-y-auto flex-grow">
              {Array.isArray(filteredPolicies) && filteredPolicies.map((policy: PolicyWithRevertStatus) => {
                const displayPolicy = policy.check_type === 'CONDITIONAL' ? (policy.then?.report || policy) : policy;
                const key = getPolicyKey(policy);
                const isSelectedForView = selectedPolicy && getPolicyKey(selectedPolicy) === key;
                const isSelectedForAction = selectedForRevert.has(key);

                return (
                  <li key={key} className={`flex items-center border-b border-win-border-subtle transition-colors ${isSelectedForView ? 'bg-win-accent/10' : 'hover:bg-win-bg-subtle/50'}`}>
                    <div className="pl-4">
                      <input
                        type="checkbox"
                        aria-label={`Select policy ${displayPolicy.description}`}
                        className="w-4 h-4 rounded border-win-border-subtle bg-win-bg-layer text-win-accent focus:ring-win-accent/50 focus:ring-offset-0"
                        checked={isSelectedForAction}
                        onChange={(e) => handleSelection(key, e.target.checked)}
                      />
                    </div>
                    <button
                      onClick={() => setSelectedPolicy(policy)}
                      className={`w-full text-left p-3 pl-3 text-sm ${isSelectedForView ? 'text-win-accent font-medium' : 'text-win-text-secondary hover:text-win-text-primary'} transition-colors`}
                    >
                      {displayPolicy.description}
                      {policy.revert_status && policy.revert_status !== 'N/A' && (
                        <span className={`ml-2 text-xs ${policy.revert_status === 'Passed' ? 'text-green-400' : 'text-red-400'}`}>
                          ({policy.revert_status})
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Main Content */}
          <main className="flex-1 win-card overflow-y-auto">
            {!selectedPolicy ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto text-win-text-tertiary mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-win-text-secondary">Select a policy from the list to view details</p>
                </div>
              </div>
            ) : (
              (() => {
                const key = getPolicyKey(selectedPolicy);
                const status = statuses[key];
                const policyToDisplay = selectedPolicy.check_type === 'CONDITIONAL' && selectedPolicy.then?.report ? selectedPolicy.then.report : selectedPolicy;

                return (
                  <div className="p-6 space-y-5">
                    <PolicyDetails policyData={policyToDisplay} />

                    {/* Target Revert State */}
                    <div className="p-4 bg-win-bg-layer rounded-win border border-win-border-subtle">
                      <h3 className="text-sm font-medium text-win-accent mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        Target Revert State
                      </h3>
                      <p className="text-sm text-win-text-secondary whitespace-pre-wrap break-words">
                        {policyToDisplay.value_data || 'Default/Original State'}
                      </p>
                    </div>

                    {/* Revert Result */}
                    {selectedPolicy.revert_status && selectedPolicy.revert_status !== 'N/A' && (
                      <div className={`p-4 rounded-win border ${
                        selectedPolicy.revert_status === 'Passed'
                          ? 'bg-green-500/10 border-green-500/20'
                          : 'bg-red-500/10 border-red-500/20'
                      }`}>
                        <h3 className={`text-sm font-medium mb-2 flex items-center gap-2 ${
                          selectedPolicy.revert_status === 'Passed' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {selectedPolicy.revert_status === 'Passed' ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          Revert Result: {selectedPolicy.revert_status}
                        </h3>
                        {selectedPolicy.revert_value && (
                          <p className={`text-sm font-mono ${selectedPolicy.revert_status === 'Passed' ? 'text-green-300' : 'text-red-300'}`}>
                            Value Used: {selectedPolicy.revert_value}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Feedback */}
                    {status?.feedback && (
                      <div className={`p-3 rounded-win text-sm flex items-start gap-2 ${
                        status.feedback.type === 'success'
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {status.feedback.type === 'success' ? (
                          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        )}
                        <span className="break-words whitespace-pre-wrap">{status.feedback.message}</span>
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default RevertHardeingPage;
