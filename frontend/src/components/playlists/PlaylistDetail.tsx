import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../../utils/axios';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { PlayIcon, PauseIcon, TrashIcon } from '@heroicons/react/24/solid';

interface ApiPlaylistTrack {
  id: number;
  title: string;
  genre: string;
  audio_file: string;
  cover_image?: string | null;
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
  tracks: ApiPlaylistTrack[];
}

interface PlayerTrack {
  id: number;
  title: string;
  musician_name?: string;
  audio_file: string;
  cover_image?: string | null;
  genre?: string;
}

export default function PlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [availableTracks, setAvailableTracks] = useState<ApiPlaylistTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const {
    loadQueueAndPlay,
    currentTrack,
    isPlaying,
    togglePlayPause,
  } = useAudioPlayer();

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const playlistResponse = await axios.get<Playlist>(`/playlists/${id}/`);
      setPlaylist(playlistResponse.data);
      
      const tracksResponse = await axios.get<ApiPlaylistTrack[]>('/tracks/');
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

  const handlePlayPauseTrack = (clickedTrack: ApiPlaylistTrack, trackIndex: number) => {
    if (!playlist) return;

    if (currentTrack?.id === clickedTrack.id) {
      togglePlayPause();
    } else {
      const playerQueue: PlayerTrack[] = playlist.tracks.map(apiTrack => ({
        id: apiTrack.id,
        title: apiTrack.title,
        musician_name: apiTrack.musician.username,
        audio_file: apiTrack.audio_file,
        cover_image: apiTrack.cover_image,
        genre: apiTrack.genre,
      }));
      loadQueueAndPlay(playerQueue, trackIndex);
    }
    logPlayInteraction(clickedTrack.id);
  };

  const logPlayInteraction = async (trackId: number) => {
    try {
      await axios.post(`/tracks/${trackId}/play/`);
    } catch (err) {
      console.error('Error logging play interaction for track:', trackId, err);
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
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
        >
          Вернуться к плейлистам
        </button>
      </div>
    );
  }

  if (!playlist) return null;

  const tracksNotInPlaylist = availableTracks.filter(
    availTrack => !playlist.tracks.some(playlistTrack => playlistTrack.id === availTrack.id)
  );

  return (
    <div className="p-6 sm:p-8 text-white">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h1 className="text-3xl font-bold mb-2 sm:mb-0">{playlist.name}</h1>
        <button 
          onClick={() => navigate('/playlists')}
          className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
        >
          Назад к плейлистам
        </button>
      </div>
      
      {playlist.description && (
        <p className="text-neutral-400 mb-8 max-w-2xl">{playlist.description}</p>
      )}

      {error && (
        <div className="bg-red-700 border border-red-900 text-white p-3 rounded-lg mb-6">{error}</div>
      )}
      
      <div className="mb-10 bg-neutral-800 p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4">Добавить трек в плейлист</h2>
        <form onSubmit={handleAddTrack}>
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-grow">
              <label htmlFor="trackSelect" className="block text-sm text-neutral-300 mb-1">
                Выберите трек
              </label>
              <select
                id="trackSelect"
                value={selectedTrackId}
                onChange={(e) => setSelectedTrackId(e.target.value)}
                className="w-full h-12 bg-neutral-700 border border-neutral-600 text-white rounded-md px-4 focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none"
              >
                <option value="" disabled className="text-neutral-500">-- Выберите трек --</option>
                {tracksNotInPlaylist.map(track => (
                  <option key={track.id} value={track.id} className="text-white bg-neutral-700">
                    {track.title} - {track.musician.username}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={!selectedTrackId}
              className="h-12 bg-green-500 hover:bg-green-600 disabled:bg-neutral-600 text-white font-medium rounded-md px-6 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              Добавить
            </button>
          </div>
        </form>
      </div>
      
      <div>
        <h2 className="text-2xl font-semibold mb-4">Треки в плейлисте</h2>
        {playlist.tracks.length === 0 ? (
          <div className="text-neutral-400 py-4">В плейлисте пока нет треков.</div>
        ) : (
          <div className="bg-neutral-800 rounded-lg shadow-md overflow-hidden">
            <ul className="divide-y divide-neutral-700">
              {playlist.tracks.map((track, index) => (
                <li key={track.id} className="p-3 sm:p-4 hover:bg-neutral-750 transition-colors flex items-center space-x-3 sm:space-x-4">
                  <button 
                    onClick={() => handlePlayPauseTrack(track, index)}
                    className="p-2 rounded-full hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                    aria-label={currentTrack?.id === track.id && isPlaying ? "Pause" : "Play"}
                  >
                    {currentTrack?.id === track.id && isPlaying ? 
                      <PauseIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" /> : 
                      <PlayIcon className="w-5 h-5 sm:w-6 sm:h-6 text-neutral-300 hover:text-white" />
                    }
                  </button>
                  {track.cover_image && (
                      <img src={track.cover_image} alt={track.title} className="w-10 h-10 sm:w-12 sm:h-12 rounded object-cover hidden sm:block"/>
                  )}
                  <div className="flex-grow min-w-0">
                    <p className="text-sm sm:text-base font-medium text-white truncate" title={track.title}>{track.title}</p>
                    <p className="text-xs sm:text-sm text-neutral-400 truncate" title={track.musician.username}>{track.musician.username}</p>
                  </div>
                  <div className="text-xs sm:text-sm text-neutral-400 hidden md:block truncate px-2" title={track.genre}>{track.genre}</div>
                  <div className="text-xs sm:text-sm text-neutral-400 hidden lg:block px-2">
                    {track.plays} plays / {track.likes} likes
                  </div>
                  <button
                    onClick={() => handleRemoveTrack(track.id)}
                    className="p-2 rounded-full hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-red-500 ml-auto"
                    aria-label="Remove track"
                  >
                    <TrashIcon className="w-5 h-5 text-neutral-400 hover:text-red-400" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}