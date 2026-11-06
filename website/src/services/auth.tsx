/* Auth + public config context. © 2026 Shaik Gouse Kareem. All rights reserved. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import { offlineCache } from './offline';
import type { PublicConfig, User } from './types';

interface AuthState {
  user: User | null;
  loading: boolean;
  config: PublicConfig | null;
  refresh: () => Promise<User | null>;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children, initialUser = null, ssr = false }: { children: ReactNode; initialUser?: User | null; ssr?: boolean }) {
  const [user, setUserState] = useState<User | null>(initialUser);
  const [loading, setLoading] = useState(!ssr);
  const [config, setConfig] = useState<PublicConfig | null>(null);

  const setUser = useCallback((u: User | null) => {
    offlineCache.setScope(u?.id ?? null);
    setUserState(u);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await api.get<{ user: User | null }>('/api/auth/me', { offlineKey: 'me' });
      setUser(r.user);
      return r.user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [setUser]);

  useEffect(() => {
    if (ssr) return;
    void refresh();
    api.get<PublicConfig>('/api/config/public').then(setConfig).catch(() => setConfig(null));
  }, [ssr, refresh]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      config,
      refresh,
      setUser,
      async login(email, password) {
        const r = await api.post<{ user: User }>('/api/auth/login', { email, password });
        setUser(r.user);
        return r.user;
      },
      async register(name, email, password) {
        const r = await api.post<{ user: User }>('/api/auth/register', { name, email, password });
        setUser(r.user);
        return r.user;
      },
      async logout() {
        try {
          await api.post('/api/auth/logout');
        } finally {
          await offlineCache.clear();
          setUser(null);
        }
      },
    }),
    [user, loading, config, refresh, setUser],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
