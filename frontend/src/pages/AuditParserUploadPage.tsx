// src/pages/AuditParserUploadPage.tsx

import React, { useState } from 'react';
import { uploadAuditParser } from '../services/authService';

const AuditParserUploadPage: React.FC = () => {
    const [name, setName] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !file) {
            setError('Please provide both a name and a file.');
            return;
        }

        setError(null);
        setSuccess(null);
        setIsUploading(true);

        try {
            await uploadAuditParser(name, file);
            setSuccess(`Parser "${name}" uploaded successfully!`);
            setName('');
            setFile(null);
            // In a real app, you might want to redirect or refresh a list of parsers.
        } catch (err: any) {
            const serverError = err.response?.data?.error || err.response?.data?.name?.[0] || 'An unknown error occurred.';
            setError(`Failed to upload parser: ${serverError}`);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-2xl mx-auto mt-10 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-xl">
                <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Upload New Audit Parser</h2>

                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">{error}</div>}
                {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4" role="alert">{success}</div>}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="parser-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Parser Name
                        </label>
                        <input
                            id="parser-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Windows Server 2019 Parser"
                            className="mt-1 w-full p-3 border rounded dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">A unique name to identify this parser.</p>
                    </div>

                    <div>
                        <label htmlFor="parser-file" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Parser File (`audit_parser.py`)
                        </label>
                        <input
                            id="parser-file"
                            type="file"
                            accept=".py"
                            onChange={handleFileChange}
                            className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-gray-700 cursor-pointer"
                            required
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={isUploading}
                            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                            {isUploading ? 'Uploading...' : 'Upload Parser'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AuditParserUploadPage;