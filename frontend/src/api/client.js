import axios from 'axios';

// Smart base URL resolution:
// 1. If VITE_API_URL environment variable is provided, use it directly (e.g. Vercel deployment)
// 2. If running through Vite dev proxy (port 5173 / 5174), use relative '/api/v1'
// 3. If running on same domain in production (e.g. Render / Railway full-stack), use relative '/api/v1'
// 4. If accessing via local network IP (e.g. mobile testing), route to the network backend
// 5. Default fallback to localhost:5002
const resolveBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    const { hostname, port } = window.location;

    // A) If accessing via Vite dev server with proxy active, use relative API path
    if (port === '5173' || port === '5174') {
      return '/api/v1';
    }

    // B) If hosted together on standard HTTP/HTTPS ports (single live link deployment)
    if (!port || port === '80' || port === '443' || port === '5002') {
      return '/api/v1';
    }

    // C) If accessing over LAN IP directly from mobile/tablet
    if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)) {
      return `http://${hostname}:5002/api/v1`;
    }
  }

  return 'http://localhost:5002/api/v1';
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