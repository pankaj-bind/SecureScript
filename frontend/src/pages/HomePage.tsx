import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getTechnologies } from '../services/authService';

interface Product {
  id: number;
  name: string;
}

interface Organization {
  id: number;
  name: string;
  logo: string;
  products: Product[];
  updated_at: string;
}

interface TechnologyType {
  id: number;
  name: string;
  organizations: Organization[];
  updated_at: string;
}

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const CategoryIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

const DefaultLogoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const HomePage: React.FC = () => {
  const [technologyTypes, setTechnologyTypes] = useState<TechnologyType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getTechnologies();
        setTechnologyTypes(data);
      } catch (err) {
        setError('Failed to load benchmark data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) {
      return technologyTypes;
    }
    const lowercasedQuery = searchQuery.toLowerCase();
    
    return technologyTypes.map(techType => ({
      ...techType,
      organizations: techType.organizations.filter(org => 
        org.name.toLowerCase().includes(lowercasedQuery)
      ),
    })).filter(techType => techType.organizations.length > 0);

  }, [searchQuery, technologyTypes]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    target.style.display = 'none';
    const parent = target.parentElement;
    if (parent) {
      const fallbackDiv = parent.querySelector('.fallback-logo');
      if (fallbackDiv) {
        (fallbackDiv as HTMLElement).style.display = 'flex';
      }
    }
  };

  if (isLoading) {
    return (
       <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading benchmarks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 text-lg">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="text-center my-12">
        <h1 className="text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Benchmark Directory
        </h1>
        <p className="mt-4 text-xl text-gray-600 dark:text-gray-300">
          Select a technology to generate its CIS hardening script.
        </p>
      </header>

      <main>
        <div className="max-w-2xl mx-auto mb-16">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon />
            </div>
            <input
              type="text"
              placeholder="Search for an organization..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-3 pl-10 pr-4 text-gray-700 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-200"
            />
          </div>
        </div>

        {filteredData.length > 0 ? (
          filteredData.map(techType => (
            <section key={techType.id} className="mb-12">
              <div className="flex items-center mb-6">
                <CategoryIcon />
                <h2 className="ml-3 text-2xl font-bold text-gray-800 dark:text-gray-100">
                  {techType.name}
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                {techType.organizations.map(org => (
                  <Link 
                    to={`/organization/${org.id}`} 
                    key={org.id} 
                    className="block p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="relative h-12 w-12 mb-4 flex items-center justify-center">
                        {org.logo ? (
                          <>
                            <img 
                              src={org.logo}
                              alt={`${org.name} Logo`} 
                              className="h-12 w-12 object-contain"
                              onError={handleImageError}
                            />
                            <div className="fallback-logo hidden items-center justify-center">
                               <DefaultLogoIcon />
                            </div>
                          </>
                        ) : (
                          <DefaultLogoIcon />
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {org.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {org.products.length} benchmark{org.products.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="text-center py-20">
            <p className="text-lg text-gray-500 dark:text-gray-400">
              {searchQuery ? `No results found for "${searchQuery}".` : 'No organizations available yet.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default HomePage;