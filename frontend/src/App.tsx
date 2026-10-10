import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Welcome from './pages/Welcome/Welcome';
import Unlock from './pages/Unlock/Unlock';
import AppLayout from './components/layout/AppLayout';
import Home from './pages/Home/Home';
import DiaryList from './pages/Diary/DiaryList';
import DiaryEntry from './pages/Diary/DiaryEntry';
import Gallery from './pages/Gallery/Gallery';
import Notes from './pages/Notes/Notes';
import SettingsPage from './pages/Settings/Settings';
import {
  getActiveSession,
  setActiveSession,
  clearActiveSession,
} from './services/storageService';

export default function App() {
  const initialSession = getActiveSession();
  const [isAuthenticated, setIsAuthenticated] = useState(initialSession.isAuthenticated);
  const [isUnlocked, setIsUnlocked] = useState(initialSession.isUnlocked);

  useEffect(() => {
    setActiveSession({ isAuthenticated, isUnlocked });
  }, [isAuthenticated, isUnlocked]);

  const handleAuth = (authData?: { userId: string; email: string; token: string } | string) => {
    if (authData && typeof authData === 'object' && authData.userId) {
      setActiveSession({
        isAuthenticated: true,
        isUnlocked: false,
        userId: authData.userId,
        email: authData.email,
        token: authData.token,
      });
      setIsAuthenticated(true);
      setIsUnlocked(false);
    } else if (typeof authData === 'string') {
      const email = authData;
      const userId = `user_${email.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      setActiveSession({
        isAuthenticated: true,
        isUnlocked: false,
        userId,
        email,
      });
      setIsAuthenticated(true);
      setIsUnlocked(false);
    }
  };

  const handleUnlock = (newToken?: string) => {
    setActiveSession({
      isUnlocked: true,
      ...(newToken ? { token: newToken } : {}),
    });
    setIsUnlocked(true);
  };

  const handleLock = () => {
    setActiveSession({ isUnlocked: false });
    setIsUnlocked(false);
  };

  const handleSignOut = () => {
    clearActiveSession();
    setIsAuthenticated(false);
    setIsUnlocked(false);
  };

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Welcome onAuth={handleAuth} />} />
      <Route
        path="/unlock"
        element={
          isAuthenticated
            ? <Unlock onUnlock={handleUnlock} />
            : <Navigate to="/" replace />
        }
      />

      {/* Protected app routes */}
      <Route
        path="/"
        element={
          isAuthenticated && isUnlocked
            ? <AppLayout isLocked={!isUnlocked} onLock={handleLock} onSignOut={handleSignOut} />
            : <Navigate to={isAuthenticated ? '/unlock' : '/'} replace />
        }
      >
        <Route path="home"      element={<Home isLocked={!isUnlocked} />} />
        <Route path="diary"     element={<DiaryList />} />
        <Route path="diary/:id" element={<DiaryEntry />} />
        <Route path="gallery"   element={<Gallery />} />
        <Route path="notes"     element={<Notes />} />
        <Route path="todo"      element={<Notes initialType="todo" />} />
        <Route path="settings"  element={<SettingsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
