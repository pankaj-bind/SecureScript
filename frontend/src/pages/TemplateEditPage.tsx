// src/pages/TemplateEditPage.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getTemplateDetails, updateTemplate, Template } from '../services/authService';

const TemplateEditPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [template, setTemplate] = useState<Template | null>(null);
    const [scripts, setScripts] = useState({
        harden_script: '',
        check_script: '',
        revert_script: '',
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const fetchTemplate = useCallback(async () => {
        if (!id) {
            setError("Template ID is missing.");
            setIsLoading(false);
            return;
        }
        try {
            const data = await getTemplateDetails(id);
            setTemplate(data);
            setScripts({
                harden_script: data.harden_script || '',
                check_script: data.check_script || '',
                revert_script: data.revert_script || '',
            });
        } catch (err) {
            setError("Failed to fetch template data.");
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchTemplate();
    }, [fetchTemplate]);

    const handleScriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setScripts(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;

        setIsSaving(true);
        setError(null);
        setSuccess(null);

        try {
            await updateTemplate(id, scripts);
            setSuccess("Template updated successfully!");
            setTimeout(() => setSuccess(null), 3000); // Clear message after 3 seconds
        } catch (err) {
            setError("Failed to update template.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="text-center p-10">Loading...</div>;
    }

    if (error && !template) {
        return <div className="text-center p-10 text-red-500">{error}</div>;
    }
    
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <Link to="/dashboard" className="text-blue-600 dark:text-blue-400 hover:underline">
                        ← Back to Dashboard
                    </Link>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        Edit Template
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 font-mono text-sm">{template?.id}</p>
                    
                    {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
                    {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{success}</div>}
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="harden_script" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Hardening Script</label>
                            <textarea
                                id="harden_script"
                                name="harden_script"
                                value={scripts.harden_script}
                                onChange={handleScriptChange}
                                rows={10}
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-gray-50 dark:bg-gray-700 font-mono"
                            />
                        </div>

                        <div>
                            <label htmlFor="check_script" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Audit Script</label>
                            <textarea
                                id="check_script"
                                name="check_script"
                                value={scripts.check_script}
                                onChange={handleScriptChange}
                                rows={10}
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-gray-50 dark:bg-gray-700 font-mono"
                            />
                        </div>

                        <div>
                            <label htmlFor="revert_script" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Revert Script</label>
                            <textarea
                                id="revert_script"
                                name="revert_script"
                                value={scripts.revert_script}
                                onChange={handleScriptChange}
                                rows={10}
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-gray-50 dark:bg-gray-700 font-mono"
                            />
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
                            >
                                {isSaving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default TemplateEditPage;