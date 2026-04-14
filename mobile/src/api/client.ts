import { getApiBaseUrl } from '../config';

export type Tokens = { accessToken: string; refreshToken: string };

let getAccessToken: (() => string | null) | null = null;
let onUnauthorized: (() => void) | null = null;

export function configureApiClient(opts: {
  getAccessToken: () => string | null;
  onUnauthorized?: () => void;
}) {
  getAccessToken = opts.getAccessToken;
  onUnauthorized = opts.onUnauthorized ?? null;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { skipAuth?: boolean } = {},
): Promise<T> {
  const base = getApiBaseUrl();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.headers as Record<string, string>),
  };
  const body = init.body;
  if (body && typeof body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (!init.skipAuth && getAccessToken) {
    const t = getAccessToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (res.status === 401 && onUnauthorized) {
    onUnauthorized();
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = json?.message ?? (text || res.statusText);
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return json as T;
}
