import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import apiClient from '../api/apiClient';

interface Product {
  id: number;
  name: string;
  organization: {
    id: number;
    name: string;
    logo_url: string | null;
  };
  updated_at: string;
}

const NewUpdatesPage: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecentProducts();
  }, []);

  // Mark products as viewed when page loads
  useEffect(() => {
    if (products.length > 0) {
      const viewedData = {
        lastViewed: new Date().toISOString(),
        productIds: products.map(p => p.id)
      };
      localStorage.setItem('viewedUpdates', JSON.stringify(viewedData));
    }
  }, [products]);

  const fetchRecentProducts = async () => {
    try {
      const response = await apiClient.get('/products/recent/');
      setProducts(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
    return date.toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-win-bg-solid' : 'bg-win-bg-solid'} p-6`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-win-accent"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-win-bg-solid' : 'bg-win-bg-solid'} p-6`}>
        <div className="max-w-7xl mx-auto">
          <div className={`${isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'} border rounded-win p-4`}>
            <p className={`${isDark ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-win-bg-solid p-6`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-semibold text-win-text-primary mb-2`}>
            New Updates
          </h1>
          <p className={`text-win-text-secondary`}>
            Recently added products and technologies
          </p>
        </div>

        {/* Products List */}
        {products.length === 0 ? (
          <div className={`bg-win-bg-layer border-win-border-default border rounded-win p-8 text-center`}>
            <p className={`text-win-text-secondary`}>
              No recent updates available
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {products.map((product) => (
              <div
                key={product.id}
                className={`bg-win-bg-layer border-win-border-default border rounded-win p-4 transition-all duration-200 w-full`}
              >
                <div className="flex items-center gap-4">
                  {/* Organization Logo */}
                  {product.organization.logo_url ? (
                    <img
                      src={product.organization.logo_url}
                      alt={product.organization.name}
                      className="w-12 h-12 object-contain flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold text-lg">
                        {product.organization.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    {/* Organization Badge */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-win-accent/10 text-win-accent">
                        {product.organization.name}
                      </span>
                    </div>
                    
                    {/* Product Name */}
                    <h2 className={`text-base font-semibold text-win-text-primary mb-2`}>
                      {product.name}
                    </h2>

                    {/* Timestamp */}
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <svg
                          className={`w-3.5 h-3.5 text-win-text-tertiary`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className={`text-win-text-tertiary`}>
                          {formatTimeAgo(product.updated_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <svg
                          className={`w-3.5 h-3.5 text-win-text-tertiary`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span className={`text-win-text-tertiary`}>
                          {formatDateTime(product.updated_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* See Details Button */}
                  <Link
                    to={`/product/${product.id}`}
                    className="px-5 py-2 rounded-win bg-win-accent hover:bg-win-accent-hover text-white text-sm font-medium transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow-md flex-shrink-0"
                  >
                    See Details
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewUpdatesPage;
