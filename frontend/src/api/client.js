import axios from 'axios';

// Smart base URL resolution:
// 1. Explicit VITE_API_URL takes top priority
// 2. Localhost uses local development server / proxy
// 3. Any deployed live domain (e.g. Vercel) defaults directly to live Render backend: https://marketsphere-api.onrender.com/api/v1
const resolveBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    const { hostname, port } = window.location;

    // A) If running locally on localhost or 127.0.0.1
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      if (port === '5173' || port === '5174') {
        return '/api/v1'; // Proxied by Vite dev server
      }
      return 'http://localhost:5002/api/v1';
    }

    // B) If accessing over LAN IP directly from mobile/tablet
    if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)) {
      return `http://${hostname}:5002/api/v1`;
    }

    // C) Deployed production domain (Vercel, Netlify, custom domain) -> Connect to live Render API
    return 'https://marketsphere-api.onrender.com/api/v1';
  }

  return 'https://marketsphere-api.onrender.com/api/v1';
};

const apiClient = axios.create({
  baseURL: resolveBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error.response?.data?.message || error.message);
    if (error.response?.status === 401) {
      // Handle unauthorized (e.g. redirect to login, clear token)
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export default apiClient;