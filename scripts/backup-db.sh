#!/usr/bin/env bash
# ==============================================================================
# DCMS Automated Encrypted PostgreSQL Backup Script (Ubuntu Production)
# Requires: pg_dump, sha256sum, gpg (or age)
# ==============================================================================
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE must be set for GPG AES-256 encryption}"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/dcms}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RAW_DUMP="${BACKUP_DIR}/dcms_${TIMESTAMP}.dump"
ENC_DUMP="${RAW_DUMP}.gpg"
SHA_FILE="${ENC_DUMP}.sha256"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

echo "[$(date -u +%FT%TZ)] Starting PostgreSQL custom-format dump..."
pg_dump --format=custom --no-owner --no-privileges --file="${RAW_DUMP}" "${DATABASE_URL}"

echo "[$(date -u +%FT%TZ)] Encrypting archive with AES-256..."
gpg --batch --yes --symmetric --cipher-algo AES256 \
  --passphrase "${BACKUP_PASSPHRASE}" \
  --output "${ENC_DUMP}" "${RAW_DUMP}"

rm -f "${RAW_DUMP}"
sha256sum "${ENC_DUMP}" > "${SHA_FILE}"

find "${BACKUP_DIR}" -name "dcms_*.dump.gpg*" -mtime +"${RETENTION_DAYS}" -delete
echo "[$(date -u +%FT%TZ)] Backup complete: ${ENC_DUMP}"

