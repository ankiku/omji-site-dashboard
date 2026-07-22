import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const AUTH_KEY = 'osr_auth';
const TOKEN_KEY = 'osr_token';
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? `http://${window.location.hostname}:5000/api` : '/api');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, check if we have a saved session
  useEffect(() => {
    const loadSession = () => {
      try {
        const saved = localStorage.getItem(AUTH_KEY);
        const token = localStorage.getItem(TOKEN_KEY);
        if (saved && token) {
          const parsed = JSON.parse(saved);
          setUser({ uid: parsed.id, email: parsed.email });
          setUserProfile(parsed);
        } else {
          setUser(null);
          setUserProfile(null);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };

    loadSession();

    const handleAuthUpdate = (e) => {
      if (e.detail && e.detail.profile) {
        setUserProfile(e.detail.profile);
      }
    };

    window.addEventListener('ls-auth-update', handleAuthUpdate);
    window.addEventListener('ls-update', loadSession);
    return () => {
      window.removeEventListener('ls-auth-update', handleAuthUpdate);
      window.removeEventListener('ls-update', loadSession);
    };
  }, []);

  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      let errMsg = 'Invalid email or password';
      try {
        const data = await res.json();
        if (data.message) errMsg = data.message;
      } catch {}
      const err = new Error(errMsg);
      err.code = 'auth/invalid-credential';
      throw err;
    }

    const { token, profile } = await res.json();
    
    setUser({ uid: profile.id, email: profile.email });
    setUserProfile(profile);
    
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(AUTH_KEY, JSON.stringify(profile));
  };

  const logout = async () => {
    setUser(null);
    setUserProfile(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(AUTH_KEY);
  };

  const isAdmin = userProfile?.role === 'admin';
  const isEditor = userProfile?.role === 'editor';
  const canEditProject = (projectId) => {
    if (isAdmin) return true;
    if (isEditor && userProfile?.assignedProjectIds?.includes(projectId)) return true;
    return false;
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, login, logout, isAdmin, isEditor, canEditProject }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
