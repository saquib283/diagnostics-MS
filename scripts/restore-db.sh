#!/usr/bin/env bash
# ==============================================================================
# DCMS Encrypted Backup Restoration & Ledger Integrity Verification Script
# ==============================================================================
set -euo pipefail

ENC_DUMP="${1:?Usage: ./scripts/restore-db.sh <path-to-dcms_TIMESTAMP.dump.gpg> <target-database-url>}"
TARGET_DATABASE_URL="${2:?Target DATABASE_URL required}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE must be set}"

if [[ -f "${ENC_DUMP}.sha256" ]]; then
  echo "Verifying SHA-256 checksum..."
  sha256sum --check "${ENC_DUMP}.sha256"
fi

TMP_DUMP="$(mktemp /tmp/dcms_restore_XXXXXX.dump)"
trap 'rm -f "${TMP_DUMP}"' EXIT

gpg --batch --yes --decrypt \
  --passphrase "${BACKUP_PASSPHRASE}" \
  --output "${TMP_DUMP}" "${ENC_DUMP}"

pg_restore --clean --if-exists --no-owner --no-privileges --dbname="${TARGET_DATABASE_URL}" "${TMP_DUMP}"

echo "Verifying double-entry journal balance (SUM(debit) - SUM(credit) == 0)..."
IMBALANCE="$(psql "${TARGET_DATABASE_URL}" -tAc "SELECT COALESCE(SUM(debit_amount) - SUM(credit_amount), 0) FROM journal_entry_lines;")"
if [[ "${IMBALANCE}" != "0" && "${IMBALANCE}" != "0.00" ]]; then
  echo "ERROR: Ledger imbalance detected after restore: ${IMBALANCE}" >&2
  exit 1
fi

echo "Restore completed and verified cleanly."

