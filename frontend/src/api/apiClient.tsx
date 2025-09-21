// src/api/apiClient.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:8000/api/', // Adjust to your backend URL
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add token to headers
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Token ${token}`; // Matches your backend's TokenAuthentication
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default apiClient;
