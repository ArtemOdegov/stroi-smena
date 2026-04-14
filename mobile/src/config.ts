import Constants from 'expo-constants';
import { Platform } from 'react-native';

function trimSlash(s: string) {
  return s.replace(/\/$/, '');
}

function extractPort(base: string): string {
  try {
    const u = new URL(base.startsWith('http') ? base : `http://${base}`);
    return u.port || '3000';
  } catch {
    return '3000';
  }
}

function isLoopbackUrl(url: string): boolean {
  try {
    const u = new URL(url.startsWith('http') ? url : `http://${url}`);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch {
    return /127\.0\.0\.1|localhost/i.test(url);
  }
}

/**
 * Хост dev-машины из URL бандлера (Expo Go): exp://192.168.1.3:8082 → 192.168.1.3
 */
function inferDevMachineHost(): string | null {
  const expUrl = Constants.experienceUrl;
  if (!expUrl || typeof expUrl !== 'string') return null;
  const m = expUrl.match(/^(?:exp|exps|http|https):\/\/([^/:]+)/i);
  if (!m) return null;
  const host = m[1];
  if (!host || host === '127.0.0.1' || host === 'localhost') return null;
  return host;
}

/**
 * Базовый URL API.
 * 1) `EXPO_PUBLIC_API_URL` в `.env` (перезапуск Metro после изменения).
 * 2) `extra.apiUrl` из app.json; если там localhost/127.0.0.1, на реальном устройстве
 *    подставляется хост из `Constants.experienceUrl` (тот же, что у Metro).
 * 3) Android без extra: эмулятор → 10.0.2.2; iOS симулятор → 127.0.0.1.
 */
export function getApiBaseUrl(): string {
  const fromEnv =
    typeof process !== 'undefined' && process.env.EXPO_PUBLIC_API_URL
      ? String(process.env.EXPO_PUBLIC_API_URL).trim()
      : '';
  if (fromEnv) return trimSlash(fromEnv);

  const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  let base = fromExtra ? trimSlash(fromExtra) : '';

  if (!base) {
    if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
    return 'http://127.0.0.1:3000';
  }

  if (isLoopbackUrl(base)) {
    const devHost = __DEV__ ? inferDevMachineHost() : null;
    const port = extractPort(base);
    if (devHost) {
      base = `http://${devHost}:${port}`;
    } else if (Platform.OS === 'android') {
      base = `http://10.0.2.2:${port}`;
    }
  }

  return base;
}
