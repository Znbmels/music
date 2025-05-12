import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function Register() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isMusician, setIsMusician] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      setIsLoading(false);
      return;
    }

    try {
      console.log('Attempting registration with:', { email, username, isMusician });
      await register(email, password, username, isMusician);
      console.log('Registration successful, navigating to home page');
      navigate('/');
    } catch (err: any) {
      console.error('Registration failed:', err);
      if (err.response?.data) {
        // Try to format Django validation errors
        const errors = err.response.data;
        if (typeof errors === 'object') {
          const errorMessages = [];
          for (const field in errors) {
            const fieldErrors = errors[field];
            if (Array.isArray(fieldErrors)) {
              errorMessages.push(`${field}: ${fieldErrors.join(', ')}`);
            } else if (typeof fieldErrors === 'string') {
              errorMessages.push(`${field}: ${fieldErrors}`);
            }
          }
          setError(errorMessages.join('\n'));
        } else {
          setError(JSON.stringify(errors));
        }
      } else if (err.request) {
        setError('Сервер недоступен. Пожалуйста, проверьте соединение.');
      } else {
        setError('Ошибка при регистрации');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-[400px] animate-fadeIn">
        <h1 className="text-[28px] font-bold text-center mb-5">Регистрация в VibeTunes</h1>
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
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full h-[50px] bg-[#3E3E3E] text-white placeholder-[#B3B3B3] rounded-[5px] px-4 focus:outline-none focus:ring-2 focus:ring-vibe-green text-[16px] transition-all duration-200"
              placeholder="Имя пользователя"
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
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-[50px] bg-[#3E3E3E] text-white placeholder-[#B3B3B3] rounded-[5px] px-4 focus:outline-none focus:ring-2 focus:ring-vibe-green text-[16px] transition-all duration-200"
              placeholder="Подтвердите пароль"
              required
            />
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="isMusician"
                checked={isMusician}
                onChange={(e) => setIsMusician(e.target.checked)}
                className="w-4 h-4 text-vibe-green bg-[#3E3E3E] border-none rounded focus:ring-vibe-green"
              />
              <label htmlFor="isMusician" className="text-white">
                Я музыкант
              </label>
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-[50px] bg-vibe-green hover:bg-[#147D43] text-white font-medium rounded-[5px] mt-6 text-[16px] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
          <div className="mt-4 text-center">
            <span className="text-vibe-gray text-[14px]">Уже есть аккаунт? </span>
            <Link
              to="/login"
              className="text-vibe-green hover:text-[#147D43] font-medium text-[14px] transition-colors duration-200"
            >
              Войти
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}