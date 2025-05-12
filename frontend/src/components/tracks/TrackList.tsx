import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import axiosInstance from '../../utils/axios';

interface Track {
  id: number;
  title: string;
  description: string;
  audio_url: string;
  cover_url: string | null;
  plays: number;
  likes: number;
  genre: string;
  musician: {
    id: number;
    username: string;
    email: string;
  };
}

export default function TrackList() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    fetchTracks();
  }, []);

  const fetchTracks = async () => {
    try {
      const response = await axiosInstance.get('/tracks/');
      setTracks(response.data);
    } catch (err) {
      setError('Не удалось загрузить треки');
      console.error('Error fetching tracks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlay = async (trackId: number) => {
    try {
      await axiosInstance.post(`/tracks/${trackId}/play/`);
      // Обновляем список треков после увеличения счетчика прослушиваний
      fetchTracks();
    } catch (err) {
      console.error('Error playing track:', err);
    }
  };

  const handleLike = async (trackId: number) => {
    try {
      await axiosInstance.post(`/tracks/${trackId}/like/`);
      // Обновляем список треков после добавления лайка
      fetchTracks();
    } catch (err) {
      console.error('Error liking track:', err);
    }
  };

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
      <h1 className="text-3xl font-bold mb-6">Треки</h1>
      {tracks.length === 0 ? (
        <div className="text-vibe-gray">Треков пока нет</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tracks.map((track) => (
            <div
              key={track.id}
              className="bg-[#282828] p-4 rounded-lg hover:bg-[#333333] transition-colors duration-200"
            >
              <div className="relative aspect-square mb-4">
                {track.cover_url ? (
                  <img
                    src={track.cover_url}
                    alt={track.title}
                    className="w-full h-full object-cover rounded-md"
                  />
                ) : (
                  <div className="w-full h-full bg-[#3E3E3E] rounded-md flex items-center justify-center">
                    <span className="text-vibe-gray">Нет обложки</span>
                  </div>
                )}
                <button
                  onClick={() => handlePlay(track.id)}
                  className="absolute bottom-2 right-2 bg-vibe-green hover:bg-[#147D43] text-white p-2 rounded-full shadow-lg transition-colors duration-200"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                  </svg>
                </button>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">{track.title}</h3>
                <p className="text-vibe-gray text-sm">{track.musician.username}</p>
                <div className="flex items-center justify-between text-sm text-vibe-gray">
                  <span>{track.genre}</span>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                        />
                      </svg>
                      <span>{track.plays}</span>
                    </div>
                    <button
                      onClick={() => handleLike(track.id)}
                      className="flex items-center space-x-1 hover:text-vibe-green transition-colors duration-200"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        />
                      </svg>
                      <span>{track.likes}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}