import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getOrganizationDetails } from '../services/authService';

interface Product {
  id: number;
  name: string;
}

interface Organization {
  id: number;
  name: string;
  logo: string;
  products: Product[];
}

const OrganizationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('No organization ID provided.');
      setIsLoading(false);
      return;
    }

    const fetchOrganization = async () => {
      try {
        const data = await getOrganizationDetails(id);
        setOrganization(data);
      } catch (err) {
        setError('Could not find the requested organization.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrganization();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading organization details...</p>
        </div>
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-20">
          <p className="text-red-500 text-lg">{error || 'Organization not found.'}</p>
          <Link to="/" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Back to Directory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to Directory
        </Link>
      </div>

      <header className="flex items-center mb-12">
        <div className="relative h-20 w-20 mr-6 flex items-center justify-center bg-white dark:bg-gray-800 p-2 rounded-lg shadow-md">
          {organization.logo && (
            <img 
              src={organization.logo} 
              alt={`${organization.name} Logo`} 
              className="h-20 w-20 object-contain"
            />
          )}
        </div>
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">
            {organization.name}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {organization.products.length} available benchmark{organization.products.length !== 1 ? 's' : ''}
          </p>
        </div>
      </header>

      <main>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
          Available Benchmarks
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {organization.products.length > 0 ? (
            organization.products.map(product => (
              <div 
                key={product.id} 
                className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 flex flex-col justify-between"
              >
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-4">
                  {product.name}
                </h3>
                
                <div className="mt-auto">
                    <Link 
                      to={`/product/${product.id}`}
                      className="w-full text-center block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      View Details
                    </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                No products available for this organization yet.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default OrganizationDetailPage;
