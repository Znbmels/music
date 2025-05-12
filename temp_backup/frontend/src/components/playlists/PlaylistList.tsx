import { useState, useEffect } from 'react';
import axios from '../../utils/axios';
import { Link } from 'react-router-dom';

interface Playlist {
  id: number;
  name: string;
  description?: string;
  tracks_count?: number;
  updated_at: string;
}

export default function PlaylistList() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchPlaylists = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get('/playlists/');
      // Check if response has 'results' property or is an array directly
      const playlistData = response.data.results || response.data;
      setPlaylists(playlistData);
      setError('');
    } catch (err) {
      console.error('Ошибка при загрузке плейлистов:', err);
      setError('Не удалось загрузить плейлисты');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) {
      setError('Введите название плейлиста');
      return;
    }
    
    setError('');
    try {
      const response = await axios.post('/playlists/', { 
        name: newPlaylistName, 
        description: '',
        is_public: false 
      });
      setPlaylists([...playlists, response.data]);
      setNewPlaylistName('');
    } catch (err) {
      console.error('Ошибка при создании плейлиста:', err);
      setError('Ошибка при создании плейлиста');
    }
  };

  const handleDeletePlaylist = async (id: number) => {
    try {
      await axios.delete(`/playlists/${id}/`);
      setPlaylists(playlists.filter((playlist) => playlist.id !== id));
    } catch (err) {
      console.error('Ошибка при удалении плейлиста:', err);
      setError('Ошибка при удалении плейлиста');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Мои плейлисты</h1>
      
      <form onSubmit={handleCreatePlaylist} className="mb-8">
        <div className="flex space-x-4">
          <input
            type="text"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            className="w-full max-w-xs h-[50px] bg-[#3E3E3E] text-white placeholder-vibe-gray rounded-[5px] px-4 focus:outline-none focus:ring-2 focus:ring-vibe-green"
            placeholder="Название плейлиста"
          />
          <button
            type="submit"
            className="h-[50px] bg-vibe-green hover:bg-[#147D43] text-white font-medium rounded-[5px] px-6 transition-colors duration-200"
          >
            Создать
          </button>
        </div>
        {error && (
          <div className="bg-red-500 text-white p-3 rounded-[5px] text-sm mt-3">{error}</div>
        )}
      </form>
      
      {playlists.length === 0 ? (
        <div className="text-vibe-gray">У вас пока нет плейлистов</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {playlists.map((playlist) => (
            <div key={playlist.id} className="bg-[#282828] rounded-lg overflow-hidden hover:bg-[#333333] transition-colors duration-200">
              <div className="p-5">
                <h3 className="text-xl font-semibold mb-2">{playlist.name}</h3>
                {playlist.description && (
                  <p className="text-vibe-gray text-sm mb-3">{playlist.description}</p>
                )}
                <div className="flex items-center justify-between text-sm text-vibe-gray mb-4">
                  <span>{playlist.tracks_count || 0} треков</span>
                  <span>Обновлён: {new Date(playlist.updated_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <Link
                    to={`/playlists/${playlist.id}`}
                    className="text-vibe-green hover:text-[#147D43] transition-colors duration-200"
                  >
                    Открыть
                  </Link>
                  <button
                    onClick={() => handleDeletePlaylist(playlist.id)}
                    className="text-red-500 hover:text-red-400 transition-colors duration-200"
                  >
                    Удалить
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