// src/pages/RegisterPage.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { register, login, checkUsername } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';

const RegisterPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [password2, setPassword2] = useState('');

    // State for live validation
    const [isCheckingUsername, setIsCheckingUsername] = useState(false);
    const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
    const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
    
    // State for submission feedback
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const { setToken } = useAuth();
    const navigate = useNavigate();
    
    // --- Live Username Check with Debounce ---
    useEffect(() => {
        if (!username) {
            setIsUsernameAvailable(null);
            return;
        }

        setIsCheckingUsername(true);
        const timerId = setTimeout(() => {
            checkUsername(username).then(data => {
                setIsUsernameAvailable(!data.exists);
                setIsCheckingUsername(false);
            });
        }, 500); // Debounce for 500ms

        return () => clearTimeout(timerId); // Cleanup timer
    }, [username]);


    // --- Live Password Validation ---
    useEffect(() => {
        const errors: string[] = [];
        if (password.length < 8) errors.push("At least 8 characters");
        if (!/[a-z]/.test(password)) errors.push("At least one lowercase letter");
        if (!/[A-Z]/.test(password)) errors.push("At least one uppercase letter");
        if (!/[0-9]/.test(password)) errors.push("At least one number");
        if (!/[\W_]/.test(password)) errors.push("At least one special character");
        setPasswordErrors(errors);
    }, [password]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (password !== password2) {
            setError('Passwords do not match');
            return;
        }
        if (passwordErrors.length > 0) {
            setError('Please fix the errors in your password.');
            return;
        }
        if (isUsernameAvailable === false) {
            setError('This username is already taken.');
            return;
        }

        try {
            await register(username, email, password, password2);
            setSuccess('You have registered successfully');
            
            // Attempt auto-login
            const loginResponse = await login(username, password);
            const authToken = loginResponse.key || loginResponse.token;
            if (authToken) {
                setToken(authToken);
                setTimeout(() => navigate('/dashboard'), 1500);
            } else {
                 setError('Auto-login failed. Please log in manually.');
            }
        } catch (err: any) {
            if (err.response?.data) {
                const errors = err.response.data;
                const errorMessage = errors.username?.[0] || errors.email?.[0] || errors.password?.[0] || 'Registration failed.';
                setError(errorMessage);
            } else {
                setError('An unexpected error occurred.');
            }
        }
    };

    const renderUsernameFeedback = () => {
        if (isCheckingUsername) return <p className="text-sm text-gray-500 mt-1">Checking...</p>;
        if (isUsernameAvailable === true) return <p className="text-sm text-green-500 mt-1">Username is available!</p>;
        if (isUsernameAvailable === false) return <p className="text-sm text-red-500 mt-1">Username is already taken.</p>;
        return null;
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
        <div className="max-w-md mx-auto mt-20 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl">
            <h2 className="text-2xl font-bold mb-4">Create Account</h2>
            {success && <p className="text-green-500 mb-4">{success}</p>}
            {error && <p className="text-red-500 mb-4">{error}</p>}
            <form onSubmit={handleSubmit} noValidate>
                <div className="mb-4">
                    <label htmlFor="username">Username</label>
                    <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                        required
                    />
                    {renderUsernameFeedback()}
                </div>
                <div className="mb-4">
                    <label htmlFor="email">Email</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                        required
                    />
                </div>
                <div className="mb-4">
                    <label htmlFor="password">Password</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                        required
                    />
                    {renderPasswordFeedback()}
                </div>
                <div className="mb-4">
                    <label htmlFor="password2">Confirm Password</label>
                    <input
                        type="password"
                        id="password2"
                        value={password2}
                        onChange={(e) => setPassword2(e.target.value)}
                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                        required
                    />
                </div>
                <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded">
                    Register
                </button>
            </form>
        </div>
    );
};

export default RegisterPage;
