#!/usr/bin/env node
/**
 * Освобождает PORT (по умолчанию 3000), если на нём висит LISTEN (macOS / Linux).
 */
import { execSync } from 'child_process';

const port = process.env.PORT || '3000';

if (process.platform === 'win32') {
  console.log(
    `Windows: найдите PID по порту ${port} (netstat -ano | findstr :${port}) и завершите задачу вручную.`,
  );
  process.exit(0);
}

try {
  const out = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, {
    encoding: 'utf8',
  }).trim();
  if (!out) {
    console.log(`Порт ${port} свободен.`);
    process.exit(0);
  }
  const pids = [...new Set(out.split(/\s+/).filter(Boolean))];
  for (const pid of pids) {
    try {
      process.kill(Number(pid), 'SIGTERM');
      console.log(`SIGTERM → PID ${pid} (порт ${port}).`);
    } catch (e) {
      console.warn(String(e));
    }
  }
} catch {
  console.log(`Порт ${port} свободен.`);
}
