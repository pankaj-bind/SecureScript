// src/pages/AuditParserUploadPage.tsx

import React, { useState } from 'react';
import { uploadAuditParser } from '../services/authService';

// Icons
const UploadIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
);

const FileCodeIcon = () => (
    <svg className="w-8 h-8 text-win-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
);

const AuditParserUploadPage: React.FC = () => {
    const [name, setName] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile.name.endsWith('.py')) {
                setFile(droppedFile);
            } else {
                setError('Please upload a Python (.py) file.');
            }
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
        } catch (err: any) {
            const serverError = err.response?.data?.error || err.response?.data?.name?.[0] || 'An unknown error occurred.';
            setError(`Failed to upload parser: ${serverError}`);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-win-bg-solid">
            <div className="max-w-2xl mx-auto px-4 py-8">
                {/* Page Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold text-win-text-primary">Upload Audit Parser</h1>
                    <p className="text-sm text-win-text-secondary mt-1">Add a new parser to process audit files</p>
                </div>

                {/* Main Card */}
                <div className="win-card p-6">
                    {/* Feedback Messages */}
                    {error && (
                        <div className="mb-4 p-3 rounded-win bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="mb-4 p-3 rounded-win bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            {success}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Parser Name */}
                        <div>
                            <label htmlFor="parser-name" className="block text-xs font-medium text-win-text-secondary mb-1.5">
                                Parser Name
                            </label>
                            <input
                                id="parser-name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Windows Server 2019 Parser"
                                className="win-input"
                                required
                            />
                            <p className="text-xs text-win-text-tertiary mt-1.5">A unique name to identify this parser.</p>
                        </div>

                        {/* File Upload */}
                        <div>
                            <label className="block text-xs font-medium text-win-text-secondary mb-1.5">
                                Parser File
                            </label>
                            <div 
                                className={`relative border-2 border-dashed rounded-win p-8 text-center transition-colors ${
                                    isDragOver 
                                        ? 'border-win-accent bg-win-accent/5' 
                                        : file 
                                            ? 'border-green-500/50 bg-green-500/5' 
                                            : 'border-win-border-subtle hover:border-win-accent/50'
                                }`}
                                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                                onDragLeave={() => setIsDragOver(false)}
                                onDrop={handleDrop}
                            >
                                <input
                                    id="parser-file"
                                    type="file"
                                    accept=".py"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    required
                                />
                                <div className="flex flex-col items-center gap-3">
                                    {file ? (
                                        <>
                                            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                                                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-win-text-primary">{file.name}</p>
                                                <p className="text-xs text-win-text-tertiary">{(file.size / 1024).toFixed(1)} KB</p>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                                className="text-xs text-red-400 hover:text-red-300"
                                            >
                                                Remove file
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <FileCodeIcon />
                                            <div>
                                                <p className="text-sm text-win-text-primary">
                                                    <span className="text-win-accent">Click to upload</span> or drag and drop
                                                </p>
                                                <p className="text-xs text-win-text-tertiary mt-1">Python files only (.py)</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="flex justify-end pt-2">
                            <button
                                type="submit"
                                disabled={isUploading || !name || !file}
                                className="win-btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isUploading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <UploadIcon />
                                        Upload Parser
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AuditParserUploadPage;