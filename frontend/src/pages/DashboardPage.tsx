// src/pages/DashboardPage.tsx

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getTemplates, deleteTemplate, importTemplate, createReport, getReportsForTemplate, Template, Report, ReportPayload, deleteReport } from '../services/authService';

// --- Interface for the Electron API exposed on the window object
interface ElectronApi {
    applyHarden: (script: string) => Promise<string>;
    checkStatus: (script: string, reg_option?: string) => Promise<string>; // Modified to accept optional parameter
    revertHardening: (script: string) => Promise<string>;
    getSystemInfo: () => Promise<{ serialNumber: string; username: string }>;
}

// --- Extend the global Window interface
declare global {
    interface Window {
        electron: ElectronApi;
    }
}

// --- Component to display reports for a template ---
const TemplateReports: React.FC<{ reports: Report[], onDelete: (reportId: number) => void }> = ({ reports, onDelete }) => {
    if (reports.length === 0) {
        return <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">No reports generated yet.</p>;
    }
    return (
        <div className="mt-2 space-y-2">
            {reports.map(report => (
                <div key={report.id} className="flex justify-between items-center bg-gray-100 dark:bg-gray-700 p-2 rounded">
                    <div>
                        <span className="text-sm font-semibold">{report.filename || `${report.report_type} Report`}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">{new Date(report.created_at).toLocaleString()}</span>
                    </div>
                    <div>
                        <a href={report.pdf_url} target="_blank" rel="noopener noreferrer" className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 mr-2">View</a>
                        <a href={report.pdf_url} download className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700">Download</a>
                        <button
                            onClick={() => onDelete(report.id)}
                            className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 ml-2"
                        >
                            Delete
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
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [executingTemplateId, setExecutingTemplateId] = useState<string | null>(null);
    const [reports, setReports] = useState<{ [key: string]: Report[] }>({});
    const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

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

    const handleGenerateReport = async (template: Template, action: 'Harden' | 'Audit' | 'Revert') => {
        setExecutingTemplateId(template.id);
        setFeedback(null);

        let script: string | undefined;
        let electronAction: keyof Omit<ElectronApi, 'getSystemInfo' | 'checkStatus'> | 'checkStatus';

        const reportTypeMapping = {
            'Harden': 'Hardening-Report',
            'Audit': 'Audit-Report',
            'Revert': 'Revert-Hardening-Report'
        };
        const payloadReportType = reportTypeMapping[action] as ReportPayload['report_type'];


        if (action === 'Harden') {
            script = template.harden_script;
            electronAction = 'applyHarden';
        } else if (action === 'Revert') {
            script = template.revert_script;
            electronAction = 'revertHardening';
        } else { // Audit
            script = template.check_script;
            electronAction = 'checkStatus';
        }

        if (!script || template.policies.length === 0) {
            setFeedback({ type: 'error', message: 'No policies or script available for this action.' });
            setExecutingTemplateId(null);
            return;
        }

        try {
            const { serialNumber } = await window.electron.getSystemInfo();
            const results: { name: string; status: 'Passed' | 'Failed' }[] = [];

            for (const policy of template.policies) {
                const policyBlockRegex = new RegExp(`# Policy: ${policy.description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n([\\s\\S]*?)(?=\\n# Policy:|$)`);
                const match = script.match(policyBlockRegex);
                const command = match ? match[1].trim() : '';

                if (command) {
                    try {
                        // MODIFIED: Pass policy.reg_option for checkStatus action
                        if (electronAction === 'checkStatus') {
                            await window.electron.checkStatus(command, policy.reg_option);
                        } else {
                            // applyHarden and revertHardening don't need the extra parameter
                            await (window.electron[electronAction] as any)(command);
                        }
                        results.push({ name: policy.description, status: 'Passed' });
                    } catch (execError) {
                        results.push({ name: policy.description, status: 'Failed' });
                    }
                }
            }

            const payload: ReportPayload = {
                report_type: payloadReportType,
                serial_number: serialNumber,
                policies: results,
            };
            await createReport(template.id, payload);

            const updatedReports = await getReportsForTemplate(template.id);
            setReports(prev => ({ ...prev, [template.id]: updatedReports }));
            setFeedback({ type: 'success', message: `${action} report generated successfully!` });

        } catch (error: any) {
            setFeedback({ type: 'error', message: `Error generating report: ${error.message}` });
        } finally {
            setExecutingTemplateId(null);
        }
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
                // Update the state to remove the report from the UI
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
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
                    <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
                        Welcome! Here you can manage your created templates and generate reports.
                    </p>
                    <div className="mt-8">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Templates</h2>
                            <button
                                onClick={handleImportClick}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
                            >
                                Import Template
                            </button>
                            <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".json" className="hidden" />
                        </div>
                        <div className="mb-4">
                            <input
                                type="text"
                                placeholder="Search templates by ID, organization or benchmark..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-[400px] p-2 border rounded dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        {feedback && (
                            <div className={`mb-4 p-3 rounded-md text-sm ${feedback.type === 'success' ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200' : 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200'}`}>
                                {feedback.message}
                            </div>
                        )}
                        {isLoading ? (
                            <p className="text-center text-gray-500 py-10">Loading templates...</p>
                        ) : (
                            <div className="overflow-x-auto mt-4">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-700">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ID</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Organization</th>
                                            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Benchmark</th>
                                            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Policies</th>
                                            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Generate Report</th>
                                            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Manage</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {filteredTemplates.length > 0 ? filteredTemplates.map((template) => (
                                            <React.Fragment key={template.id}>
                                                <tr>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700 dark:text-gray-200">
                                                        <button onClick={() => toggleTemplateExpansion(template.id)} className="mr-4 text-lg align-middle focus:outline-none">
                                                            {expandedTemplates.has(template.id) ? '▼' : '▶'}
                                                        </button>
                                                        {template.id}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{template.organization_name}</td>
                                                    {/* MODIFICATION START */}
                                                    <td className="px-6 py-4 max-w-xs whitespace-normal break-words text-sm text-gray-500 dark:text-gray-300">{template.benchmark_name}</td>
                                                    {/* MODIFICATION END */}
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500 dark:text-gray-300">{template.policy_count}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center space-x-2">
                                                        <button onClick={() => handleGenerateReport(template, 'Harden')} disabled={executingTemplateId === template.id} className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">Harden</button>
                                                        <button onClick={() => handleGenerateReport(template, 'Audit')} disabled={executingTemplateId === template.id} className="px-3 py-1 text-xs font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700 disabled:opacity-50">Audit</button>
                                                        <button onClick={() => handleGenerateReport(template, 'Revert')} disabled={executingTemplateId === template.id} className="px-3 py-1 text-xs font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50">Revert</button>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center space-x-2">
                                                        <Link to={`/template/edit/${template.id}`} className="px-3 py-1 text-xs font-medium text-white bg-yellow-500 rounded-md hover:bg-yellow-600">Edit</Link>
                                                        <button onClick={() => handleExport(template)} className="px-3 py-1 text-xs font-medium text-white bg-green-500 rounded-md hover:bg-green-600">Export</button>
                                                        <button onClick={() => handleDelete(template.id)} className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Delete</button>
                                                    </td>
                                                </tr>
                                                {expandedTemplates.has(template.id) && (
                                                    <tr>
                                                        <td colSpan={6} className="px-6 py-4 bg-gray-50 dark:bg-gray-900">
                                                            <h4 className="font-bold mb-2 text-gray-800 dark:text-gray-200">Generated Reports:</h4>
                                                            <TemplateReports
                                                                reports={reports[template.id] || []}
                                                                onDelete={(reportId) => handleDeleteReport(template.id, reportId)}
                                                            />
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        )) : (
                                            <tr>
                                                <td colSpan={6} className="text-center py-10 text-gray-500 dark:text-gray-400">No templates created yet.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                {executingTemplateId && (
                                    <div className="mt-4 text-center text-blue-500 dark:text-blue-400">
                                        Generating report for template {executingTemplateId}, please wait...
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;