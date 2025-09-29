// src/App.tsx (Final Modified)

import React, { lazy, Suspense } from 'react'; // ADD lazy, Suspense
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom'; // ADD useParams for the wrapper
import { getTemplateDetails, getProductDetails, ProductDetails, Template } from './services/authService'; // ADD imports for fetching data

// Import Context Providers
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { ProfileProvider } from './contexts/ProfileContext';

// Import Layout Components
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import ProfileUpdater from './components/ProfileUpdater';

// Import Page Components
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import OrganizationDetailPage from './pages/OrganizationDetailPage';
import ProductDetailPageRouter from './pages/ProductDetailPage'; 
import ProfilePage from './pages/ProfilePage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AuditParserUploadPage from './pages/AuditParserUploadPage';
import TemplateEditPage from './pages/TemplateEditPage'; 
import './App.css';

// Lazy load the new component
const ApplyHardeingPage = lazy(() => import('./pages/Report/Windows/ApplyHardeing')); 

const LoadingComponent = () => (
    <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300">Loading hardening page...</p>
        </div>
    </div>
);

// NEW Wrapper component to fetch ProductDetails using Template ID
const ApplyHardeingPageWrapper: React.FC = () => {
    const { id: templateId } = useParams<{ id: string }>();
    const [product, setProduct] = React.useState<ProductDetails | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const fetchProduct = async () => {
            if (!templateId) return;
            try {
                // Fetch the template first to get the associated product ID
                const template: Template = await getTemplateDetails(templateId); 
                
                // This line is now safe due to the fix in src/services/authService.ts and api/serializers.py
                const productId = template.product.id; 
                
                // Fetch the ProductDetails which the viewer component expects
                const productData = await getProductDetails(String(productId));
                setProduct(productData);
            } catch (err) {
                setError('Failed to load template or product data.');
            }
        };
        fetchProduct();
    }, [templateId]);

    if (error) return <div className="text-center p-10 text-red-500">{error}</div>;
    // We check for `product.audit_json_output_path` existence as the component depends on it.
    if (!product || !product.audit_json_output_path) return <LoadingComponent />; 

    return <ApplyHardeingPage product={product} />;
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <ProfileProvider>
            <ProfileUpdater />
            <div className="bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 min-h-screen transition-colors duration-300">
              <Navbar />
              <main>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<HomePage />} />
                  <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
                  <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
                  <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
                  <Route path="/password/reset/:uid/:token" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
                  
                  {/* Organization and Product Detail Routes */}
                  <Route path="/organization/:id" element={<OrganizationDetailPage />} />
                  <Route path="/product/:id" element={<ProductDetailPageRouter />} />
                  
                  {/* Protected Routes */}
                  <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} /> 
                  <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} /> 
                  <Route path="/template/edit/:id" element={<ProtectedRoute><TemplateEditPage /></ProtectedRoute>} />
                  
                  {/* NEW ROUTE for Applying Hardening */}
                  <Route path="/report/harden/:id" element={<ProtectedRoute><Suspense fallback={<LoadingComponent />}><ApplyHardeingPageWrapper /></Suspense></ProtectedRoute>} />
                  
                  {/* Admin Route for uploading parsers */}
                  <Route path="/admin/upload-parser" element={<ProtectedRoute><AuditParserUploadPage /></ProtectedRoute>} />

                </Routes>
              </main>
            </div>
          </ProfileProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
};

export default App;
