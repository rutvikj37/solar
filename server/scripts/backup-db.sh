#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${DB_HOST:?DB_HOST is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${DB_NAME:?DB_NAME is required}"

DB_PORT="${DB_PORT:-3306}"
BACKUP_DIR="${BACKUP_DIR:-${ROOT}/backups}"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="${BACKUP_DIR}/${DB_NAME}_${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

mysqldump \
  -h "$DB_HOST" \
  -P "$DB_PORT" \
  -u "$DB_USER" \
  -p"$DB_PASSWORD" \
  --single-transaction \
  --routines \
  --triggers \
  "$DB_NAME" | gzip > "$OUT"

echo "Backup written to $OUT"
