import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axios';

export default function UploadTrack() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [genre, setGenre] = useState('Pop');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const genres = [
    'Pop', 'Rock', 'Hip-Hop', 'Electronic',
    'Jazz', 'Classical', 'R&B', 'Country'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioFile) {
      setError('Пожалуйста, выберите аудио файл');
      return;
    }

    setIsLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('audio_file', audioFile);
    formData.append('genre', genre);
    if (coverImage) {
      formData.append('cover_image', coverImage);
    }

    try {
      console.log('Отправка данных трека:', { title, description, genre });
      
      // Используем сконфигурированный экземпляр axios и правильный URL
      await axiosInstance.post('/tracks/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('Трек успешно загружен');
      navigate('/tracks');
    } catch (err: any) {
      console.error('Ошибка при загрузке трека:', err);
      
      if (err.response) {
        // Если сервер вернул ошибку, показываем ее
        const serverError = err.response.data;
        if (typeof serverError === 'object') {
          // Форматируем объект ошибок в строку
          const errorMessages = [];
          for (const field in serverError) {
            if (Array.isArray(serverError[field])) {
              errorMessages.push(`${field}: ${serverError[field].join(', ')}`);
            } else {
              errorMessages.push(`${field}: ${serverError[field]}`);
            }
          }
          setError(errorMessages.join('\n'));
        } else {
          setError(typeof serverError === 'string' ? serverError : 'Ошибка при загрузке трека');
        }
      } else if (err.request) {
        // Запрос был отправлен, но ответ не получен
        setError('Сервер не отвечает. Проверьте подключение к интернету.');
      } else {
        // Что-то другое пошло не так
        setError('Ошибка при загрузке трека');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Загрузить трек</h1>
      <form onSubmit={handleSubmit} className="max-w-2xl">
        {error && (
          <div className="bg-red-500 text-white p-3 rounded mb-4 whitespace-pre-line">{error}</div>
        )}
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Название</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-10 bg-[#3E3E3E] text-white rounded px-3 focus:outline-none focus:ring-2 focus:ring-vibe-green"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-32 bg-[#3E3E3E] text-white rounded p-3 focus:outline-none focus:ring-2 focus:ring-vibe-green"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Жанр</label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full h-10 bg-[#3E3E3E] text-white rounded px-3 focus:outline-none focus:ring-2 focus:ring-vibe-green"
            >
              {genres.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Аудио файл</label>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-vibe-green file:text-white hover:file:bg-[#147D43]"
              required
            />
            <p className="mt-1 text-sm text-vibe-gray">Поддерживаемые форматы: MP3, WAV, OGG</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Обложка (опционально)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCoverImage(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-vibe-green file:text-white hover:file:bg-[#147D43]"
            />
            <p className="mt-1 text-sm text-vibe-gray">Рекомендуемый размер: 500x500 пикселей</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="mt-6 w-full h-12 bg-vibe-green hover:bg-[#147D43] text-white font-medium rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Загрузка...' : 'Загрузить трек'}
        </button>
      </form>
    </div>
  );
}