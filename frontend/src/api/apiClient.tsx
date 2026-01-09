// src/api/apiClient.ts
import axios from 'axios';

// Use environment variable or fallback - production URL as default for deployed sites
const API_URL = process.env.REACT_APP_API_URL 
  ? `${process.env.REACT_APP_API_URL.replace(/\/+$/, '')}/`
  : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000/api/'
    : 'https://pankajbind.pythonanywhere.com/api/';

// Log API URL in development
if (process.env.NODE_ENV === 'development') {
  console.log('API URL:', API_URL);
}

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add token to headers
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor for better error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error status
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      // Request made but no response received
      console.error('Network Error: No response received', error.message);
    } else {
      // Error setting up request
      console.error('Request Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
