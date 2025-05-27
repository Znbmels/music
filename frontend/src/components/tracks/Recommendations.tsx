import { useState, useEffect } from 'react';
import axios from '../../utils/axios';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid';

interface ApiRecommendedTrack {
  id: number;
  title: string;
  genre: string;
  audio_file: string;
  cover_image?: string | null;
  musician?: {
    username: string;
  };
}

interface PlayerTrack {
  id: number;
  title: string;
  musician_name?: string;
  audio_file: string;
  cover_image?: string | null;
  genre?: string;
}

export default function Recommendations() {
  const [tracks, setTracks] = useState<ApiRecommendedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const {
    loadQueueAndPlay,
    currentTrack,
    isPlaying,
    togglePlayPause,
  } = useAudioPlayer();

  useEffect(() => {
    const fetchRecommendations = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await axios.get<ApiRecommendedTrack[]>('/tracks/recommendations/');
        setTracks(response.data);
      } catch (err) {
        console.error('Ошибка при загрузке рекомендаций:', err);
        setError('Не удалось загрузить рекомендации.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchRecommendations();
  }, []);

  const handlePlayPause = (clickedTrack: ApiRecommendedTrack, queue: ApiRecommendedTrack[], trackIndex: number) => {
    if (currentTrack?.id === clickedTrack.id) {
      togglePlayPause();
    } else {
      const playerQueue: PlayerTrack[] = queue.map(apiTrack => ({
        id: apiTrack.id,
        title: apiTrack.title,
        musician_name: apiTrack.musician?.username || 'Unknown Artist',
        audio_file: apiTrack.audio_file,
        cover_image: apiTrack.cover_image,
        genre: apiTrack.genre,
      }));
      loadQueueAndPlay(playerQueue, trackIndex);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center text-neutral-400">
        Загрузка рекомендаций...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="p-6 text-white">
      <h1 className="text-3xl font-bold mb-6">Рекомендации для вас</h1>
      {tracks.length === 0 && !isLoading ? (
        <div className="text-neutral-400 text-center py-8">Пока нет персональных рекомендаций. Слушайте больше музыки!</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {tracks.map((track, index) => (
            <div
              key={track.id}
              className="bg-neutral-800 p-4 rounded-lg hover:bg-neutral-700 transition-colors duration-200 group relative"
            >
              <div className="relative aspect-square mb-3">
                <img
                  src={track.cover_image || 'https://via.placeholder.com/300?text=No+Cover'}
                  alt={track.title}
                  className="w-full h-full object-cover rounded-md bg-neutral-700"
                />
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
                <p className="text-neutral-400 text-sm truncate" title={track.musician?.username || track.genre}>
                  {track.musician?.username || track.genre} 
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}