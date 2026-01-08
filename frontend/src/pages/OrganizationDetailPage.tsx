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
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-win-accent border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm text-win-text-secondary">Loading organization details...</p>
        </div>
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16">
          <p className="text-red-500 text-sm">{error || 'Organization not found.'}</p>
          <Link to="/" className="mt-4 inline-block win-btn-primary">
            Back to Directory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <Link to="/" className="text-win-accent hover:underline text-sm flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back to Directory
        </Link>
      </div>

      <header className="flex items-center mb-10">
        <div className="relative h-16 w-16 mr-5 flex items-center justify-center bg-win-bg-layer p-2 rounded-win-lg border border-win-border-default">
          {organization.logo && (
            <img 
              src={organization.logo} 
              alt={`${organization.name} Logo`} 
              className="h-14 w-14 object-contain"
            />
          )}
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-win-text-primary">
            {organization.name}
          </h1>
          <p className="text-sm text-win-text-secondary mt-1">
            {organization.products.length} available benchmark{organization.products.length !== 1 ? 's' : ''}
          </p>
        </div>
      </header>

      <main>
        <h2 className="text-lg font-semibold text-win-text-primary mb-5">
          Available Benchmarks
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {organization.products.length > 0 ? (
            organization.products.map(product => (
              <div 
                key={product.id} 
                className="win-card p-5 flex flex-col justify-between"
              >
                <h3 className="font-medium text-sm text-win-text-primary mb-4">
                  {product.name}
                </h3>
                
                <div className="mt-auto">
                    <Link 
                      to={`/product/${product.id}`}
                      className="w-full text-center block win-btn-primary text-sm"
                    >
                      View Details
                    </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-10">
              <p className="text-sm text-win-text-tertiary">
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
