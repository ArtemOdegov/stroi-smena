import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { configureApiClient } from '../api/client';
import { refresh as refreshApi } from '../api/auth';
import type { Tokens } from '../api/client';

const STORAGE_KEY = 'corp_session_v1';

type Session = {
  tokens: Tokens | null;
  selectedCompanyId: string | null;
};

type Ctx = Session & {
  setTokens: (t: Tokens | null) => void;
  setSelectedCompanyId: (id: string | null) => void;
  getAccessToken: () => string | null;
};

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [tokens, setTokensState] = useState<Tokens | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    null,
  );
  const [hydrated, setHydrated] = useState(false);

  /** Синхронно с setState, чтобы apiFetch сразу после входа видел новый access token (до дочерних useEffect). */
  const tokensRef = useRef<Tokens | null>(null);
  tokensRef.current = tokens;

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const s = JSON.parse(raw) as Session;
          tokensRef.current = s.tokens;
          setTokensState(s.tokens);
          setSelectedCompanyId(s.selectedCompanyId);
        }
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const s: Session = { tokens, selectedCompanyId };
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }, [tokens, selectedCompanyId, hydrated]);

  const setTokens = useCallback((t: Tokens | null) => {
    tokensRef.current = t;
    setTokensState(t);
  }, []);

  const setCompany = useCallback((id: string | null) => {
    setSelectedCompanyId(id);
  }, []);

  const getAccessToken = useCallback(
    () => tokensRef.current?.accessToken ?? null,
    [],
  );

  useLayoutEffect(() => {
    configureApiClient({
      getAccessToken,
      onUnauthorized: async () => {
        const rt = tokensRef.current?.refreshToken;
        if (!rt) {
          setTokens(null);
          return;
        }
        try {
          const next = await refreshApi(rt);
          setTokens(next);
        } catch {
          setTokens(null);
        }
      },
    });
  }, [getAccessToken, setTokens]);

  const value = useMemo(
    () => ({
      tokens,
      selectedCompanyId,
      setTokens,
      setSelectedCompanyId: setCompany,
      getAccessToken,
    }),
    [tokens, selectedCompanyId, setTokens, setCompany, getAccessToken],
  );

  if (!hydrated) {
    return null;
  }

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const c = useContext(SessionContext);
  if (!c) throw new Error('useSession outside provider');
  return c;
}
