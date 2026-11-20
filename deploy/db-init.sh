#!/bin/sh
# Creates the separate databases and roles of Umami and GlitchTip on the SAME Postgres server
# (idempotent, runs at every stack start). Each service gets its own role: no shared credentials.
set -eu
export PGPASSWORD="$POSTGRES_PASSWORD"
run() { psql -h db -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 "$@"; }
ensure() { # name password
  [ -n "$2" ] || { echo "salto $1: password non impostata"; return 0; }
  run -Atc "SELECT 1 FROM pg_roles WHERE rolname='$1'" | grep -q 1 || run -c "CREATE ROLE $1 LOGIN PASSWORD '$2' CONNECTION LIMIT 20"
  run -c "ALTER ROLE $1 PASSWORD '$2' CONNECTION LIMIT 20"
  run -Atc "SELECT 1 FROM pg_database WHERE datname='$1'" | grep -q 1 || run -c "CREATE DATABASE $1 OWNER $1"
}
ensure umami "${UMAMI_DB_PASSWORD:-}"
ensure glitchtip "${GLITCHTIP_DB_PASSWORD:-}"
echo "Database di servizio pronti."
