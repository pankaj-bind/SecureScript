// src/pages/ProductDetailPage.tsx

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProductDetails, ProductDetails } from '../services/authService';

// Define a generic props type that any viewer component will accept
export interface ViewerPageProps {
  product: ProductDetails;
}

// --- Main Router Component ---

const ProductDetailPageRouter: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    // The state holds the component to be rendered, not the data
    const [ViewerComponent, setViewerComponent] = useState<React.ComponentType<ViewerPageProps> | null>(null);
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

                // Dynamically import the component based on the product's page_viewer field
                const component = lazy(() => 
                    import(`./ProductDetailViewers/${viewerIdentifier}/ProductDetailPage.tsx`)
                    .catch(() => {
                        // If a specific viewer is not found, fall back to the DefaultViewer
                        console.warn(`Viewer component "${viewerIdentifier}" not found. Falling back to default.`);
                        return import(`./ProductDetailViewers/DefaultViewer`);
                    })
                );

                setViewerComponent(() => component); // Use a functional update for the component
            } catch (err) {
                setError('Could not fetch product data. It may have been removed.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchProductAndLoadViewer();
    }, [id]);

    const LoadingComponent = () => (
        <div className="flex justify-center items-center min-h-screen">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-300">Loading product viewer...</p>
            </div>
        </div>
    );

    if (isLoading) {
        return <LoadingComponent />;
    }

    if (error) {
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                <p className="text-red-500 text-lg">{error}</p>
                <Link to="/" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Back to Directory
                </Link>
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