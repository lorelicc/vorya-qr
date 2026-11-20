# Backup job: pg_dump + uploads -> restic (encrypted, deduplicated) -> S3-compatible storage
# (e.g. OVH Object Storage) OUTSIDE the VPS. Daily at 03:15 (Europe/Rome).
FROM alpine:3.20
RUN apk add --no-cache restic postgresql17-client bash tzdata curl
ENV TZ=Europe/Rome
COPY backup.sh restore.sh restore-test.sh entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
