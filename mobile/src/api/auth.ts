import { apiFetch, Tokens } from './client';

export async function register(body: {
  email: string;
  password: string;
  name: string;
}): Promise<Tokens> {
  return apiFetch<Tokens>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export async function login(body: {
  email: string;
  password: string;
}): Promise<Tokens> {
  return apiFetch<Tokens>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export async function refresh(refreshToken: string): Promise<Tokens> {
  return apiFetch<Tokens>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
    skipAuth: true,
  });
}

export type MeDto = { userId: string; email: string; name: string };

export function me() {
  return apiFetch<MeDto>('/auth/me');
}

export function registerPushToken(body: {
  token: string;
  tokenKind: 'expo' | 'fcm';
  platform: string;
}) {
  return apiFetch<{ ok: boolean }>('/auth/push-token', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
