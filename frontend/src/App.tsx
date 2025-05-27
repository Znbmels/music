import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AudioPlayerProvider } from './contexts/AudioPlayerContext';
import Sidebar from './components/Sidebar';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import TrackList from './components/tracks/TrackList';
import UploadTrack from './components/tracks/UploadTrack';
import PlaylistList from './components/playlists/PlaylistList';
import PlaylistDetail from './components/playlists/PlaylistDetail';
import Stats from './components/stats/Stats';
import Recommendations from './components/tracks/Recommendations';
import PlayerBar from './components/player/PlayerBar';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Загрузка...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 ml-[240px] overflow-y-auto pb-[90px]">
        {children}
      </div>
      <PlayerBar />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AudioPlayerProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route 
              path="/*" 
              element={
                <ProtectedRoute>
                  <Routes>
                    <Route path="/" element={<TrackList />} />
                    <Route path="/tracks" element={<TrackList />} />
                    <Route path="/upload" element={<UploadTrack />} />
                    <Route path="/playlists" element={<PlaylistList />} />
                    <Route path="/playlists/:id" element={<PlaylistDetail />} />
                    <Route path="/recommendations" element={<Recommendations />} />
                    <Route path="/stats" element={<Stats />} />
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AudioPlayerProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;