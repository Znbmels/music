import React, { createContext, useContext, useReducer, useRef, useEffect, type ReactNode } from 'react';

// 1. Define Types
interface Track {
  id: number;
  title: string;
  // Assuming musician info is part of track or can be derived. For now, let's use a simple structure.
  // We might need to adjust this based on the actual Track model from the backend.
  musician_name?: string; // Or musician: { name: string; };
  audio_file: string; // URL to the audio file. Renamed from audio_url for consistency with backend model
  cover_image?: string | null; // Allow null here as well
  genre?: string; // Keep genre if needed by player, or remove if only for display elsewhere
}

interface AudioPlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playQueue: Track[];
  currentQueueIndex: number;
  repeatMode: 'none' | 'one' | 'all';
  shuffleMode: boolean;
  volume: number; // 0 to 1
}

type AudioPlayerAction = 
  | { type: 'SET_TRACK'; payload: { track: Track; queue: Track[]; queueIndex: number } }
  | { type: 'TOGGLE_PLAY_PAUSE' }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'NEXT_TRACK' }
  | { type: 'PREVIOUS_TRACK' }
  | { type: 'SET_CURRENT_TIME'; payload: number }
  | { type: 'SET_DURATION'; payload: number }
  | { type: 'SET_VOLUME'; payload: number }
  | { type: 'SET_REPEAT_MODE'; payload: 'none' | 'one' | 'all' }
  | { type: 'TOGGLE_SHUFFLE_MODE' }
  | { type: 'TRACK_ENDED' }
  | { type: 'LOAD_QUEUE'; payload: { queue: Track[]; startIndex?: number } };

interface AudioPlayerContextType extends AudioPlayerState {
  // Dispatcher functions to be called by components
  playTrack: (track: Track, queue: Track[], queueIndex: number) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seekTime: (time: number) => void;
  setVolume: (volume: number) => void;
  setRepeatMode: (mode: 'none' | 'one' | 'all') => void;
  toggleShuffleMode: () => void;
  loadQueueAndPlay: (queue: Track[], startIndex?: number) => void;
  audioRef: React.RefObject<HTMLAudioElement>; // Expose audio ref for direct manipulation if needed elsewhere (e.g. visualizers)
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

// 2. Initial State
const initialState: AudioPlayerState = {
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playQueue: [],
  currentQueueIndex: -1,
  repeatMode: 'none',
  shuffleMode: false,
  volume: 0.8, // Default volume
};

// 3. Reducer Function
const audioPlayerReducer = (state: AudioPlayerState, action: AudioPlayerAction): AudioPlayerState => {
  switch (action.type) {
    case 'SET_TRACK':
      return {
        ...state,
        currentTrack: action.payload.track,
        playQueue: action.payload.queue,
        currentQueueIndex: action.payload.queueIndex,
        isPlaying: true, // Auto-play when a new track is set
        currentTime: 0, // Reset time for new track
        duration: 0,    // Reset duration until loaded
      };
    case 'TOGGLE_PLAY_PAUSE':
      return { ...state, isPlaying: !state.isPlaying };
    case 'PLAY':
        return { ...state, isPlaying: true };
    case 'PAUSE':
        return { ...state, isPlaying: false };
    case 'SET_CURRENT_TIME':
      return { ...state, currentTime: action.payload };
    case 'SET_DURATION':
      return { ...state, duration: action.payload };
    case 'SET_VOLUME':
      return { ...state, volume: Math.max(0, Math.min(1, action.payload)) }; // Clamp between 0 and 1
    case 'NEXT_TRACK':
      if (!state.currentTrack) return state;
      // Logic for shuffle and repeat will be handled in the provider effects or a dedicated function
      // This reducer action just signals the intent
      return state; // Actual next track logic will be in useEffect in Provider
    case 'PREVIOUS_TRACK':
      if (!state.currentTrack) return state;
      // Logic for shuffle and repeat will be handled in the provider effects or a dedicated function
      return state; // Actual prev track logic will be in useEffect in Provider
    case 'SET_REPEAT_MODE':
      return { ...state, repeatMode: action.payload };
    case 'TOGGLE_SHUFFLE_MODE':
      return { ...state, shuffleMode: !state.shuffleMode };
    case 'TRACK_ENDED':
      // This action signals that a track ended. Provider will handle what to do next.
      return { ...state, isPlaying: false }; // Stop playing by default
    case 'LOAD_QUEUE':
      {
        const newTrack = action.payload.queue[action.payload.startIndex || 0] || null;
        return {
            ...state,
            playQueue: action.payload.queue,
            currentQueueIndex: action.payload.startIndex || 0,
            currentTrack: newTrack,
            isPlaying: !!newTrack, // Play if a track is successfully loaded
            currentTime: 0,
            duration: 0,
        };
      }
    default:
      return state;
  }
};

// 4. Context Provider Component
export const AudioPlayerProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(audioPlayerReducer, initialState);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Effects for audio element interactions
  useEffect(() => {
    if (!audioRef.current) return;
    if (state.isPlaying) {
      audioRef.current.play().catch(error => console.error("Error playing audio:", error));
    } else {
      audioRef.current.pause();
    }
  }, [state.isPlaying, state.currentTrack]); // Re-run if isPlaying or currentTrack changes

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = state.volume;
  }, [state.volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => dispatch({ type: 'SET_CURRENT_TIME', payload: audio.currentTime });
    const handleLoadedMetadata = () => dispatch({ type: 'SET_DURATION', payload: audio.duration });
    const handleEnded = () => dispatch({ type: 'TRACK_ENDED' });
    // Add more error handling if needed
    const handleError = (e: Event) => console.error("Audio Element Error:", e);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

  // Load new track source when currentTrack changes
  useEffect(() => {
    if (audioRef.current && state.currentTrack) {
      audioRef.current.src = state.currentTrack.audio_file;
      audioRef.current.load(); // Load the new source
      if (state.isPlaying) {
         // Ensure play is attempted after src change and load
        audioRef.current.play().catch(error => console.error("Error playing audio after src change:", error));
      }
    }
  }, [state.currentTrack]);

  // Helper function to determine next track index based on shuffle/repeat
  const getNextQueueIndex = () => {
    const { playQueue, currentQueueIndex, shuffleMode } = state;
    if (playQueue.length === 0) return -1;

    if (shuffleMode) {
      // Simple shuffle: pick a random track different from current one
      // More robust shuffle would shuffle the queue and play linearly, or keep track of played songs in shuffle mode
      let nextIndex;
      do {
        nextIndex = Math.floor(Math.random() * playQueue.length);
      } while (playQueue.length > 1 && nextIndex === currentQueueIndex);
      return nextIndex;
    } else {
      return (currentQueueIndex + 1) % playQueue.length;
    }
  };
  
  const getPreviousQueueIndex = () => {
    const { playQueue, currentQueueIndex, shuffleMode } = state;
    if (playQueue.length === 0) return -1;

    if (shuffleMode) {
      // In shuffle, "previous" might be tricky. Simplest is to pick another random track.
      // Or, maintain a history of played tracks in shuffle mode.
      // For now, let's make it behave like non-shuffle for previous in shuffle.
      return (currentQueueIndex - 1 + playQueue.length) % playQueue.length;
    } else {
      return (currentQueueIndex - 1 + playQueue.length) % playQueue.length;
    }
  };

  // Effect for handling TRACK_ENDED (repeat, next track, etc.)
  useEffect(() => {
    if (state.currentTime > 0 && state.duration > 0 && state.currentTime >= state.duration - 0.5) { // Track considered ended
        if (state.repeatMode === 'one' && state.currentTrack) {
            if(audioRef.current) audioRef.current.currentTime = 0;
            dispatch({ type: 'PLAY' });
        } else {
            const nextIndex = getNextQueueIndex();
            if (nextIndex !== -1 && (state.repeatMode === 'all' || nextIndex !== 0 || state.playQueue.length === 1)) {
                 // If repeat all is on, or if it's not the start of a non-repeating queue
                const nextTrack = state.playQueue[nextIndex];
                dispatch({ type: 'SET_TRACK', payload: { track: nextTrack, queue: state.playQueue, queueIndex: nextIndex } });
            } else if (nextIndex === 0 && state.repeatMode !== 'all' && state.playQueue.length > 0 ){
                // Reached end of queue and not repeating all, stop.
                dispatch({ type: 'PAUSE' });
                 // Optionally, reset to the beginning of the queue but paused
                 // dispatch({ type: 'SET_TRACK', payload: { track: state.playQueue[0], queue: state.playQueue, queueIndex: 0 } });
                 // dispatch({ type: 'PAUSE' }); 
            } else {
                dispatch({ type: 'PAUSE' }); // If no next track or not repeating all
            }
        }
    }
  }, [state.currentTime, state.duration, state.repeatMode, state.currentTrack, state.playQueue, state.shuffleMode]);

  // Action dispatchers (functions to be called by components)
  const playTrack = (track: Track, queue: Track[], queueIndex: number) => {
    dispatch({ type: 'SET_TRACK', payload: { track, queue, queueIndex } });
  };

  const togglePlayPause = () => {
    if (!state.currentTrack && state.playQueue.length > 0) {
        // If no current track but queue exists, play first from queue
        playTrack(state.playQueue[0], state.playQueue, 0);
    } else if (state.currentTrack) {
        dispatch({ type: 'TOGGLE_PLAY_PAUSE' });
    }
  };

  const playNext = () => {
    const { playQueue, shuffleMode, repeatMode } = state;
    if (playQueue.length === 0) return;

    let nextIndex = state.currentQueueIndex;

    if (repeatMode === 'one' && audioRef.current) {
        audioRef.current.currentTime = 0;
        dispatch({ type: 'PLAY' });
        return;
    }

    if (shuffleMode) {
        let randomIndex;
        if (playQueue.length === 1) {
            randomIndex = 0;
        } else {
            do {
                randomIndex = Math.floor(Math.random() * playQueue.length);
            } while (randomIndex === state.currentQueueIndex);
        }
        nextIndex = randomIndex;
    } else {
        nextIndex = (state.currentQueueIndex + 1) % playQueue.length;
    }

    if (!shuffleMode && nextIndex === 0 && repeatMode !== 'all') {
        // Reached end of queue, not shuffling, and not repeating all
        const nextTrack = playQueue[nextIndex];
        dispatch({ type: 'SET_TRACK', payload: { track: nextTrack, queue: playQueue, queueIndex: nextIndex } });
        // Wait a tick for state to update then pause
        setTimeout(() => dispatch({ type: 'PAUSE' }), 0);
        if(audioRef.current) audioRef.current.currentTime = 0;
        return;
    }

    const nextTrack = playQueue[nextIndex];
    dispatch({ type: 'SET_TRACK', payload: { track: nextTrack, queue: playQueue, queueIndex: nextIndex } });
  };

  const playPrevious = () => {
    const { playQueue, shuffleMode } = state;
    if (playQueue.length === 0) return;

    let prevIndex;
    if (shuffleMode) {
        // Simplistic: go to actual previous in shuffled sequence or random if no history
        // This could be improved with a history stack for shuffle mode
        if (playQueue.length === 1) {
            prevIndex = 0;
        } else {
            do {
                prevIndex = Math.floor(Math.random() * playQueue.length);
            } while (prevIndex === state.currentQueueIndex);
        }
    } else {
        prevIndex = (state.currentQueueIndex - 1 + playQueue.length) % playQueue.length;
    }
    
    const prevTrack = playQueue[prevIndex];
    dispatch({ type: 'SET_TRACK', payload: { track: prevTrack, queue: playQueue, queueIndex: prevIndex } });
  };


  const seekTime = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      dispatch({ type: 'SET_CURRENT_TIME', payload: time });
    }
  };

  const setVolume = (volume: number) => {
    dispatch({ type: 'SET_VOLUME', payload: volume });
  };

  const setRepeatMode = (mode: 'none' | 'one' | 'all') => {
    dispatch({ type: 'SET_REPEAT_MODE', payload: mode });
  };

  const toggleShuffleMode = () => {
    dispatch({ type: 'TOGGLE_SHUFFLE_MODE' });
    // Optional: If shuffling is turned on, and a track is playing, 
    // you might want to reshuffle the rest of the queue or create a new shuffled queue.
    // For now, it will just affect the *next* track selection.
  };

  const loadQueueAndPlay = (queue: Track[], startIndex: number = 0) => {
    dispatch({ type: 'LOAD_QUEUE', payload: { queue, startIndex } });
  }

  return (
    <AudioPlayerContext.Provider value={{ ...state, playTrack, togglePlayPause, playNext, playPrevious, seekTime, setVolume, setRepeatMode, toggleShuffleMode, loadQueueAndPlay, audioRef }}>
      {children}
      <audio ref={audioRef} /> {/* Hidden audio element controlled by the context */}
    </AudioPlayerContext.Provider>
  );
};

// 5. Custom Hook for using the context
export const useAudioPlayer = () => {
  const context = useContext(AudioPlayerContext);
  if (context === undefined) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
}; 