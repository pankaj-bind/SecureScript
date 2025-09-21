// src/pages/ForgotPasswordPage.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestPasswordResetOTP, verifyPasswordResetOTP, setNewPasswordWithOTP } from '../services/authService';

type Step = 'email' | 'otp' | 'password' | 'success';

const ForgotPasswordPage: React.FC = () => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  
  const navigate = useNavigate();

  // Live password validation
  useEffect(() => {
    if (step !== 'password') return;
    const errors: string[] = [];
    if (password.length < 8) errors.push("At least 8 characters");
    if (!/[a-z]/.test(password)) errors.push("At least one lowercase letter");
    if (!/[A-Z]/.test(password)) errors.push("At least one uppercase letter");
    if (!/[0-9]/.test(password)) errors.push("At least one number");
    if (!/[\W_]/.test(password)) errors.push("At least one special character");
    setPasswordErrors(errors);
  }, [password, step]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await requestPasswordResetOTP(email);
      setMessage('An OTP has been sent to your email.');
      setStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.email?.[0] || 'Failed to send OTP. Please check the email address.');
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await verifyPasswordResetOTP(email, otp);
      setMessage('OTP verified. You can now set a new password.');
      setStep('password');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid or expired OTP.');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== password2) {
      setError('Passwords do not match.');
      return;
    }
    if (passwordErrors.length > 0) {
      setError('Please fix the errors in your password.');
      return;
    }
    try {
      await setNewPasswordWithOTP(email, otp, password);
      setMessage('Your password has been reset successfully!');
      setStep('success');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.password?.[0] || 'Failed to reset password.');
    }
  };
  
  const renderPasswordFeedback = () => {
    if (!password) return null;
    const requirements = [
        { text: "At least 8 characters", valid: password.length >= 8 },
        { text: "At least one lowercase letter", valid: /[a-z]/.test(password) },
        { text: "At least one uppercase letter", valid: /[A-Z]/.test(password) },
        { text: "At least one number", valid: /[0-9]/.test(password) },
        { text: "At least one special character", valid: /[\W_]/.test(password) },
    ];
    return (
        <div className="mt-2 text-sm">
            {requirements.map(req => (
                <p key={req.text} className={req.valid ? "text-green-500" : "text-red-500"}>
                    {req.valid ? '✔' : '✖'} {req.text}
                </p>
            ))}
        </div>
    );
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Reset Password</h2>
      {message && <p className="text-green-500 mb-4">{message}</p>}
      {error && <p className="text-red-500 mb-4">{error}</p>}

      {step === 'email' && (
        <form onSubmit={handleEmailSubmit}>
          <p className="mb-4 text-gray-600">Enter your registered email to receive an OTP.</p>
          <div className="mb-4">
            <label htmlFor="email">Email</label>
            <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-2 border rounded" required />
          </div>
          <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded">Send OTP</button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={handleOtpSubmit}>
          <p className="mb-4 text-gray-600">Enter the 6-digit OTP sent to {email}.</p>
          <div className="mb-4">
            <label htmlFor="otp">OTP</label>
            <input type="text" id="otp" value={otp} onChange={(e) => setOtp(e.target.value)} className="w-full p-2 border rounded" maxLength={6} required />
          </div>
          <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded">Verify OTP</button>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={handlePasswordSubmit} noValidate>
          <p className="mb-4 text-gray-600">Create a new password.</p>
          <div className="mb-4">
            <label htmlFor="password">New Password</label>
            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-2 border rounded" required />
            {renderPasswordFeedback()}
          </div>
          <div className="mb-4">
            <label htmlFor="password2">Confirm New Password</label>
            <input type="password" id="password2" value={password2} onChange={(e) => setPassword2(e.target.value)} className="w-full p-2 border rounded" required />
          </div>
          <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded">Reset Password</button>
        </form>
      )}
    </div>
  );
};

export default ForgotPasswordPage;
