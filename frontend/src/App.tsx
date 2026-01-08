// src/App.tsx

import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import { getTemplateDetails, getProductDetails, ProductDetails, Template } from './services/authService';
import { ViewerPageProps as ProductViewerPageProps } from './pages/ProductDetailPage';

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

// Lazy load the new components
const ApplyHardeingPage = lazy(() => import('./pages/Report/Windows/ApplyHardeing'));
const SystemAuditPage = lazy(() => import('./pages/Report/Windows/SystemAudit'));
const RevertHardeingPage = lazy(() => import('./pages/Report/Windows/RevertHardeing')); // NEW

const LoadingComponent = () => (
    <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-win-accent border-t-transparent mx-auto"></div>
            <p className="mt-4 text-sm text-gray-600 dark:text-win-text-secondary">Loading page...</p>
        </div>
    </div>
);

// Generic Wrapper component to fetch ProductDetails using Template ID
const PageWrapper: React.FC<{ Component: React.ComponentType<ProductViewerPageProps> }> = ({ Component }) => {
    const { id: templateId } = useParams<{ id: string }>();
    const [product, setProduct] = React.useState<ProductDetails | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const fetchProduct = async () => {
            if (!templateId) return;
            try {
                // 1. Fetch template details to get the product ID and scripts
                const template: Template = await getTemplateDetails(templateId);

                const productId = template.product.id;
                
                // 2. Fetch the full ProductDetails object
                const productData = await getProductDetails(String(productId));
                
                // 3. Attach the scripts from the Template to the ProductDetails object
                // This satisfies the ViewerPageProps interface expected by the component.
                (productData as any).harden_script = template.harden_script;
                (productData as any).check_script = template.check_script;
                (productData as any).revert_script = template.revert_script;
                
                setProduct(productData);
            } catch (err) {
                setError('Failed to load template or product data.');
            }
        };
        fetchProduct();
    }, [templateId]);

    if (error) return <div className="text-center p-10 text-red-500">{error}</div>;
    if (!product || !product.audit_json_output_path) return <LoadingComponent />;

    return <Component product={product} />;
};

// Define wrapper instances for specific pages
const ApplyHardeingPageWrapper: React.FC = () => <PageWrapper Component={ApplyHardeingPage} />;
const SystemAuditPageWrapper: React.FC = () => <PageWrapper Component={SystemAuditPage} />;
const RevertHardeingPageWrapper: React.FC = () => <PageWrapper Component={RevertHardeingPage} />; // NEW

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <ProfileProvider>
            <ProfileUpdater />
            <div className="bg-win-light-bg dark:bg-win-bg-solid text-gray-800 dark:text-win-text-primary min-h-screen transition-colors duration-200 font-segoe">
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
                  
                  {/* Dedicated Pages for Report Actions */}
                  <Route path="/report/harden/:id" element={<ProtectedRoute><Suspense fallback={<LoadingComponent />}><ApplyHardeingPageWrapper /></Suspense></ProtectedRoute>} />
                  <Route path="/report/audit/:id" element={<ProtectedRoute><Suspense fallback={<LoadingComponent />}><SystemAuditPageWrapper /></Suspense></ProtectedRoute>} />
                  <Route path="/report/revert/:id" element={<ProtectedRoute><Suspense fallback={<LoadingComponent />}><RevertHardeingPageWrapper /></Suspense></ProtectedRoute>} /> {/* NEW REVERT ROUTE */}
                  
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