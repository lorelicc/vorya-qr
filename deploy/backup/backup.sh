#!/bin/bash
# Daily backup: database dump + uploaded files, encrypted by restic, pushed off the VPS.
# Retention: 7 daily, 4 weekly, 6 monthly. A repository check runs every Sunday.
set -euo pipefail
STAMP=$(date +%Y%m%d-%H%M%S)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
echo "[$STAMP] pg_dump ${PGDATABASE:-vorya_qr}"
pg_dump --format=custom --no-owner "$PGDATABASE" > "$WORK/vorya_qr.dump"
for extra in ${EXTRA_DATABASES:-}; do  # e.g. umami glitchtip (same server, separate databases)
  PGDATABASE="$extra" pg_dump --format=custom --no-owner "$extra" > "$WORK/$extra.dump" || echo "salto $extra"
done
restic backup --tag daily --host vorya-qr "$WORK" /data/uploads
restic forget --tag daily --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
if [ "$(date +%u)" = "7" ]; then restic check --read-data-subset=5%; fi
if [ -n "${BACKUP_PING_URL:-}" ]; then curl -fsS -m 10 "$BACKUP_PING_URL" >/dev/null || true; fi
echo "[$STAMP] backup completato"
