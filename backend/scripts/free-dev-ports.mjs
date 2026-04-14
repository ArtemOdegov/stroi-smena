#!/usr/bin/env node
/**
 * Завершает процессы, слушающие типичные dev-порты (Nest, Metro, Expo).
 * Не трогает 5432 / 6379 / 9000 — там обычно Docker.
 */
import { execSync } from 'child_process';

const PORTS = [3000, 8081, 8082, 8083, 8084, 8085, 19000, 19001, 19002];

if (process.platform === 'win32') {
  console.log('Windows: используйте netstat / диспетчер задач для портов:', PORTS.join(', '));
  process.exit(0);
}

const killed = new Set();

for (const port of PORTS) {
  try {
    const out = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, {
      encoding: 'utf8',
    }).trim();
    if (!out) continue;
    const pids = [...new Set(out.split(/\s+/).filter(Boolean))];
    for (const pid of pids) {
      if (killed.has(pid)) continue;
      try {
        process.kill(Number(pid), 'SIGTERM');
        killed.add(pid);
        console.log(`SIGTERM PID ${pid} (порт ${port})`);
      } catch (e) {
        console.warn(`PID ${pid}: ${e}`);
      }
    }
  } catch {
    /* порт свободен */
  }
}

if (killed.size === 0) {
  console.log('Указанные dev-порты свободны или процессы не найдены.');
} else {
  console.log(`Готово. Завершено процессов: ${killed.size}. Перезапустите backend (npm run dev:stack) и Expo (npx expo start --offline).`);
}
