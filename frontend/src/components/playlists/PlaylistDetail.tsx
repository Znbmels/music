import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../../utils/axios';

interface Track {
  id: number;
  title: string;
  genre: string;
  audio_url: string;
  musician: {
    id: number;
    username: string;
  };
  plays: number;
  likes: number;
}

interface Playlist {
  id: number;
  name: string;
  description?: string;
  tracks: Track[];
}

export default function PlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [availableTracks, setAvailableTracks] = useState<Track[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Загружаем плейлист
      const playlistResponse = await axios.get(`/playlists/${id}/`);
      setPlaylist(playlistResponse.data);
      
      // Загружаем доступные треки
      const tracksResponse = await axios.get('/tracks/');
      setAvailableTracks(tracksResponse.data);
      
      setError('');
    } catch (err) {
      console.error('Ошибка при загрузке данных:', err);
      setError('Не удалось загрузить плейлист');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrackId) {
      setError('Выберите трек для добавления');
      return;
    }
    
    setError('');
    try {
      await axios.post(`/playlists/${id}/add_track/`, { 
        track_id: parseInt(selectedTrackId) 
      });
      fetchData();
      setSelectedTrackId('');
    } catch (err) {
      console.error('Ошибка при добавлении трека:', err);
      setError('Не удалось добавить трек в плейлист');
    }
  };

  const handleRemoveTrack = async (trackId: number) => {
    try {
      await axios.post(`/playlists/${id}/remove_track/`, { track_id: trackId });
      fetchData();
    } catch (err) {
      console.error('Ошибка при удалении трека:', err);
      setError('Не удалось удалить трек из плейлиста');
    }
  };

  const handlePlayTrack = async (track: Track) => {
    try {
      // Регистрируем прослушивание трека
      await axios.post(`/tracks/${track.id}/play/`);
      
      // Здесь можно добавить код для воспроизведения аудио
      const audio = new Audio(track.audio_url);
      audio.play();
    } catch (err) {
      console.error('Ошибка при воспроизведении трека:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white">Загрузка...</div>
      </div>
    );
  }

  if (error && !playlist) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-red-500 mb-4">{error}</div>
        <button 
          onClick={() => navigate('/playlists')}
          className="px-4 py-2 bg-vibe-green text-white rounded-lg"
        >
          Вернуться к плейлистам
        </button>
      </div>
    );
  }

  if (!playlist) return null;

  // Фильтруем треки, которые еще не добавлены в плейлист
  const tracksNotInPlaylist = availableTracks.filter(
    track => !playlist.tracks.some(playlistTrack => playlistTrack.id === track.id)
  );

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{playlist.name}</h1>
        <button 
          onClick={() => navigate('/playlists')}
          className="px-4 py-2 text-vibe-gray hover:text-white"
        >
          Назад к плейлистам
        </button>
      </div>
      
      {playlist.description && (
        <p className="text-vibe-gray mb-8">{playlist.description}</p>
      )}

      {error && (
        <div className="bg-red-500 text-white p-3 rounded-lg mb-6">{error}</div>
      )}
      
      <div className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">Добавить трек</h2>
        <form onSubmit={handleAddTrack} className="bg-[#282828] p-5 rounded-lg">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-grow">
              <label htmlFor="trackSelect" className="block text-sm text-vibe-gray mb-2">
                Выберите трек
              </label>
              <select
                id="trackSelect"
                value={selectedTrackId}
                onChange={(e) => setSelectedTrackId(e.target.value)}
                className="w-full h-[50px] bg-[#3E3E3E] text-white rounded-[5px] px-4 focus:outline-none focus:ring-2 focus:ring-vibe-green"
              >
                <option value="">-- Выберите трек --</option>
                {tracksNotInPlaylist.map(track => (
                  <option key={track.id} value={track.id}>
                    {track.title} - {track.musician.username}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="h-[50px] bg-vibe-green hover:bg-[#147D43] text-white font-medium rounded-[5px] px-6 transition-colors duration-200"
            >
              Добавить
            </button>
          </div>
        </form>
      </div>
      
      <div>
        <h2 className="text-2xl font-semibold mb-4">Треки в плейлисте</h2>
        {playlist.tracks.length === 0 ? (
          <div className="text-vibe-gray">В плейлисте пока нет треков</div>
        ) : (
          <div className="bg-[#282828] rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-[#1E1E1E]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-vibe-gray uppercase tracking-wider">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-vibe-gray uppercase tracking-wider">Название</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-vibe-gray uppercase tracking-wider">Исполнитель</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-vibe-gray uppercase tracking-wider">Жанр</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-vibe-gray uppercase tracking-wider">Статистика</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-vibe-gray uppercase tracking-wider">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {playlist.tracks.map((track, index) => (
                  <tr key={track.id} className="hover:bg-[#333333]">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{track.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-vibe-gray">{track.musician.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-vibe-gray">{track.genre}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-vibe-gray text-center">
                      <div className="flex items-center justify-center space-x-4">
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          </svg>
                          {track.plays}
                        </span>
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                          {track.likes}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                      <div className="flex justify-end space-x-3">
                        <button
                          onClick={() => handlePlayTrack(track)}
                          className="text-vibe-green hover:text-[#147D43] transition-colors duration-200"
                        >
                          Слушать
                        </button>
                        <button
                          onClick={() => handleRemoveTrack(track.id)}
                          className="text-red-500 hover:text-red-400 transition-colors duration-200"
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}