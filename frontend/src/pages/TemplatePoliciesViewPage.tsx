// src/pages/TemplatePoliciesViewPage.tsx
// This page displays template policies for browser users (read-only view)

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTemplateDetails, Template } from '../services/authService';
import { Policy } from '../electron-api.d';

// Policy configuration for display purposes
const policyTypeConfigs: { [key: string]: any } = {
  USER_RIGHTS_POLICY: {
    getRecommendedText: (policy: Partial<Policy>) => `Should be set to: "${(policy.value_data || 'No users assigned').replace(/"/g, '')}"`,
    needsInput: (policy: Partial<Policy>) => !policy.value_data || (policy.value_data && policy.value_data.includes('&&')),
  },
  AUDIT_POLICY_SUBCATEGORY: {
    getRecommendedText: (policy: Partial<Policy>) => `Should be set to: "${policy.value_data}"`,
    needsInput: () => false,
  },
  PASSWORD_POLICY: {
    getRecommendedText: (policy: Partial<Policy>) => {
      if (['COMPLEXITY_REQUIREMENTS', 'REVERSIBLE_ENCRYPTION', 'LOCKOUT_ADMINS'].includes(policy.password_policy!)) {
        return `Should be set to: "${policy.value_data}"`;
      }
      return `Recommended value is between ${policy.value_data?.replace(/"/g, '')}`;
    },
    needsInput: (policy: Partial<Policy>) => !['COMPLEXITY_REQUIREMENTS', 'REVERSIBLE_ENCRYPTION', 'LOCKOUT_ADMINS'].includes(policy.password_policy!),
  },
  LOCKOUT_POLICY: {
    getRecommendedText: (policy: Partial<Policy>) => {
      if (policy.lockout_policy === 'LOCKOUT_ADMINS') {
        return `Should be set to: "${policy.value_data}"`;
      }
      return `Recommended value is between ${policy.value_data?.replace(/"/g, '')}`;
    },
    needsInput: (policy: Partial<Policy>) => policy.lockout_policy !== 'LOCKOUT_ADMINS',
  },
  CHECK_ACCOUNT: {
    getRecommendedText: (policy: Partial<Policy>) => {
      if (policy.value_data === 'Disabled') return 'Account should be disabled.';
      if (policy.check_type === 'CHECK_NOT_EQUAL') return `Account name should not be "${policy.value_data}".`;
      if (policy.check_type === 'CHECK_NOT_REGEX') return `Account name should not match regex "${policy.value_data}".`;
      return 'Check account status or name.';
    },
    needsInput: (policy: Partial<Policy>) => policy.check_type !== 'CHECK_EQUAL',
  },
  AUDIT_POWERSHELL: {
    getRecommendedText: () => 'A PowerShell script must be run for this audit.',
    needsInput: () => false,
  },
  ANONYMOUS_SID_SETTING: {
    getRecommendedText: (policy: Partial<Policy>) => `Should be set to: "${policy.value_data}"`,
    needsInput: () => false,
  },
  BANNER_CHECK: {
    getRecommendedText: () => 'An appropriate legal banner should be configured.',
    needsInput: () => true,
  },
  REGISTRY_SETTING: {
    getRecommendedText: (policy: Partial<Policy>) => `Value should be: ${policy.value_data}.`,
    needsInput: (policy: Partial<Policy>) => !!policy.variable,
  },
};

interface PolicyWithPassedValue extends Policy {
  passed_value?: string;
  custom_value?: string;
}

const getPolicyKey = (policy: Policy): string => {
  const displayPolicy = policy.check_type === 'CONDITIONAL' ? (policy.then?.report || policy) : policy;
  const match = displayPolicy.description.match(/^\d+(\.\d+)+/);
  return match ? match[0] : (displayPolicy?.description || `policy-${Math.random()}`);
};

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

const TemplatePoliciesViewPage: React.FC = () => {
  const { id: templateId } = useParams<{ id: string }>();
  const [template, setTemplate] = useState<Template | null>(null);
  const [policies, setPolicies] = useState<PolicyWithPassedValue[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyWithPassedValue | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInstallModal, setShowInstallModal] = useState(false);

  // Check if running in Electron
  const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

  useEffect(() => {
    const fetchTemplate = async () => {
      if (!templateId) {
        setError('Template ID is missing.');
        setIsLoading(false);
        return;
      }

      try {
        const data = await getTemplateDetails(templateId);
        setTemplate(data);
        
        // Get policies from template
        const templatePolicies: PolicyWithPassedValue[] = data.policies.map((p: any) => p as PolicyWithPassedValue);
        setPolicies(templatePolicies);
        
        if (templatePolicies.length > 0) {
          setSelectedPolicy(templatePolicies[0]);
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load template.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplate();
  }, [templateId]);

  const filteredPolicies = useMemo(() => {
    if (!searchQuery.trim()) return policies;
    const lowercasedQuery = searchQuery.toLowerCase();
    return policies.filter((policy: PolicyWithPassedValue) => {
      const displayPolicy = policy.check_type === 'CONDITIONAL' ? (policy.then?.report || policy) : policy;
      return displayPolicy.description.toLowerCase().includes(lowercasedQuery);
    });
  }, [searchQuery, policies]);

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

  const handleApplyClick = () => {
    if (!isElectron) {
      setShowInstallModal(true);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-win-bg-solid flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-win-accent border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-win-text-secondary">Loading template policies...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-win-bg-solid flex items-center justify-center">
        <div className="win-card max-w-md text-center">
          <svg className="w-12 h-12 mx-auto text-red-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-red-400 mb-4">{error}</p>
          <Link to="/dashboard" className="win-btn-primary">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const selectedPolicyConfig = (() => {
    if (!selectedPolicy) return null;
    const policyType = (selectedPolicy.check_type === 'CONDITIONAL') ? selectedPolicy.condition?.rules?.[0]?.type : selectedPolicy.type;
    return policyType ? policyTypeConfigs[policyType] : null;
  })();

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
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-win-text-primary mb-1">
            {template?.organization_name} - {template?.benchmark_name}
          </h1>
          <p className="text-xs text-win-text-tertiary font-mono">Template ID: {templateId}</p>
        </div>

        {/* Main Layout */}
        <div className="flex h-[calc(100vh-12rem)] gap-4">
          {/* Sidebar */}
          <aside className="w-[400px] flex-shrink-0 win-card flex flex-col overflow-hidden">
            {/* Sidebar Header */}
            <div className="p-4 border-b border-win-border-subtle">
              <h2 className="text-sm font-medium text-win-text-primary mb-3">Template Policies</h2>
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

            {/* Policy List */}
            <ul className="overflow-y-auto flex-grow">
              {filteredPolicies.map((policy: PolicyWithPassedValue) => {
                const displayPolicy = policy.check_type === 'CONDITIONAL' ? (policy.then?.report || policy) : policy;
                const key = getPolicyKey(policy);
                const isSelected = selectedPolicy && getPolicyKey(selectedPolicy) === key;
                return (
                  <li key={key} className={`border-b border-win-border-subtle transition-colors ${isSelected ? 'bg-win-accent/10' : 'hover:bg-win-bg-subtle/50'}`}>
                    <button
                      onClick={() => setSelectedPolicy(policy)}
                      className={`w-full text-left p-3 text-sm ${isSelected ? 'text-win-accent font-medium' : 'text-win-text-secondary hover:text-win-text-primary'} transition-colors`}
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
                const policyToDisplay = selectedPolicy.check_type === 'CONDITIONAL' && selectedPolicy.then?.report 
                  ? selectedPolicy.then.report 
                  : selectedPolicy;
                const config = selectedPolicyConfig;
                const targetPolicy = selectedPolicy.check_type === 'CONDITIONAL' 
                  ? (selectedPolicy.condition?.rules?.[0] || {}) 
                  : selectedPolicy;

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
                        {resolvePolicyVariables(config?.getRecommendedText(targetPolicy) || 'No recommendation available.', targetPolicy)}
                      </p>
                    </div>

                    {/* Passed Value if exists */}
                    {selectedPolicy.passed_value && (
                      <div className="p-4 bg-green-500/10 rounded-win border border-green-500/20">
                        <h3 className="text-sm font-medium text-green-400 mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Configured Value
                        </h3>
                        <p className="text-sm text-green-300 font-mono">{selectedPolicy.passed_value}</p>
                      </div>
                    )}

                    {/* Apply Policy Button - Shows modal in browser */}
                    <div className="flex justify-end pt-4 border-t border-win-border-subtle">
                      <button
                        onClick={handleApplyClick}
                        className="win-btn-primary flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Apply Policy
                      </button>
                    </div>
                  </div>
                );
              })()
            )}
          </main>
        </div>
      </div>

      {/* Install Desktop App Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="win-card max-w-md mx-4 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-win-accent/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-win-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-win-text-primary mb-2">Desktop App Required</h3>
            <p className="text-sm text-win-text-secondary mb-6">
              To apply security policies to your system, please install and use our desktop application. 
              The web version is for viewing and creating templates only.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowInstallModal(false)}
                className="win-btn-secondary"
              >
                Close
              </button>
              <Link
                to="/download"
                className="win-btn-primary inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download App
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplatePoliciesViewPage;
