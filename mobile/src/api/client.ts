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

function parseJsonSafe(text: string): unknown {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function formatNetworkError(err: unknown, base: string): Error {
  const name =
    err && typeof err === 'object' && 'name' in err
      ? String((err as { name: string }).name)
      : '';
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: string }).message)
      : String(err);
  const isNetwork =
    name === 'TypeError' ||
    /network request failed|failed to fetch|load failed|network error/i.test(
      msg,
    );
  if (isNetwork) {
    return new Error(
      `Нет связи с сервером (${base}). Проверьте, что API запущен, и задайте EXPO_PUBLIC_API_URL на IP вашего компьютера в той же сети, что и телефон.`,
    );
  }
  return err instanceof Error ? err : new Error(msg);
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

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { ...init, headers });
  } catch (e) {
    throw formatNetworkError(e, base);
  }

  if (res.status === 401 && onUnauthorized) {
    onUnauthorized();
  }
  const text = await res.text();
  const json = parseJsonSafe(text);

  if (!res.ok) {
    const j = json as { message?: unknown } | null;
    const fromJson =
      typeof j?.message === 'string'
        ? j.message
        : Array.isArray(j?.message)
          ? j.message.join('; ')
          : null;
    const snippet = text.trim().slice(0, 200);
    let msg = fromJson ?? (snippet || res.statusText);
    if (!json && text.trim()) {
      msg = `Ответ ${res.status}: не JSON (${text.trim().slice(0, 120)}…)`;
    }
    throw new Error(msg);
  }

  if (json === null && text.trim()) {
    throw new Error('Пустой или некорректный JSON в ответе сервера');
  }
  return json as T;
}
