import { createContext, useContext, useMemo, useState, useEffect } from 'react';

const AuthContext = createContext({ token: '', user: null, isAdmin: false, loading: true });
const resolveApiBase = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:5000/api`;
  }

  return 'http://localhost:5000/api';
};

const API_BASE = resolveApiBase();

const clearStoredSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('userID');
  localStorage.removeItem('name');
  localStorage.removeItem('role');
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      const nextToken = localStorage.getItem('token') || '';

      if (!nextToken) {
        if (mounted) {
          setToken('');
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/auth/me`, {
          headers: {
            Authorization: `Bearer ${nextToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Session is not valid anymore');
        }

        const data = await response.json();
        const normalizedUser = {
          ...data.user,
          role: data.user?.role === 'Admin' ? 'Supervisor' : data.user?.role,
        };

        if (mounted) {
          localStorage.setItem('user', JSON.stringify(normalizedUser));
          localStorage.setItem('userID', String(normalizedUser.userID));
          localStorage.setItem('name', normalizedUser.name || '');
          localStorage.setItem('role', normalizedUser.role || 'Member');
          setToken(nextToken);
          setUser(normalizedUser);
          setLoading(false);
        }
      } catch (_error) {
        clearStoredSession();
        if (mounted) {
          setToken('');
          setUser(null);
          setLoading(false);
        }
      }
    };

    hydrate();

    return () => {
      mounted = false;
    };
  }, []);

  const isAdmin = user?.role === 'Supervisor';

  const login = (nextUser, nextToken) => {
    const normalizedUser = {
      ...nextUser,
      role: nextUser?.role === 'Admin' ? 'Supervisor' : nextUser?.role,
    };

    localStorage.setItem('token', nextToken);
    localStorage.setItem('user', JSON.stringify(normalizedUser));
    localStorage.setItem('userID', String(normalizedUser.userID));
    localStorage.setItem('name', normalizedUser.name || '');
    localStorage.setItem('role', normalizedUser.role || 'Member');

    setToken(nextToken);
    setUser(normalizedUser);
  };

  const logout = () => {
    clearStoredSession();
    setToken('');
    setUser(null);
  };

  const value = useMemo(
    () => ({ token, user, isAdmin, loading, login, logout }),
    [token, user, isAdmin, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
