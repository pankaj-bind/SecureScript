import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { login } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const { setToken } = useAuth();
    const location = useLocation();
    const message = location.state?.message;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            const data = await login(username, password);
            setToken(data.key);
            // Redirect to the homepage after successful login
            navigate('/', { replace: true });
        } catch (err) {
            setError('Failed to log in. Please check your username and password.');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="max-w-md mx-auto mt-20 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl">
            <h2 className="text-2xl font-bold text-center mb-6">Log In</h2>
            {message && <p className="text-green-500 text-center mb-4">{message}</p>}
            {error && <p className="text-red-500 text-center mb-4">{error}</p>}
            <form onSubmit={handleSubmit}>
                <div className="mb-4">
                    <label htmlFor="username" className="block text-sm font-medium mb-1">Username</label>
                    <input type="text" id="username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required />
                </div>
                <div className="mb-6">
                    <div className="flex justify-between items-baseline">
                        <span className="block text-sm font-medium mb-1">Password</span>
                        <Link to="/forgot-password" className="text-sm text-blue-500 hover:underline">Forgot Password?</Link>
                    </div>
                    <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required />
                </div>
                <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:bg-blue-400">
                    {isLoading ? 'Logging in...' : 'Log In'}
                </button>
            </form>
            <p className="text-center mt-4 text-sm">
                Don't have an account? <Link to="/register" className="text-blue-500 hover:underline">Sign up</Link>
            </p>
        </div>
    );
};

export default LoginPage;
