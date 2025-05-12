import { useState, useEffect } from 'react';
import axios from '../../utils/axios';
import { useAuth } from '../../contexts/AuthContext';

interface Track {
  id: number;
  title: string;
  genre: string;
  audio_url: string;
  cover_image?: string;
  recommendation_reason?: string;
  artist?: string;
}

export default function Recommendations() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const { user } = useAuth();

  // Доступные настроения
  const moods = [
    { value: '', label: 'Все настроения' },
    { value: 'energetic', label: 'Энергичное' },
    { value: 'relaxing', label: 'Расслабляющее' },
    { value: 'neutral', label: 'Нейтральное' }
  ];

  // Доступные жанры
  const genres = [
    { value: '', label: 'Все жанры' },
    { value: 'Pop', label: 'Поп' },
    { value: 'Rock', label: 'Рок' },
    { value: 'Hip-Hop', label: 'Хип-хоп' },
    { value: 'Electronic', label: 'Электронная' },
    { value: 'Jazz', label: 'Джаз' },
    { value: 'Classical', label: 'Классическая' },
    { value: 'R&B', label: 'R&B' },
    { value: 'Country', label: 'Кантри' }
  ];

  const fetchRecommendations = async (mood = '', genre = '', query = '') => {
    setLoading(true);
    setError(null);
    
    try {
      let url = '/tracks/recommendations/';
      const params = new URLSearchParams();
      
      if (mood) params.append('mood', mood);
      if (genre) params.append('genre', genre);
      if (query) params.append('query', query);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      console.log(`Fetching recommendations with URL: ${url}`);
      const response = await axios.get(url);
      
      if (response.data && Array.isArray(response.data)) {
        setTracks(response.data);
        
        if (response.data.length === 0) {
          setError('Не удалось найти рекомендации по заданным критериям.');
        }
      } else {
        console.error('Unexpected response format:', response.data);
        setError('Получен неверный формат данных от сервера.');
      }
    } catch (error) {
      console.error('Ошибка при загрузке рекомендаций:', error);
      setError('Произошла ошибка при загрузке рекомендаций. Пожалуйста, попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const handleMoodChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const mood = event.target.value;
    setSelectedMood(mood);
    fetchRecommendations(mood, selectedGenre);
  };

  const handleGenreChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const genre = event.target.value;
    setSelectedGenre(genre);
    fetchRecommendations(selectedMood, genre);
  };

  const handlePromptSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!prompt.trim()) return;
    
    fetchRecommendations(selectedMood, selectedGenre, prompt);
  };

  const handleLike = async (trackId: number) => {
    try {
      await axios.post(`/tracks/${trackId}/like/`);
      
      // Обновляем UI оптимистично
      setTracks(tracks.map(track => 
        track.id === trackId 
          ? { ...track, liked: true } 
          : track
      ));
      
      // Перезагружаем рекомендации после некоторой задержки
      setTimeout(() => {
        fetchRecommendations(selectedMood, selectedGenre, prompt);
      }, 1000);
    } catch (error) {
      console.error('Ошибка при добавлении лайка:', error);
    }
  };

  const handlePlay = async (trackId: number) => {
    try {
      await axios.post(`/tracks/${trackId}/play/`);
    } catch (error) {
      console.error('Ошибка при регистрации воспроизведения:', error);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-[24px] font-bold mb-5">Персонализированные рекомендации</h1>
      
      {/* Фильтры */}
      <div className="mb-8 flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-1/3">
          <label className="block text-vibe-gray mb-2">Настроение</label>
          <select 
            className="w-full p-2 rounded-[5px] bg-[#282828] border border-[#444]"
            value={selectedMood}
            onChange={handleMoodChange}
          >
            {moods.map(mood => (
              <option key={mood.value} value={mood.value}>{mood.label}</option>
            ))}
          </select>
        </div>
        
        <div className="w-full md:w-1/3">
          <label className="block text-vibe-gray mb-2">Жанр</label>
          <select 
            className="w-full p-2 rounded-[5px] bg-[#282828] border border-[#444]"
            value={selectedGenre}
            onChange={handleGenreChange}
          >
            {genres.map(genre => (
              <option key={genre.value} value={genre.value}>{genre.label}</option>
            ))}
          </select>
        </div>
        
        <div className="w-full md:w-1/3">
          <form onSubmit={handlePromptSubmit}>
            <label className="block text-vibe-gray mb-2">Поиск по запросу</label>
            <div className="flex">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Например: для вечеринки"
                className="flex-1 p-2 rounded-l-[5px] bg-[#282828] border border-[#444] border-r-0"
              />
              <button
                type="submit"
                className="px-4 bg-[#28a745] hover:bg-[#218838] text-white rounded-r-[5px]"
              >
                Найти
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Отображение результатов */}
      {loading ? (
        <div className="flex justify-center items-center h-[200px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      ) : error ? (
        <div className="text-center p-6 bg-[#282828] rounded-[10px]">
          <p className="text-vibe-gray">{error}</p>
          <button 
            onClick={() => fetchRecommendations()} 
            className="mt-4 px-4 py-2 bg-[#28a745] hover:bg-[#218838] text-white rounded-[5px]"
          >
            Попробовать снова
          </button>
        </div>
      ) : tracks.length === 0 ? (
        <div className="text-center p-6 bg-[#282828] rounded-[10px]">
          <p className="text-vibe-gray">Не удалось найти рекомендации по заданным критериям.</p>
          <p className="mt-2 text-vibe-gray">Попробуйте изменить фильтры или послушать больше треков.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tracks.map(track => (
            <div key={track.id} className="bg-[#282828] rounded-[10px] overflow-hidden">
              <div className="relative pb-[56.25%] bg-[#1a1a1a]">
                {track.cover_image ? (
                  <img 
                    src={track.cover_image} 
                    alt={track.title} 
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-16 h-16 text-[#555]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                  </div>
                )}
                <button 
                  onClick={() => handlePlay(track.id)}
                  className="absolute inset-0 w-full h-full flex items-center justify-center bg-black bg-opacity-40 opacity-0 hover:opacity-100 transition-opacity"
                >
                  <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82z" />
                  </svg>
                </button>
              </div>
              <div className="p-4">
                <h3 className="text-lg font-semibold truncate">{track.title}</h3>
                <p className="text-vibe-gray truncate">{track.artist || 'Неизвестный исполнитель'}</p>
                {track.recommendation_reason && (
                  <p className="mt-2 text-sm text-[#b3b3b3] italic">{track.recommendation_reason}</p>
                )}
                <div className="mt-3 flex justify-between items-center">
                  <span className="text-sm text-vibe-gray">{track.genre}</span>
                  <button 
                    onClick={() => handleLike(track.id)}
                    className="text-vibe-gray hover:text-[#28a745] transition-colors"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}