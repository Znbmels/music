import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import axiosInstance from '../utils/axios';
import axios from 'axios';

interface User {
  id: number;
  email: string;
  username: string;
  is_musician: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string, isMusician: boolean) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const tokenString = localStorage.getItem('vibetunes_tokens');
    if (tokenString) {
      const tokens = JSON.parse(tokenString);
      if (tokens && tokens.access) {
        fetchUser();
      } else {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const tokenString = localStorage.getItem('vibetunes_tokens');
      if (!tokenString) {
        setIsLoading(false);
        return;
      }
      
      const tokens = JSON.parse(tokenString);
      if (tokens && tokens.access) {
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${tokens.access}`;
      }
      
      const response = await axiosInstance.get('/users/me/');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem('vibetunes_tokens');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await axiosInstance.post('/token/', { 
        email, 
        password 
      });
      
      const { access, refresh } = response.data;
      
      // Store tokens in localStorage
      const tokens = {
        access,
        refresh
      };
      localStorage.setItem('vibetunes_tokens', JSON.stringify(tokens));
      
      // Устанавливаем токен для всех последующих запросов
      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${access}`;
      
      await fetchUser();
    } catch (error: any) {
      console.error('Login error:', error.response?.data || error.message);
      throw error;
    }
  };

  const register = async (email: string, password: string, username: string, isMusician: boolean) => {
    try {
      // Log the request details for debugging
      console.log('Sending registration request with data:', {
        email,
        username,
        is_musician: isMusician,
        // Don't log password for security reasons
      });
      
      const response = await axiosInstance.post('/register/', {
        email,
        password,
        username,
        is_musician: isMusician,
      });
      
      console.log('Registration successful:', response.data);
      
      // After successful registration, log the user in
      await login(email, password);
    } catch (error: any) {
      console.error('Register error:', error);
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received:', error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error message:', error.message);
      }
      
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('vibetunes_tokens');
    delete axiosInstance.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}