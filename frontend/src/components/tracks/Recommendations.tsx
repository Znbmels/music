import { useState, useEffect } from 'react';
import axios from '../../utils/axios';

interface Track {
  id: number;
  title: string;
  genre: string;
  audio_url: string;
  cover_image?: string;
}

export default function Recommendations() {
  const [tracks, setTracks] = useState<Track[]>([]);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const response = await axios.get('/tracks/recommendations/');
        setTracks(response.data);
      } catch (error) {
        console.error('Ошибка при загрузке рекомендаций:', error);
      }
    };
    fetchRecommendations();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-[24px] font-bold mb-5">Рекомендации</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {tracks.map((track) => (
          <div key={track.id} className="bg-[#282828] rounded-[8px] p-4 shadow-md hover:scale-105 transition-transform">
            <img
              src={track.cover_image || 'https://via.placeholder.com/150'}
              alt={track.title}
              className="w-full h-[150px] object-cover rounded-[5px] mb-3"
            />
            <h3 className="text-[16px] font-semibold">{track.title}</h3>
            <p className="text-vibe-gray text-[12px]">{track.genre}</p>
            <audio controls src={track.audio_url} className="w-full mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}