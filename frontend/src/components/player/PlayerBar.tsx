import React from 'react';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { 
    PlayIcon, PauseIcon, ForwardIcon, BackwardIcon, 
    ArrowPathRoundedSquareIcon as RepeatIcon, // Placeholder for Repeat All
    ArrowUturnLeftIcon as RepeatOneIcon, // Placeholder for Repeat One
    ArrowsRightLeftIcon as ShuffleIcon // Placeholder for Shuffle
} from '@heroicons/react/24/solid'; // Using heroicons for player controls

// Helper to format time from seconds to MM:SS
const formatTime = (timeInSeconds: number): string => {
    if (isNaN(timeInSeconds) || timeInSeconds === Infinity) {
        return '00:00';
    }
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

export default function PlayerBar() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    repeatMode,
    shuffleMode,
    volume,
    togglePlayPause,
    playNext,
    playPrevious,
    seekTime,
    setRepeatMode,
    toggleShuffleMode,
    setVolume,
  } = useAudioPlayer();

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    seekTime(parseFloat(event.target.value));
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(event.target.value));
  };

  if (!currentTrack) {
    // Optionally, render a placeholder or nothing if no track is loaded
    return (
        <div className="fixed bottom-0 left-0 right-0 bg-neutral-800 text-white p-4 h-[80px] flex items-center justify-center z-50 border-t border-neutral-700">
            <p className="text-sm text-neutral-400">No track selected</p>
        </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-neutral-800 text-white p-4 h-[90px] flex flex-col justify-center z-50 border-t border-neutral-700">
      {/* Top part: Track info and main controls */}
      <div className="flex items-center justify-between w-full">
        {/* Left: Track Info */}
        <div className="flex items-center w-1/4">
          {currentTrack.cover_image && (
            <img src={currentTrack.cover_image} alt={currentTrack.title} className="w-12 h-12 rounded object-cover mr-3" />
          )}
          <div>
            <h3 className="text-sm font-semibold truncate" title={currentTrack.title}>{currentTrack.title}</h3>
            {/* Backend currently doesn't provide musician name directly on track object from recommendations, adjust if it does later */}
            <p className="text-xs text-neutral-400 truncate" title={currentTrack.musician_name || currentTrack.genre || 'Unknown Artist'}>
              {currentTrack.musician_name || currentTrack.genre || 'Unknown Artist'}
            </p>
          </div>
        </div>

        {/* Center: Player Controls */}
        <div className="flex flex-col items-center justify-center w-1/2">
            <div className="flex items-center space-x-3 mb-1">
                <button onClick={toggleShuffleMode} title="Shuffle" className={`p-1 ${shuffleMode ? 'text-green-400' : 'text-neutral-400 hover:text-white'}`}>
                    <ShuffleIcon className="w-5 h-5" />
                </button>
                <button onClick={playPrevious} title="Previous" className="p-1 text-neutral-300 hover:text-white">
                    <BackwardIcon className="w-6 h-6" />
                </button>
                <button 
                    onClick={togglePlayPause} 
                    title={isPlaying ? "Pause" : "Play"} 
                    className="p-2 bg-white text-black rounded-full hover:bg-neutral-200 transition-colors mx-1"
                >
                    {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                </button>
                <button onClick={playNext} title="Next" className="p-1 text-neutral-300 hover:text-white">
                    <ForwardIcon className="w-6 h-6" />
                </button>
                <button 
                    onClick={() => {
                        if (repeatMode === 'none') setRepeatMode('all');
                        else if (repeatMode === 'all') setRepeatMode('one');
                        else setRepeatMode('none');
                    }} 
                    title={`Repeat: ${repeatMode}`}
                    className={`p-1 ${repeatMode !== 'none' ? 'text-green-400' : 'text-neutral-400 hover:text-white'}`}
                >
                    {repeatMode === 'one' ? <RepeatOneIcon className="w-5 h-5" /> : <RepeatIcon className="w-5 h-5" />}
                </button>
            </div>
             {/* Progress Bar Area */}
            <div className="flex items-center w-full max-w-md">
                <span className="text-xs text-neutral-400 mr-2">{formatTime(currentTime)}</span>
                <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-green-500"
                disabled={!currentTrack || duration === 0}
                />
                <span className="text-xs text-neutral-400 ml-2">{formatTime(duration)}</span>
            </div>
        </div>


        {/* Right: Volume Control - Simple for now */}
        <div className="flex items-center justify-end w-1/4">
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={volume} 
            onChange={handleVolumeChange} 
            className="w-20 h-1 bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-green-500"
            title={`Volume: ${Math.round(volume * 100)}%`}
          />
        </div>
      </div>
    </div>
  );
} 