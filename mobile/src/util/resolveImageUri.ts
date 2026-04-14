import { getApiBaseUrl } from '../config';

/**
 * URL картинки с localhost — на телефоне подменяем хост на тот же, что у API (порт в строке сохраняется).
 */
export function resolveImageUri(uri: string): string {
  if (!uri) return uri;
  if (/X-Amz-Signature=/i.test(uri) || /X-Amz-Credential=/i.test(uri)) {
    return uri;
  }
  try {
    const u = new URL(uri);
    const isLoopback =
      u.hostname === '127.0.0.1' ||
      u.hostname === 'localhost' ||
      u.hostname === '::1';
    if (!isLoopback) return uri;
    const api = new URL(getApiBaseUrl());
    u.hostname = api.hostname;
    return u.toString();
  } catch {
    return uri;
  }
}
