#!/bin/bash
# Monthly restore test: restores the latest dump into a scratch database and counts the tables.
# Exit code 0 = the backup is usable. Run it at least once a month.
set -euo pipefail
SCRATCH=vorya_restore_test
rm -rf /restore && mkdir -p /restore
restic restore latest --target /restore --include '**/vorya_qr.dump'
DUMP=$(find /restore -name vorya_qr.dump | head -1)
[ -s "$DUMP" ] || { echo "ERRORE: dump non trovato nel backup"; exit 1; }
psql -d postgres -c "DROP DATABASE IF EXISTS $SCRATCH" -c "CREATE DATABASE $SCRATCH"
pg_restore --no-owner -d "$SCRATCH" "$DUMP"
TABLES=$(psql -d "$SCRATCH" -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
USERS=$(psql -d "$SCRATCH" -Atc "SELECT count(*) FROM users")
psql -d postgres -c "DROP DATABASE $SCRATCH"
echo "Restore test OK: $TABLES tabelle, $USERS utenti nel backup."
