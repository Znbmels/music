import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      console.log('Attempting login with:', { email });
      await login(email, password);
      console.log('Login successful, navigating to home page');
      navigate('/');
    } catch (err: any) {
      console.error('Login failed:', err);
      if (err.response?.data) {
        const errorMsg = err.response.data.detail || JSON.stringify(err.response.data);
        setError(errorMsg);
      } else if (err.request) {
        setError('Сервер недоступен. Пожалуйста, проверьте соединение.');
      } else {
        setError('Неверный email или пароль');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-[400px] animate-fadeIn">
        <h1 className="text-[28px] font-bold text-center mb-5">Вход в VibeTunes</h1>
        <form
          onSubmit={handleSubmit}
          className="bg-[#282828] rounded-[10px] shadow-xl p-8 w-full"
        >
          {error && (
            <div className="bg-red-500 text-white p-3 rounded-[5px] text-sm mb-5">{error}</div>
          )}
          <div className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-[50px] bg-[#3E3E3E] text-white placeholder-[#B3B3B3] rounded-[5px] px-4 focus:outline-none focus:ring-2 focus:ring-vibe-green text-[16px] transition-all duration-200"
              placeholder="Email"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-[50px] bg-[#3E3E3E] text-white placeholder-[#B3B3B3] rounded-[5px] px-4 focus:outline-none focus:ring-2 focus:ring-vibe-green text-[16px] transition-all duration-200"
              placeholder="Пароль"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-[50px] bg-vibe-green hover:bg-[#147D43] text-white font-medium rounded-[5px] mt-6 text-[16px] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Вход...' : 'Войти'}
          </button>
          <div className="mt-4 text-center">
            <span className="text-vibe-gray text-[14px]">Нет аккаунта? </span>
            <Link
              to="/register"
              className="text-vibe-green hover:text-[#147D43] font-medium text-[14px] transition-colors duration-200"
            >
              Зарегистрироваться
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}