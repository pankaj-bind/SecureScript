// src/pages/ProductDetailViewers/Default/ProductDetailPage.tsx

import React from 'react';
import { Link } from 'react-router-dom';
import { ProductDetails } from '../../services/authService';

// Icons
const ArrowLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const FileIcon = () => (
  <svg className="w-5 h-5 text-win-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const EmptyIcon = () => (
  <svg className="w-16 h-16 text-win-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
  </svg>
);

// The router component will pass the product data as a prop
interface ViewerPageProps {
  product: ProductDetails;
}

const DefaultViewer: React.FC<ViewerPageProps> = ({ product }) => {
  if (!product) {
    return (
      <div className="min-h-screen bg-win-bg-solid flex items-center justify-center">
        <div className="win-card p-8 text-center">
          <p className="text-win-text-secondary">Product data is not available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-win-bg-solid">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="mb-4">
          {product.organization_id && (
            <Link 
              to={`/organization/${product.organization_id}`} 
              className="inline-flex items-center gap-1.5 text-sm text-win-text-secondary hover:text-win-accent transition-colors"
            >
              <ArrowLeftIcon />
              Back to Organization
            </Link>
          )}
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-win-text-primary">{product.name}</h1>
          <p className="text-sm text-win-text-tertiary mt-1">Default Benchmark Viewer</p>
        </div>

        {/* Main Content */}
        <div className="win-card p-6">
          <h2 className="text-lg font-semibold text-win-text-primary mb-4 flex items-center gap-2">
            <FileIcon />
            Generated Audit Files
          </h2>
          
          {product.audit_files && product.audit_files.length > 0 ? (
            <div className="space-y-2">
              {product.audit_files.map((file) => (
                <div 
                  key={file.name} 
                  className="flex items-center justify-between p-4 bg-win-bg-subtle rounded-win border border-win-border-subtle hover:border-win-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-win-accent/10 rounded-win">
                      <FileIcon />
                    </div>
                    <span className="font-mono text-sm text-win-text-primary">{file.name}</span>
                  </div>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="win-btn-primary inline-flex items-center gap-2 text-sm"
                  >
                    View JSON
                    <ExternalLinkIcon />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <EmptyIcon />
              <p className="text-win-text-secondary mt-4">
                No audit files have been processed for this product yet.
              </p>
              <p className="text-xs text-win-text-tertiary mt-1">
                Audit files will appear here once processing is complete.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DefaultViewer;