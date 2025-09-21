// src/pages/ProductDetailViewers/Default/ProductDetailPage.tsx

import React from 'react';
import { Link } from 'react-router-dom';
import { ProductDetails } from '../../services/authService';

// The router component will pass the product data as a prop
interface ViewerPageProps {
  product: ProductDetails;
}

const DefaultViewer: React.FC<ViewerPageProps> = ({ product }) => {
  if (!product) {
    return <div>Product data is not available.</div>;
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-8">
        {product.organization_id && (
          <Link to={`/organization/${product.organization_id}`} className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
            ← Back to Organization
          </Link>
        )}
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mt-2">{product.name}</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">Default Benchmark Viewer</p>
      </header>

      <main>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
            Generated Audit Files
          </h2>
          {product.audit_files && product.audit_files.length > 0 ? (
            <ul className="space-y-3">
              {product.audit_files.map((file) => (
                <li key={file.name} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-md flex justify-between items-center">
                  <span className="font-mono text-gray-700 dark:text-gray-200">{file.name}</span>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    View JSON
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                No audit files have been processed for this product yet.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DefaultViewer;