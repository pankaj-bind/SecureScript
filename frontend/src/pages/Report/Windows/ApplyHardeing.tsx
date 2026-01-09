// frontend/src/pages/Report/Windows/ApplyHardeing.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Policy } from '../../../electron-api.d';
import { createReport, ReportPayload, getTemplateDetails } from '../../../services/authService';
import { ViewerPageProps } from '../../../pages/ProductDetailPage';

// --- Policy Configuration ---
const policyTypeConfigs: { [key: string]: any } = {
  USER_RIGHTS_POLICY: {
    apiCall: (policy: Policy, value: string) => window.electronAPI.setUserRight({ privilege: policy.right_type!, value_data: value, policyName: policy.description }),
    getRecommendedText: (policy: Partial<Policy>) => `Should be set to: "${(policy.value_data || 'No users assigned').replace(/"/g, '')}"`,
    needsInput: (policy: Partial<Policy>) => !policy.value_data || (policy.value_data && policy.value_data.includes('&&')),
    inputType: 'textarea',
    getAppliedValue: (policy: Partial<Policy>, inputValue: string) => inputValue || policy.value_data || 'No One',
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
    needsInput: (policy: Partial<Policy>) => !['COMPLEXITY_REQUIREMENTS', 'REVERSIBLE_ENCRYPTION', 'LOCKOUT_ADMINS'].includes(policy.password_policy!),
    inputType: 'number',
    getAppliedValue: (policy: Partial<Policy>, inputValue: string) => inputValue || policy.value_data,
  },
  LOCKOUT_POLICY: {
    apiCall: (policy: Policy, value: string) => window.electronAPI.setAccountPolicy({ policyName: policy.lockout_policy!, value }),
    getRecommendedText: (policy: Partial<Policy>) => {
      if (policy.lockout_policy === 'LOCKOUT_ADMINS') {
        return `Should be set to: "${policy.value_data}"`;
      }
      return `Recommended value is between ${policy.value_data?.replace(/"/g, '')}`;
    },
    needsInput: (policy: Partial<Policy>) => policy.lockout_policy !== 'LOCKOUT_ADMINS',
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
    apiCall: (policy: Policy) => window.electronAPI.setPowershellPolicy({ script: policy.powershell_args! }),
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

interface Status {
  isLoading: boolean;
  feedback: { type: 'success' | 'error'; message: string } | null;
}

const getPolicyKey = (policy: Policy): string => {
  const displayPolicy = policy.check_type === 'CONDITIONAL' ? (policy.then?.report || policy) : policy;
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

const ApplyHardeingPage: React.FC<ViewerPageProps> = ({ product }) => {
  const { id: templateId } = useParams<{ id: string }>();
  const [policies, setPolicies] = useState<PolicyWithPassedValue[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyWithPassedValue | null>(null);
  const [statuses, setStatuses] = useState<{ [key: string]: Status }>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');

  const [policyValues, setPolicyValues] = useState<{ [key: string]: string }>({});
  const [defaultPolicyValues, setDefaultPolicyValues] = useState<{ [key: string]: string }>({});
  const storageKey = useMemo(() => `product-policy-values-${product.id}`, [product.id]);

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
        const template = await getTemplateDetails(templateId);
        setTemplateName(`${template.organization_name} - ${template.benchmark_name}`);

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

  useEffect(() => {
    if (Object.keys(policyValues).length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(policyValues));
    }
  }, [policyValues, storageKey]);

  const handleResetValue = (policy: PolicyWithPassedValue) => {
    const key = getPolicyKey(policy);
    const defaultValue = defaultPolicyValues[key];
    if (defaultValue !== undefined) {
      setPolicyValues(prev => ({ ...prev, [key]: defaultValue }));
      setStatuses(prev => ({ ...prev, [key]: { isLoading: false, feedback: null } }));
    }
  };

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
    let successfulPolicies: string[] = [];
    let failedPolicies: string[] = [];
    const finalReportResults: (ReportPayload['policies'][0] & { previous_state: string; current_state: string })[] = [];

    setStatuses(Object.keys(statuses).reduce((acc, key) => ({ ...acc, [key]: { isLoading: false, feedback: null } }), {}));

    const policiesToApply = policies.filter(p => selectedForApplication.has(getPolicyKey(p)));

    for (const policy of policiesToApply) {
      const key = getPolicyKey(policy);
      const policyType = (policy.check_type === 'CONDITIONAL') ? policy.condition?.rules?.[0]?.type : policy.type;
      const config = policyType ? policyTypeConfigs[policyType] : null;
      const policyToSubmit = policy.check_type === 'CONDITIONAL' ? (policy.condition?.rules?.[0] || policy) : policy;

      const valueToSubmit = config?.needsInput?.(policyToSubmit) ? policyValues[key] : policyToSubmit.value_data;
      const currentStateValue = config?.getAppliedValue?.(policyToSubmit, valueToSubmit) || 'N/A';
      const previousStateValue = policy.passed_value || 'Not Audited (Baseline)';

      if (!config) {
        failedPolicies.push(policy.description);
        finalReportResults.push({ name: policy.description, status: 'Failed', previous_state: previousStateValue, current_state: currentStateValue });
        setStatuses(prev => ({ ...prev, [key]: { isLoading: false, feedback: { type: 'error', message: 'Invalid policy configuration.' } } }));
        continue;
      }

      setStatuses(prev => ({ ...prev, [key]: { isLoading: true, feedback: null } }));

      try {
        const result = await config.apiCall(policyToSubmit, valueToSubmit);
        if (result.success) {
          successfulPolicies.push(policy.description);
          finalReportResults.push({ name: policy.description, status: 'Passed', previous_state: previousStateValue, current_state: currentStateValue });
          setStatuses(prev => ({ ...prev, [key]: { isLoading: false, feedback: { type: 'success', message: `Applied: ${result.message}` } } }));
        } else {
          failedPolicies.push(policy.description);
          finalReportResults.push({ name: policy.description, status: 'Failed', previous_state: previousStateValue, current_state: currentStateValue });
          setStatuses(prev => ({ ...prev, [key]: { isLoading: false, feedback: { type: 'error', message: `Failed: ${result.message}` } } }));
        }
      } catch (err: any) {
        failedPolicies.push(policy.description);
        finalReportResults.push({ name: policy.description, status: 'Failed', previous_state: previousStateValue, current_state: currentStateValue });
        setStatuses(prev => ({ ...prev, [key]: { isLoading: false, feedback: { type: 'error', message: `IPC Error: ${err.message}` } } }));
      }
    }

    try {
      const sysInfo = await window.electronAPI.getSystemInfo();
      if (!sysInfo.success || !sysInfo.serialNumber) {
        throw new Error(sysInfo.message || "Could not retrieve system serial number for reporting.");
      }

      const templatePayload: ReportPayload = {
        report_type: 'Hardening-Report',
        serial_number: sysInfo.serialNumber,
        policies: finalReportResults,
      };

      await createReport(templateId!, templatePayload);

      if (failedPolicies.length === 0) {
        setApplyFeedback({ type: 'success', message: `Hardening applied successfully to ${successfulPolicies.length} policies! Report generated.` });
      } else {
        setApplyFeedback({ type: 'error', message: `Hardening completed with ${failedPolicies.length} failure(s). Report generated.` });
      }
    } catch (error: any) {
      setApplyFeedback({ type: 'error', message: `Hardening applied. Error during report generation: ${error.message}` });
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

    if (!config || !config.needsInput?.(targetPolicy)) return null;

    const inputType = typeof config.inputType === 'function' ? config.inputType(targetPolicy) : config.inputType;
    const InputComponent = inputType === 'textarea' ? 'textarea' : 'input';

    return (
      <InputComponent
        type={inputType === 'textarea' ? undefined : inputType}
        value={policyValues[key] || ''}
        rows={inputType === 'textarea' ? 5 : undefined}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setPolicyValues(prev => ({ ...prev, [key]: e.target.value }))}
        className="win-input max-w-xs"
        placeholder="Enter required value..."
      />
    );
  };

  const resolvePolicyVariables = (text: string, policy: Partial<Policy>): string => {
    if (!text || !text.includes('@')) return text;
    return text.replace(/@(\w+)@/g, (match, variableName) => {
      const targetPolicy = policy.check_type === 'CONDITIONAL' ? (policy.condition?.rules?.[0] || {}) : policy;
      if (targetPolicy.variable && targetPolicy.variable.name === variableName) {
        return targetPolicy.variable.default;
      }
      return match;
    });
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
              {applyFeedback && (
                <div className={`p-2.5 rounded-win text-xs flex items-center gap-2 ${
                  applyFeedback.type === 'success'
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {applyFeedback.type === 'success' ? (
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  )}
                  {applyFeedback.message}
                </div>
              )}
              <button
                onClick={handleApplySelected}
                disabled={selectedForApplication.size === 0 || isApplyingHardening}
                className="w-full win-btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isApplyingHardening ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Applying...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Apply Hardening ({selectedForApplication.size})
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
              {Array.isArray(filteredPolicies) && filteredPolicies.map((policy: PolicyWithPassedValue) => {
                const displayPolicy = policy.check_type === 'CONDITIONAL' ? (policy.then?.report || policy) : policy;
                const key = getPolicyKey(policy);
                const isSelectedForView = selectedPolicy && getPolicyKey(selectedPolicy) === key;
                const isSelectedForApp = selectedForApplication.has(key);
                return (
                  <li key={key} className={`flex items-center border-b border-win-border-subtle transition-colors ${isSelectedForView ? 'bg-win-accent/10' : 'hover:bg-win-bg-subtle/50'}`}>
                    <div className="pl-4">
                      <input
                        type="checkbox"
                        aria-label={`Select policy ${displayPolicy.description}`}
                        className="w-4 h-4 rounded border-win-border-subtle bg-win-bg-layer text-win-accent focus:ring-win-accent/50 focus:ring-offset-0"
                        checked={isSelectedForApp}
                        onChange={(e) => handleSelection(key, e.target.checked)}
                      />
                    </div>
                    <button
                      onClick={() => setSelectedPolicy(policy)}
                      className={`w-full text-left p-3 pl-3 text-sm ${isSelectedForView ? 'text-win-accent font-medium' : 'text-win-text-secondary hover:text-win-text-primary'} transition-colors`}
                    >
                      {displayPolicy.description}
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
                const config = selectedPolicyConfig;
                const targetPolicy = selectedPolicy.check_type === 'CONDITIONAL' ? (selectedPolicy.condition?.rules?.[0] || {}) : selectedPolicy;
                const showInput = config?.needsInput?.(targetPolicy);

                return (
                  <div className="p-6 space-y-5">
                    <PolicyDetails policyData={policyToDisplay} />

                    {/* Recommended State */}
                    <div className="p-4 bg-win-bg-layer rounded-win border border-win-border-subtle">
                      <h3 className="text-sm font-medium text-win-accent mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Recommended State
                      </h3>
                      <p className="text-sm text-win-text-secondary whitespace-pre-wrap break-words">
                        {resolvePolicyVariables(config?.getRecommendedText(targetPolicy) || '', targetPolicy)}
                      </p>
                    </div>

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

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-4 border-t border-win-border-subtle">
                      {showInput && renderPolicyInput(selectedPolicy)}
                      {showInput && (
                        <button
                          onClick={() => handleResetValue(selectedPolicy)}
                          disabled={policyValues[key] === defaultPolicyValues[key] || status?.isLoading}
                          className="win-btn-secondary w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Reset
                        </button>
                      )}
                      <button
                        onClick={() => handlePolicySubmit(selectedPolicy)}
                        disabled={Object.values(statuses).some(s => s.isLoading)}
                        className="win-btn-primary w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {status?.isLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Applying...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Apply Policy
                          </>
                        )}
                      </button>
                    </div>
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

export default ApplyHardeingPage;
