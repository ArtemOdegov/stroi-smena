const base = () =>
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:3000';

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string | null, refresh: string | null) {
  accessToken = access;
  refreshToken = refresh;
  if (access) localStorage.setItem('access', access);
  else localStorage.removeItem('access');
  if (refresh) localStorage.setItem('refresh', refresh);
  else localStorage.removeItem('refresh');
}

export function loadStoredTokens() {
  accessToken = localStorage.getItem('access');
  refreshToken = localStorage.getItem('refresh');
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (init.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let res = await fetch(`${base()}${path}`, { ...init, headers });
  if (res.status === 401 && refreshToken) {
    const r = await fetch(`${base()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (r.ok) {
      const t = (await r.json()) as { accessToken: string; refreshToken: string };
      setTokens(t.accessToken, t.refreshToken);
      headers.Authorization = `Bearer ${accessToken}`;
      res = await fetch(`${base()}${path}`, { ...init, headers });
    }
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(json?.message || text || res.statusText);
  }
  return json as T;
}

export type CompanyRow = {
  companyId: string;
  role: string;
  companyName: string;
  inviteCode: string | null;
};

export type Member = {
  userId: string;
  email: string;
  name: string;
  role: string;
  status: string;
  joinedAt: string;
};

export type DayEntry = {
  id: string;
  date: string;
  userId: string;
  authorName?: string;
  notes: string;
  version: number;
  lat: number | null;
  lng: number | null;
  geoSource: string | null;
  photos: { id: string; storageKey: string; url: string }[];
  updatedAt: string;
};

export type Brigade = {
  id: string;
  companyId: string;
  name: string;
  masterUserId: string;
  masterName: string;
  members: Member[];
};
