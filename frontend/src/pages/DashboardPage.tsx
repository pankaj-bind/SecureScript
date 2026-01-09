// src/pages/DashboardPage.tsx

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getTemplates, deleteTemplate, importTemplate, getReportsForTemplate, Template, Report, deleteReport } from '../services/authService';

// Icons
const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
    <svg className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
);

const SearchIcon = () => (
    <svg className="w-4 h-4 text-win-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const ImportIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
);

const DownloadIcon = () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const TrashIcon = () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const ExportIcon = () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

// Component to display reports for a template
const TemplateReports: React.FC<{ reports: Report[], onDelete: (reportId: number) => void }> = ({ reports, onDelete }) => {
    if (reports.length === 0) {
        return (
            <div className="text-center py-6">
                <svg className="w-8 h-8 mx-auto text-win-text-tertiary mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-xs text-win-text-tertiary">No reports generated yet</p>
            </div>
        );
    }
    return (
        <div className="space-y-2">
            {reports.map(report => (
                <div key={report.id} className="flex justify-between items-center bg-win-bg-subtle p-3 rounded-win border border-win-border-subtle">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-win-accent/10 rounded-win">
                            <svg className="w-4 h-4 text-win-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div>
                            <span className="text-sm font-medium text-win-text-primary">{report.filename || `${report.report_type} Report`}</span>
                            <p className="text-xs text-win-text-tertiary mt-0.5">{new Date(report.created_at).toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <a href={report.pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-win-accent bg-win-accent/10 rounded-win hover:bg-win-accent/20 transition-colors">
                            View
                        </a>
                        <a href={report.pdf_url} download className="inline-flex items-center p-1.5 text-green-500 bg-green-500/10 rounded-win hover:bg-green-500/20 transition-colors">
                            <DownloadIcon />
                        </a>
                        <button onClick={() => onDelete(report.id)} className="inline-flex items-center p-1.5 text-red-500 bg-red-500/10 rounded-win hover:bg-red-500/20 transition-colors">
                            <TrashIcon />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

const DashboardPage: React.FC = () => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [feedback, setFeedback] = useState<{
        type: 'success' | 'error', message: string
    } | null>(null);
    const [reports, setReports] = useState<{ [key: string]: Report[] }>({});
    const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    // Check if running in Electron or Browser
    const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const data = await getTemplates();
                setTemplates(data);
            } catch (error) {
                console.error("Failed to fetch templates", error);
                setFeedback({ type: 'error', message: 'Could not load your templates.' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchTemplates();
    }, []);

    const filteredTemplates = useMemo(() => {
        const lowercasedQuery = searchQuery.toLowerCase();
        if (!lowercasedQuery) {
            return templates;
        }
        return templates.filter(template =>
            template.organization_name.toLowerCase().includes(lowercasedQuery) ||
            template.benchmark_name.toLowerCase().includes(lowercasedQuery) ||
            template.id.toLowerCase().includes(lowercasedQuery)
        );
    }, [templates, searchQuery]);

    const toggleTemplateExpansion = async (templateId: string) => {
        const newSet = new Set(expandedTemplates);
        if (newSet.has(templateId)) {
            newSet.delete(templateId);
        } else {
            newSet.add(templateId);
            if (!reports[templateId]) {
                try {
                    const fetchedReports = await getReportsForTemplate(templateId);
                    setReports(prev => ({ ...prev, [templateId]: fetchedReports }));
                } catch (error) {
                    console.error("Failed to fetch reports", error);
                }
            }
        }
        setExpandedTemplates(newSet);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this template?')) {
            try {
                await deleteTemplate(id);
                setTemplates(templates.filter(t => t.id !== id));
            } catch (error) {
                setFeedback({ type: 'error', message: 'Could not delete the template.' });
            }
        }
    };

    const handleDeleteReport = async (templateId: string, reportId: number) => {
        if (window.confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
            try {
                await deleteReport(reportId);
                setReports(prev => {
                    const updatedReportsForTemplate = (prev[templateId] || []).filter(r => r.id !== reportId);
                    return { ...prev, [templateId]: updatedReportsForTemplate };
                });
                setFeedback({ type: 'success', message: 'Report deleted successfully.' });
            } catch (error) {
                console.error("Failed to delete report:", error);
                setFeedback({ type: 'error', message: 'Could not delete the report.' });
            }
        }
    };

    const handleExport = (template: Template) => {
        const dataToExport = {
            organization_name: template.organization_name,
            benchmark_name: template.benchmark_name,
            policies: template.policies,
            harden_script: template.harden_script,
            check_script: template.check_script,
            revert_script: template.revert_script,
        };

        const dataStr = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `template-${template.organization_name.replace(/\s+/g, '-')}-${template.id}.json`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result;
                if (typeof content !== 'string') throw new Error("Invalid file content");
                const templateData = JSON.parse(content);

                if (!templateData.organization_name || !templateData.benchmark_name || !templateData.policies) {
                    throw new Error("Invalid template format.");
                }

                const newTemplate = await importTemplate(templateData);
                setTemplates(prev => [newTemplate, ...prev]);
                setFeedback({ type: 'success', message: 'Template imported successfully!' });
            } catch (error: any) {
                const errorMessage = error.response?.data?.error || error.message || 'Failed to import template.';
                setFeedback({ type: 'error', message: errorMessage });
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    return (
        <div className="min-h-screen bg-win-bg-solid">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Page Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold text-win-text-primary">Dashboard</h1>
                    <p className="mt-1 text-sm text-win-text-secondary">
                        Manage your templates and generate security reports
                    </p>
                </div>

                {/* Main Card */}
                <div className="win-card">
                    {/* Card Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                        <div>
                            <h2 className="text-lg font-semibold text-win-text-primary">Your Templates</h2>
                            <p className="text-xs text-win-text-tertiary mt-0.5">{templates.length} template{templates.length !== 1 ? 's' : ''} total</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Search Input */}
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <SearchIcon />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search templates..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="win-input pl-9 w-64"
                                />
                            </div>
                            {/* Import Button */}
                            <button
                                onClick={handleImportClick}
                                className="win-btn-primary inline-flex items-center gap-2"
                            >
                                <ImportIcon />
                                Import
                            </button>
                            <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".json" className="hidden" />
                        </div>
                    </div>

                    {/* Feedback Message */}
                    {feedback && (
                        <div className={`mb-4 p-3 rounded-win text-sm flex items-center gap-2 ${
                            feedback.type === 'success' 
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                            {feedback.type === 'success' ? (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            )}
                            {feedback.message}
                        </div>
                    )}

                    {/* Loading State */}
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <div className="w-8 h-8 border-2 border-win-accent border-t-transparent rounded-full animate-spin mb-3"></div>
                            <p className="text-sm text-win-text-tertiary">Loading templates...</p>
                        </div>
                    ) : (
                        /* Table */
                        <div className="overflow-x-auto rounded-win border border-win-border-subtle">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-win-bg-layer border-b border-win-border-subtle">
                                        <th className="px-4 py-3 text-left text-xs font-medium text-win-text-secondary uppercase tracking-wider">Template ID</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-win-text-secondary uppercase tracking-wider">Organization</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-win-text-secondary uppercase tracking-wider">Benchmark</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-win-text-secondary uppercase tracking-wider">Policies</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-win-text-secondary uppercase tracking-wider">{isElectron ? 'Reports' : 'View'}</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-win-text-secondary uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-win-border-subtle">
                                    {filteredTemplates.length > 0 ? filteredTemplates.map((template) => (
                                        <React.Fragment key={template.id}>
                                            <tr className="hover:bg-win-bg-subtle/50 transition-colors">
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <button 
                                                        onClick={() => toggleTemplateExpansion(template.id)} 
                                                        className="inline-flex items-center gap-2 text-win-text-primary hover:text-win-accent transition-colors"
                                                    >
                                                        <ChevronIcon isOpen={expandedTemplates.has(template.id)} />
                                                        <span className="text-xs font-mono bg-win-bg-layer px-2 py-0.5 rounded">{template.id}</span>
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-win-text-primary font-medium">{template.organization_name}</td>
                                                <td className="px-4 py-3 max-w-xs text-sm text-win-text-secondary truncate" title={template.benchmark_name}>{template.benchmark_name}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-win-accent/10 text-win-accent">
                                                        {template.policy_count}
                                                    </span>
                                                </td>
                                                {isElectron ? (
                                                    <td className="px-4 py-3 whitespace-nowrap text-center">
                                                        <div className="inline-flex items-center gap-1">
                                                            <Link to={`/report/harden/${template.id}`} className="px-2.5 py-1 text-xs font-medium text-red-400 bg-red-500/10 rounded-win hover:bg-red-500/20 transition-colors" title="Harden Report">
                                                                Harden
                                                            </Link>
                                                            <Link to={`/report/audit/${template.id}`} className="px-2.5 py-1 text-xs font-medium text-win-text-secondary bg-win-bg-layer rounded-win hover:bg-win-bg-subtle transition-colors" title="Audit Report">
                                                                Audit
                                                            </Link>
                                                            <Link to={`/report/revert/${template.id}`} className="px-2.5 py-1 text-xs font-medium text-orange-400 bg-orange-500/10 rounded-win hover:bg-orange-500/20 transition-colors" title="Revert Report">
                                                                Revert
                                                            </Link>
                                                        </div>
                                                    </td>
                                                ) : (
                                                    <td className="px-4 py-3 whitespace-nowrap text-center">
                                                        <Link 
                                                            to={`/template/view/${template.id}`} 
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-win-accent bg-win-accent/10 rounded-win hover:bg-win-accent/20 transition-colors" 
                                                            title="View Policies"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                            </svg>
                                                            View Policies
                                                        </Link>
                                                    </td>
                                                )}
                                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                                    <div className="inline-flex items-center gap-1">
                                                        <button 
                                                            onClick={() => handleExport(template)} 
                                                            className="p-1.5 text-green-400 bg-green-500/10 rounded-win hover:bg-green-500/20 transition-colors"
                                                            title="Export Template"
                                                        >
                                                            <ExportIcon />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(template.id)} 
                                                            className="p-1.5 text-red-400 bg-red-500/10 rounded-win hover:bg-red-500/20 transition-colors"
                                                            title="Delete Template"
                                                        >
                                                            <TrashIcon />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {/* Expanded Reports Section - Only show in Electron */}
                                            {isElectron && expandedTemplates.has(template.id) && (
                                                <tr>
                                                    <td colSpan={6} className="px-4 py-4 bg-win-bg-subtle">
                                                        <div className="pl-6 border-l-2 border-win-accent/40">
                                                            <h4 className="text-sm font-medium text-win-text-primary mb-3 flex items-center gap-2">
                                                                <svg className="w-4 h-4 text-win-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                </svg>
                                                                Generated Reports
                                                            </h4>
                                                            <TemplateReports
                                                                reports={reports[template.id] || []}
                                                                onDelete={(reportId) => handleDeleteReport(template.id, reportId)}
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    )) : (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-16 text-center">
                                                <svg className="w-12 h-12 mx-auto text-win-text-tertiary mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                <p className="text-sm text-win-text-tertiary">
                                                    {searchQuery ? 'No templates match your search' : 'No templates created yet'}
                                                </p>
                                                {!searchQuery && (
                                                    <p className="text-xs text-win-text-tertiary mt-1">
                                                        Create a template from a benchmark to get started
                                                    </p>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;