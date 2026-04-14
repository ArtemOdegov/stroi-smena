import * as os from 'os';

/** Первый не-internal IPv4 (Wi‑Fi / Ethernet), без docker/tailscale-интерфейсов по имени. */
export function pickLanIPv4(): string | null {
  const nets = os.networkInterfaces();
  const candidates: { name: string; addr: string; score: number }[] = [];

  for (const name of Object.keys(nets)) {
    const lower = name.toLowerCase();
    if (
      lower === 'lo' ||
      lower === 'lo0' ||
      lower.startsWith('docker') ||
      lower.startsWith('br-') ||
      lower.startsWith('veth') ||
      lower.startsWith('bridge') ||
      lower.startsWith('utun') ||
      lower.startsWith('tailscale')
    ) {
      continue;
    }

    for (const net of nets[name] ?? []) {
      const fam = net.family as string | number;
      const isV4 = fam === 'IPv4' || fam === 4;
      if (!isV4 || net.internal) continue;
      const addr = net.address;
      if (!addr || addr.startsWith('169.254.')) continue;

      let score = 10;
      if (/en\d|wlan|wl|wifi|ethernet|eth\d/i.test(name)) score = 0;

      candidates.push({ name, addr, score });
    }
  }

  candidates.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  return candidates[0]?.addr ?? null;
}

export function parseUrlPort(url: string, fallbackPort: string): string {
  try {
    const u = new URL(url);
    return u.port || fallbackPort;
  } catch {
    return fallbackPort;
  }
}
