#!/bin/bash
# Starts busybox cron with the daily job; `docker exec backup backup.sh` runs one on demand.
set -euo pipefail
: "${RESTIC_REPOSITORY:?Impostare RESTIC_REPOSITORY (repository restic S3)}"
: "${RESTIC_PASSWORD:?Impostare RESTIC_PASSWORD (cifratura dei backup)}"
restic snapshots >/dev/null 2>&1 || restic init
echo "${BACKUP_CRON:-15 3 * * *} /usr/local/bin/backup.sh >> /proc/1/fd/1 2>&1" > /etc/crontabs/root
echo "Backup pianificato: ${BACKUP_CRON:-15 3 * * *} (Europe/Rome)"
exec crond -f -l 8
