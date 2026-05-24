import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import api from '@/api/client';
import { useNavigate } from 'react-router-dom';

interface AuthState {
  token: string | null;
  user: { email: string } | null;
}

interface AuthContextProps extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  signup: (email: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const navigate = useNavigate();

  const login = async (email: string, password: string) => {
    const resp = await api.post('/auth-local/login', { email, password });
    const t = resp.data.token;
    localStorage.setItem('dj_token', t);
    setToken(t);
    setUser({ email });
    navigate('/dashboard');
  };

  const signup = async (email: string, password: string) => {
    const resp = await api.post('/auth-local/signup', { email, password });
    const t = resp.data.token;
    localStorage.setItem('dj_token', t);
    setToken(t);
    setUser({ email });
    navigate('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('dj_token');
    setToken(null);
    setUser(null);
    navigate('/login');
  };

  // Persist login on refresh
  useEffect(() => {
    const stored = localStorage.getItem('dj_token');
    if (stored) {
      setToken(stored);
      // decode email simply (in real app verify with backend)
      const payload = JSON.parse(atob(stored.split('.')[1]));
      setUser({ email: payload.email });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, signup }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
