// src/App.tsx

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

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
import TemplateEditPage from './pages/TemplateEditPage'; // Import the new edit page
import './App.css';

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
