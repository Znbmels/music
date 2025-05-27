import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import axiosInstance from '../../utils/axios';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { PlayIcon, PauseIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/solid';

interface ApiTrack {
  id: number;
  title: string;
  description: string;
  audio_file: string;
  cover_image: string | null;
  plays: number;
  likes: number;
  genre: string;
  musician: {
    id: number;
    username: string;
    email: string;
  };
  liked_by_user?: boolean;
}

interface PlayerTrack {
  id: number;
  title: string;
  musician_name?: string;
  audio_file: string;
  cover_image?: string | null;
  genre?: string;
}

export default function TrackList() {
  const [tracks, setTracks] = useState<ApiTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const {
    loadQueueAndPlay,
    currentTrack,
    isPlaying,
    togglePlayPause,
  } = useAudioPlayer();

  const fetchTracks = useCallback(async (currentSearchTerm: string = '') => {
    setIsLoading(true);
    setError('');
    try {
      let url = '/tracks/';
      if (currentSearchTerm) {
        url += `?search=${encodeURIComponent(currentSearchTerm)}`;
      }
      const response = await axiosInstance.get<ApiTrack[]>(url);
      setTracks(response.data);
    } catch (err) {
      setError('Не удалось загрузить треки');
      console.error('Error fetching tracks:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTracks(searchTerm);
  }, [searchTerm, fetchTracks]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(searchInput);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchTerm('');
  };

  const handlePlayPause = (clickedTrack: ApiTrack, queue: ApiTrack[], trackIndex: number) => {
    if (currentTrack?.id === clickedTrack.id) {
      togglePlayPause();
    } else {
      const playerQueue: PlayerTrack[] = queue.map(apiTrack => ({
        id: apiTrack.id,
        title: apiTrack.title,
        musician_name: apiTrack.musician.username,
        audio_file: apiTrack.audio_file,
        cover_image: apiTrack.cover_image,
        genre: apiTrack.genre
      }));
      loadQueueAndPlay(playerQueue, trackIndex);
    }
    logPlayInteraction(clickedTrack.id);
  };

  const logPlayInteraction = async (trackId: number) => {
    try {
      await axiosInstance.post(`/tracks/${trackId}/play/`);
    } catch (err) {
      console.error('Error logging play interaction for track:', trackId, err);
    }
  };

  const handleLike = async (trackId: number) => {
    try {
      await axiosInstance.post(`/tracks/${trackId}/like/`);
      setTracks(prevTracks => 
        prevTracks.map(t => t.id === trackId ? { ...t, likes: t.likes + (t.liked_by_user ? -1 : 1), liked_by_user: !t.liked_by_user } : t)
      );
    } catch (err) {
      console.error('Error liking track:', trackId, err);
    }
  };

  if (isLoading && tracks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white">Загрузка...</div>
      </div>
    );
  }

  if (error && tracks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 text-white">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold">Треки</h1>
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-grow sm:flex-grow-0">
            <input 
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Поиск треков..."
              className="bg-neutral-700 border border-neutral-600 text-white placeholder-neutral-400 text-sm rounded-lg focus:ring-green-500 focus:border-green-500 block w-full p-2.5 pl-10"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <MagnifyingGlassIcon className="w-5 h-5 text-neutral-400" />
            </div>
          </div>
          <button type="submit" className="p-2.5 text-sm font-medium text-white bg-green-500 rounded-lg border border-green-600 hover:bg-green-600 focus:ring-2 focus:outline-none focus:ring-green-400">
            Найти
          </button>
          {searchTerm && (
            <button 
              type="button"
              onClick={clearSearch}
              className="p-2.5 text-sm font-medium text-neutral-300 bg-neutral-600 rounded-lg border border-neutral-500 hover:bg-neutral-500 focus:ring-2 focus:outline-none focus:ring-neutral-400"
              title="Очистить поиск"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
        </form>
      </div>

      {error && tracks.length > 0 && (
        <div className="bg-red-700 border border-red-900 text-white p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {isLoading && tracks.length > 0 && (
        <div className="text-center py-4 text-neutral-400">Обновление списка треков...</div>
      )}

      {!isLoading && tracks.length === 0 ? (
        <div className="text-neutral-400 text-center py-10">
          {searchTerm ? `По запросу "${searchTerm}" ничего не найдено.` : 'Треков пока нет. Попробуйте изменить поиск или загляните позже.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {tracks.map((track, index) => (
            <div
              key={track.id}
              className="bg-neutral-800 p-4 rounded-lg hover:bg-neutral-700 transition-colors duration-200 group relative shadow-lg"
            >
              <div className="relative aspect-square mb-3">
                {track.cover_image ? (
                  <img
                    src={track.cover_image}
                    alt={track.title}
                    className="w-full h-full object-cover rounded-md bg-neutral-700"
                  />
                ) : (
                  <div className="w-full h-full bg-neutral-700 rounded-md flex items-center justify-center">
                    <svg className="w-12 h-12 text-neutral-500" fill="currentColor" viewBox="0 0 20 20"><path d="M2.5 1A1.5 1.5 0 0 0 1 2.5v15A1.5 1.5 0 0 0 2.5 19h15a1.5 1.5 0 0 0 1.5-1.5v-15A1.5 1.5 0 0 0 17.5 1h-15zM10 0a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM5 11h10V9H5v2z"/></svg>
                  </div>
                )}
                <button
                  onClick={() => handlePlayPause(track, tracks, index)}
                  className="absolute bottom-2 right-2 bg-green-500 hover:bg-green-400 text-white p-3 rounded-full shadow-lg transition-all duration-300 opacity-0 group-hover:opacity-100 group-hover:bottom-4 focus:outline-none focus:ring-2 focus:ring-green-300"
                  aria-label={currentTrack?.id === track.id && isPlaying ? "Pause" : "Play"}
                >
                  {currentTrack?.id === track.id && isPlaying ? (
                    <PauseIcon className="w-6 h-6" />
                  ) : (
                    <PlayIcon className="w-6 h-6" />
                  )}
                </button>
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-base text-white truncate" title={track.title}>{track.title}</h3>
                <p className="text-neutral-400 text-sm truncate" title={track.musician.username}>{track.musician.username}</p>
                <div className="flex items-center justify-between text-xs text-neutral-500 pt-1">
                  <span className="truncate" title={track.genre}>{track.genre}</span>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1" title={`${track.plays} plays`}>
                      <PlayIcon className="h-3 w-3" /> 
                      <span>{track.plays}</span>
                    </div>
                    <button
                      onClick={() => handleLike(track.id)} 
                      className={`flex items-center space-x-1 transition-colors duration-200 focus:outline-none ${track.liked_by_user ? 'text-green-400' : 'hover:text-green-400'}`}
                      aria-label="Like track"
                      title={`${track.likes} likes`}
                    >
                       <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${track.liked_by_user ? 'fill-current text-green-400' : 'fill-none'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
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