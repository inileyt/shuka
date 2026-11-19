import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { get, post } from './api.js';
import { useI18n } from './i18n.jsx';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still loading, null = signed out

  const refresh = useCallback(async () => {
    try { setUser((await get('/me')).user); } catch { setUser(null); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({
    user,
    loading: user === undefined,
    refresh,
    login: async (email, password) => setUser((await post('/auth/login', { email, password })).user),
    register: async (body) => setUser((await post('/auth/register', body)).user),
    logout: async () => { await post('/auth/logout'); setUser(null); },
  }), [user, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const loc = useLocation();
  if (loading) return <p className="muted pad">{t('common.loading')}</p>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return children;
}

export function RequireSeller({ children }) {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const loc = useLocation();
  if (loading) return <p className="muted pad">{t('common.loading')}</p>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (!user.isSeller) return <Navigate to="/sell" replace />;
  return children;
}

export function RequireAdmin({ children }) {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const loc = useLocation();
  if (loading) return <p className="muted pad">{t('common.loading')}</p>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (!user.isAdmin) return <div className="wrap page narrow"><h1>{t('admin.denied.title')}</h1><p className="muted">{t('admin.denied.text')}</p></div>;
  return children;
}
