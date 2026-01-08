import React from 'react';
import { Link } from 'react-router-dom';

const ResetPasswordPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-win-bg-solid flex items-center justify-center p-4">
      <div className="w-full max-w-md win-card p-8 text-center">
        {/* Icon */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-win-accent/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-win-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        
        {/* Content */}
        <h2 className="text-xl font-semibold text-win-text-primary mb-2">Enhanced Security</h2>
        <p className="text-sm text-win-text-secondary mb-6">
          We've updated our password reset system to use OTP verification for better security.
        </p>
        
        {/* CTA Button */}
        <Link 
          to="/forgot-password" 
          className="win-btn-primary inline-flex items-center justify-center gap-2 w-full"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
          </svg>
          Go to Password Reset
        </Link>

        {/* Back to login */}
        <div className="mt-6 pt-4 border-t border-win-border-subtle">
          <Link to="/login" className="text-sm text-win-text-tertiary hover:text-win-accent transition-colors">
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
