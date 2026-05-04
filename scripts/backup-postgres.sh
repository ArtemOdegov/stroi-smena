#!/usr/bin/env bash
set -euo pipefail
# Пример: DATABASE_URL=postgres://corp:corp@127.0.0.1:5432/corp ./scripts/backup-postgres.sh
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Задайте DATABASE_URL" >&2
  exit 1
fi
out="corp-backup-$(date +%Y%m%d-%H%M%S).dump"
pg_dump "$DATABASE_URL" -Fc -f "$out"
echo "Создан файл $out"
