#!/usr/bin/env bash
# deploy/scripts/db_backup.sh
# ─────────────────────────────────────────────────────────────────────────────
# Dumps the FlowCity PostgreSQL database and uploads to S3.
# Schedule via cron:  0 2 * * * /opt/flowcity/deploy/scripts/db_backup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="/tmp/flowcity_backup_${TIMESTAMP}.sql.gz"
S3_BUCKET="${BACKUP_S3_BUCKET:?Set BACKUP_S3_BUCKET env var}"
S3_PREFIX="backups/postgres"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-30}"

echo "[$(date)] Starting backup → ${BACKUP_FILE}"

# Dump from the running backend container (avoids exposing DB port externally)
docker compose -f /opt/flowcity/docker-compose.yml exec -T postgres \
  pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_FILE}"

echo "[$(date)] Uploading to s3://${S3_BUCKET}/${S3_PREFIX}/"
aws s3 cp "${BACKUP_FILE}" "s3://${S3_BUCKET}/${S3_PREFIX}/$(basename ${BACKUP_FILE})" \
  --storage-class STANDARD_IA \
  --sse AES256

echo "[$(date)] Pruning local temp file"
rm -f "${BACKUP_FILE}"

echo "[$(date)] Deleting S3 backups older than ${RETAIN_DAYS} days"
aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" \
  | awk '{print $4}' \
  | while read -r key; do
      file_date=$(echo "${key}" | grep -oP '\d{8}' | head -1)
      if [ -n "${file_date}" ]; then
        cutoff=$(date -d "${RETAIN_DAYS} days ago" +"%Y%m%d")
        if [[ "${file_date}" < "${cutoff}" ]]; then
          echo "  Deleting old backup: ${key}"
          aws s3 rm "s3://${S3_BUCKET}/${S3_PREFIX}/${key}"
        fi
      fi
    done

echo "[$(date)] Backup complete ✓"
