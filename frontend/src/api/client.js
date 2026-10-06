import axios from 'axios';

// Smart base URL resolution:
// If running on a deployed web domain (e.g. Vercel), safely default to the live Render backend
// If running locally, default to http://localhost:5002/api/v1
const resolveBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  const isBrowser = typeof window !== 'undefined';
  const isLocalhost = isBrowser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (isBrowser && !isLocalhost) {
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl;
    }
    return 'https://marketsphere-api.onrender.com/api/v1';
  }

  return envUrl || 'http://localhost:5002/api/v1';
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