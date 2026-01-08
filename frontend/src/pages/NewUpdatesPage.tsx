import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

interface Product {
  id: number;
  name: string;
  organization: {
    id: number;
    name: string;
    logo_url: string | null;
  };
  technology_type: {
    id: number;
    name: string;
  };
  updated_at: string;
  created_at: string;
}

const NewUpdatesPage: React.FC = () => {
  const { isDark } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecentProducts();
  }, []);

  const fetchRecentProducts = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/products/recent/');
      if (!response.ok) {
        throw new Error('Failed to fetch recent products');
      }
      const data = await response.json();
      setProducts(data);
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

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} p-6`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} p-6`}>
        <div className="max-w-7xl mx-auto">
          <div className={`${isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'} border rounded-lg p-4`}>
            <p className={`${isDark ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} p-6`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
            New Updates
          </h1>
          <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Recently added products and technologies
          </p>
        </div>

        {/* Products Grid */}
        {products.length === 0 ? (
          <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg p-8 text-center`}>
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              No recent updates available
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <Link
                key={product.id}
                to={`/product/${product.id}`}
                className={`${
                  isDark
                    ? 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                } border rounded-lg p-4 transition-colors duration-200`}
              >
                {/* Organization Logo and Name */}
                <div className="flex items-center gap-3 mb-3">
                  {product.organization.logo_url ? (
                    <img
                      src={`http://localhost:8000${product.organization.logo_url}`}
                      alt={product.organization.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <span className="text-white font-semibold text-lg">
                        {product.organization.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'} truncate`}>
                      {product.organization.name}
                    </h3>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {product.technology_type.name}
                    </p>
                  </div>
                </div>

                {/* Product Name */}
                <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-2 line-clamp-2`}>
                  {product.name}
                </h2>

                {/* Timestamp */}
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
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
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {formatTimeAgo(product.updated_at)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewUpdatesPage;
