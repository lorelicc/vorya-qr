#!/bin/bash
# Restore of the latest (or a given) snapshot into /restore. Does NOT touch the live database:
# the dump is restored by hand (see deploy/VPS.md). Usage: restore.sh [snapshot-id|latest]
set -euo pipefail
SNAP=${1:-latest}
mkdir -p /restore
restic restore "$SNAP" --target /restore
echo "Snapshot $SNAP ripristinato in /restore. Dump: $(find /restore -name '*.dump' | tr '\n' ' ')"
