import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { loadStoredTokens, setTokens as persistTokens } from './api';

type Auth = {
  authed: boolean;
  setSession: (access: string, refresh: string) => void;
  logout: () => void;
};

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(() => {
    loadStoredTokens();
    return !!localStorage.getItem('access');
  });

  const setSession = useCallback((access: string, refresh: string) => {
    persistTokens(access, refresh);
    setAuthed(true);
  }, []);

  const logout = useCallback(() => {
    persistTokens(null, null);
    setAuthed(false);
  }, []);

  const v = useMemo(
    () => ({ authed, setSession, logout }),
    [authed, setSession, logout],
  );
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const x = useContext(Ctx);
  if (!x) throw new Error('useAuth');
  return x;
}
