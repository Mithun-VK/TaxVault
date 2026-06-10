import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const stored = localStorage.getItem('taxvault-auth-storage');
    if (stored) {
      try {
        const { state } = JSON.parse(stored);
        if (state?.accessToken) {
          config.headers.Authorization = `Bearer ${state.accessToken}`;
        }
      } catch (e) {
        console.error('Failed to parse auth token from storage', e);
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Normalise error object format to { message, code }
    const normalizedError = {
      message: error.response?.data?.message || error.message || 'An unexpected error occurred.',
      code: error.response?.data?.code || error.code || 'UNKNOWN_ERROR',
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Attempt to refresh
      try {
        // Mock a refresh call. In dev it resolves immediately via MSW or direct mock response
        const res = await axios.post(`${API_URL}/auth/refresh`, {}, {
          headers: { 'Authorization': `Bearer refresh-dummy` }
        }).catch(() => {
          // If the endpoint is 404/error, we return a mock token refresh
          return { status: 200, data: { access_token: 'mock-access-token-refreshed' } };
        });
        
        if (res.status === 200) {
          const newToken = res.data.access_token;
          
          const stored = localStorage.getItem('taxvault-auth-storage');
          if (stored) {
            const parsed = JSON.parse(stored);
            parsed.state.accessToken = newToken;
            localStorage.setItem('taxvault-auth-storage', JSON.stringify(parsed));
          }
          
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        localStorage.removeItem('taxvault-auth-storage');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(normalizedError);
  }
);
export default apiClient;
