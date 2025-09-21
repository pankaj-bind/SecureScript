import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl">
      <h2 className="text-2xl font-bold text-center mb-6">Password Reset</h2>
      <div className="text-center">
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          We've updated our password reset system to use OTP verification for better security.
        </p>
        <Link 
          to="/forgot-password" 
          className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 inline-block text-center"
        >
          Go to Password Reset
        </Link>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
