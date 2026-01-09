// src/pages/ProductDetailPage.tsx

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProductDetails, ProductDetails } from '../services/authService';

// Define a generic props type that any viewer component will accept
export interface ViewerPageProps {
  product: ProductDetails;
}

// Static imports for viewer components to avoid dynamic import issues with spaces in paths
const DefaultViewer = lazy(() => import('./ProductDetailViewers/DefaultViewer'));
const Windows11StandaloneViewer = lazy(() => import('./ProductDetailViewers/Windows 11 Standalone/ProductDetailPage'));

// Map page_viewer values to components
const viewerMap: { [key: string]: React.LazyExoticComponent<React.ComponentType<ViewerPageProps>> } = {
    'Default': DefaultViewer,
    'Windows 11 Standalone': Windows11StandaloneViewer,
    'Windows 11 Enterprise': Windows11StandaloneViewer, // Use same viewer for now
};

// --- Main Router Component ---

const ProductDetailPageRouter: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    // The state holds the component to be rendered, not the data
    const [ViewerComponent, setViewerComponent] = useState<React.LazyExoticComponent<React.ComponentType<ViewerPageProps>> | null>(null);
    const [product, setProduct] = useState<ProductDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) {
            setError('No product ID provided.');
            setIsLoading(false);
            return;
        }

        const fetchProductAndLoadViewer = async () => {
            try {
                const productData = await getProductDetails(id);
                setProduct(productData);

                const viewerIdentifier = productData.page_viewer || 'Default';

                // Use static mapping instead of dynamic imports
                const component = viewerMap[viewerIdentifier] || DefaultViewer;
                setViewerComponent(component);
            } catch (err) {
                setError('Could not fetch product data. It may have been removed.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchProductAndLoadViewer();
    }, [id]);

    const LoadingComponent = () => (
        <div className="min-h-screen bg-win-bg-solid flex items-center justify-center">
            <div className="text-center">
                <div className="w-10 h-10 border-2 border-win-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="mt-4 text-sm text-win-text-secondary">Loading product viewer...</p>
            </div>
        </div>
    );

    if (isLoading) {
        return <LoadingComponent />;
    }

    if (error) {
        return (
            <div className="min-h-screen bg-win-bg-solid flex items-center justify-center">
                <div className="win-card p-8 max-w-md text-center">
                    <svg className="w-12 h-12 mx-auto text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-red-400 mb-4">{error}</p>
                    <Link 
                        to="/" 
                        className="win-btn-primary inline-flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        Back to Directory
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <Suspense fallback={<LoadingComponent />}>
            {ViewerComponent && product && <ViewerComponent product={product} />}
        </Suspense>
    );
};

export default ProductDetailPageRouter;