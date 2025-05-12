import axios from 'axios';

const instance = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Добавляем токен к каждому запросу
instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Обрабатываем ошибки и обновляем токен при необходимости
instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Если ошибка 401 и это не запрос на обновление токена
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          const response = await axios.post('http://localhost:8000/api/token/refresh/', {
            refresh: refreshToken,
          });
          
          const { access } = response.data;
          localStorage.setItem('token', access);
          
          // Обновляем заголовок с новым токеном
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return instance(originalRequest);
        } catch (refreshError) {
          // Если не удалось обновить токен, выходим из системы
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default instance;