#!/usr/bin/env bash
# Lighthouse CI against the real stack (needs `npm run build`, E2E_DATABASE_URL, PYTHON).
# Thresholds in lighthouserc.json: Performance >= 90, SEO = 100, Accessibility >= 95.
set -euo pipefail
cd "$(dirname "$0")/.."
PY=${PYTHON:-python3}
(cd ../backend && DATABASE_URL="$E2E_DATABASE_URL" APP_ENV=test MAIL_TRANSPORT=file MAIL_FILE_DIR=/tmp/lh-mail \
  PUBLIC_BASE_URL=http://127.0.0.1:3100 STORAGE_LOCAL_PATH=/tmp/lh-uploads \
  "$PY" -m app.migrate && DATABASE_URL="$E2E_DATABASE_URL" APP_ENV=test MAIL_TRANSPORT=file MAIL_FILE_DIR=/tmp/lh-mail \
  PUBLIC_BASE_URL=http://127.0.0.1:3100 STORAGE_LOCAL_PATH=/tmp/lh-uploads \
  exec "$PY" -m uvicorn app.main:app --host 127.0.0.1 --port 8100) &
BACK=$!
PORT=3100 API_INTERNAL_URL=http://127.0.0.1:8100 node scripts/start-standalone.mjs &
FRONT=$!
trap 'kill $BACK $FRONT 2>/dev/null || true' EXIT
for i in $(seq 1 60); do curl -sf http://127.0.0.1:3100/prezzi >/dev/null && break; sleep 1; done
CHROME_PATH=${CHROME_PATH:-$(node -e "console.log(require('playwright').chromium.executablePath())")} \
  npx --yes @lhci/cli@0.15.1 autorun --config=lighthouserc.json
