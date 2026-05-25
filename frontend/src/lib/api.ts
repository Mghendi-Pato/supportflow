import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 — token expired, attempt refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Never intercept auth endpoints — let their callers handle the error directly
    const isAuthEndpoint =
      original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/register') ||
      original?.url?.includes('/auth/invite') ||
      original?.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });

        const newToken = data.data?.accessToken ?? data.accessToken;
        localStorage.setItem('accessToken', newToken);
        original.headers.Authorization = `Bearer ${newToken}`;

        return api(original);
      } catch {
        // Refresh failed — clear session and redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  },
);

export { api };
export default api;
