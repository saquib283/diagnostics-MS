# Production Deployment, Backup & Restore Guide — DCMS

## 1. Target Production Architecture (Ubuntu 24.04 LTS VPS)
- **Reverse Proxy:** Nginx 1.24+ terminating TLS 1.2/1.3 (Let's Encrypt `certbot`), forwarding to `http://127.0.0.1:3000`.
- **Application Runtime:** Node.js 24 LTS managed via `systemd` (`dcms.service`) or Docker, running as a non-root system user (`dcms`).
- **Database:** PostgreSQL 18 bound strictly to `127.0.0.1:5432` (or private VPC subnet), `scram-sha-256` authentication.
- **Object Storage:** Private S3 bucket (`ap-south-1` Mumbai) with `BlockPublicAcls=true`, `BlockPublicPolicy=true`, `IgnorePublicAcls=true`, `RestrictPublicBuckets=true`, and SSE-S3 encryption enabled (`STORAGE_DRIVER="s3"`).

## 2. Nginx Reverse Proxy Configuration Notes
- Preserve exact raw request bodies on `/api/v1/webhooks/razorpay` (do not rewrite JSON bodies) so Razorpay HMAC-SHA256 verification succeeds.
- Set `client_max_body_size 25M;` to accommodate `20 MB` diagnostic report PDF uploads.
- Forward `X-Forwarded-For`, `X-Forwarded-Proto`, and `Host` headers.

## 3. Production Deployment Sequence
```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
sudo systemctl restart dcms
curl -fsS http://127.0.0.1:3000/api/v1/health
```

## 4. Backup & Disaster Recovery Runbook (`docs/backup-and-restore.md`)
1. **Daily Encrypted Backups:** Schedule `/opt/dcms/scripts/backup-db.sh` via `cron` / `systemd.timer` every 6 hours, syncing `.dump.gpg` and `.sha256` files to a separate off-server S3 backup bucket with Object Lock.
2. **Monthly Restore Drill (Mandatory Before Production Launch):**
   - Create an isolated scratch database (`createdb dcms_restore_drill`).
   - Run `./scripts/restore-db.sh /var/backups/dcms/dcms_<latest>.dump.gpg postgresql://.../dcms_restore_drill`.
   - Confirm exit code `0` (verifies SHA-256 archive integrity, GPG decryption, schema/constraint restoration, and `SUM(debit_amount) - SUM(credit_amount) == 0` across `journal_entry_lines`).
   - Drop `dcms_restore_drill` and log drill completion in operations records.

