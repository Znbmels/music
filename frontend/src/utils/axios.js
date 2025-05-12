import axios from 'axios';

// Create custom axios instance with base URL
const instance = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add a request interceptor to add auth token to every request
instance.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const tokenString = localStorage.getItem('vibetunes_tokens');
    if (tokenString) {
      const tokens = JSON.parse(tokenString);
      if (tokens && tokens.access) {
        config.headers.Authorization = `Bearer ${tokens.access}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle token refresh
instance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    // For network errors (server not available)
    if (!error.response) {
      console.error('Network error detected:', error.message);
      return Promise.reject({
        ...error,
        response: {
          data: { detail: 'Сервер недоступен. Пожалуйста, проверьте соединение.' }
        }
      });
    }
    
    // If error is 401 and not already retrying
    if (error.response && error.response.status === 401 && !error.config._retry) {
      error.config._retry = true;
      
      try {
        // Get refresh token from localStorage
        const tokenString = localStorage.getItem('vibetunes_tokens');
        if (tokenString) {
          const tokens = JSON.parse(tokenString);
          if (tokens && tokens.refresh) {
            // Request a new token
            const response = await axios.post('/api/token/refresh/', {
              refresh: tokens.refresh
            });
            
            // Update token in localStorage
            const newTokens = {
              ...tokens,
              access: response.data.access
            };
            localStorage.setItem('vibetunes_tokens', JSON.stringify(newTokens));
            
            // Update the original request and retry
            error.config.headers.Authorization = `Bearer ${response.data.access}`;
            return axios(error.config);
          }
        }
      } catch (refreshError) {
        console.error('Error refreshing token:', refreshError);
        // If refresh fails, redirect to login
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default instance; 