import { useState, useEffect } from 'react';
import axios from '../../utils/axios';
import { useAuth } from '../../contexts/AuthContext';

interface Track {
  id: number;
  title: string;
  plays: number;
  likes: number;
  genre: string;
  audio_url: string;
  created_at: string;
}

export default function Stats() {
  const [musicianTracks, setMusicianTracks] = useState<Track[]>([]);
  const [topByPlays, setTopByPlays] = useState<Track[]>([]);
  const [topByLikes, setTopByLikes] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.is_musician) {
      setError('Статистика доступна только для музыкантов');
      setIsLoading(false);
      return;
    }

    const fetchStats = async () => {
      setIsLoading(true);
      try {
        // Получаем данные общих чартов
        const chartsResponse = await axios.get('/tracks/charts/');
        setTopByPlays(chartsResponse.data.by_plays);
        setTopByLikes(chartsResponse.data.by_likes);
        
        // Получаем треки данного музыканта
        const tracksResponse = await axios.get(`/tracks/?musician=${user.id}`);
        setMusicianTracks(tracksResponse.data);
        
        setError('');
      } catch (err) {
        console.error('Ошибка при загрузке статистики:', err);
        setError('Не удалось загрузить статистику');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchStats();
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Статистика</h1>
      
      <div className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">Ваши треки</h2>
        {musicianTracks.length === 0 ? (
          <p className="text-vibe-gray">У вас пока нет треков</p>
        ) : (
          <div className="bg-[#282828] rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-[#1E1E1E]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-vibe-gray uppercase tracking-wider">Название</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-vibe-gray uppercase tracking-wider">Жанр</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-vibe-gray uppercase tracking-wider">Прослушивания</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-vibe-gray uppercase tracking-wider">Лайки</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-vibe-gray uppercase tracking-wider">Дата добавления</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {musicianTracks.map((track) => (
                  <tr key={track.id} className="hover:bg-[#333333]">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{track.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-vibe-gray">{track.genre}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-vibe-gray">{track.plays}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-vibe-gray">{track.likes}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-vibe-gray">
                      {new Date(track.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-semibold mb-4">Топ по прослушиваниям</h2>
          <ul className="bg-[#282828] rounded-lg p-4 space-y-3">
            {topByPlays.map((track, index) => (
              <li key={track.id} className="flex justify-between items-center">
                <div className="flex items-center">
                  <span className="text-vibe-gray w-8">{index + 1}.</span>
                  <span>{track.title}</span>
                </div>
                <span className="text-vibe-gray">{track.plays} прослушиваний</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div>
          <h2 className="text-2xl font-semibold mb-4">Топ по лайкам</h2>
          <ul className="bg-[#282828] rounded-lg p-4 space-y-3">
            {topByLikes.map((track, index) => (
              <li key={track.id} className="flex justify-between items-center">
                <div className="flex items-center">
                  <span className="text-vibe-gray w-8">{index + 1}.</span>
                  <span>{track.title}</span>
                </div>
                <span className="text-vibe-gray">{track.likes} лайков</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}