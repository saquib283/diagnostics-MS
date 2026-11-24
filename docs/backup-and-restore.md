# Backup & Restoration Verification Procedure — DCMS

## 1. Scope
Covers PostgreSQL transactional database backups (`pg_dump --format=custom` + GPG AES-256 encryption + SHA-256 verification) and private S3 bucket versioning/replication for immutable invoices, receipts, and diagnostic reports.

## 2. Running Backups
- **Linux / Production:**
  ```bash
  DATABASE_URL="postgresql://..." BACKUP_PASSPHRASE="..." ./scripts/backup-db.sh
  ```
- **Windows / Local PowerShell:**
  ```powershell
  .\scripts\backup-db.ps1 -DatabaseUrl "postgresql://postgres:password@127.0.0.1:5432/dcms"
  ```

## 3. Restoration & Ledger Verification
```bash
BACKUP_PASSPHRASE="..." ./scripts/restore-db.sh \
  /var/backups/dcms/dcms_20261124T000000Z.dump.gpg \
  "postgresql://dcms_admin:password@127.0.0.1:5432/dcms_restore_verify"
```
The restore script automatically:
1. Validates the `.sha256` digest prior to decryption.
2. Decrypts into a secure temporary file cleaned up via `trap EXIT`.
3. Executes `pg_restore` and validates all foreign keys, `CHECK` constraints, and partial unique settlement locks.
4. Queries `journal_entry_lines` to assert zero debit/credit imbalance.

