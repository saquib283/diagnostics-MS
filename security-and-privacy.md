# Security & Privacy Specification — DCMS

**Document Status:** Security Architecture & Controls Baseline v1.0  
**Source of Truth:** [Diagnostic_Consultancy_Management_System_PRD.md](./Diagnostic_Consultancy_Management_System_PRD.md) (Sections 4, 8, 11)

> [!WARNING]
> **Legal & Regulatory Disclaimer:** Technical controls documented and implemented in DCMS are designed to enforce strong engineering security, financial integrity, and data minimization. They do **not** constitute legal certification or replace formal review under India's Digital Personal Data Protection (DPDP) Act 2023, GST statutes, IT Act 2000, or applicable state healthcare regulations by qualified legal counsel and a Chartered Accountant prior to production launch.

---

## 1. Threat Model & Mitigation Matrix

| Threat / Attack Vector | Target Surface | Concrete Mitigation Implemented |
|---|---|---|
| **Cross-Partner IDOR (Horizontal Privilege Escalation)** | Partner user modifies UUID in `/api/v1/partner/orders/{id}` or `/api/v1/reports/{fileId}/download` | Mandatory `PartnerScope` injected from authenticated session (`partner_users` DB table, never request body/query). Every Partner repository method includes `WHERE partner_id IN (actor.partnerIds)` at the SQL/Prisma query level. |
| **Consultancy Margin / Selling Price Leakage to Partner** | Partner API or RSC payload | Dedicated `toPartnerOrderDTO()` / `toPartnerSettlementDTO()` server-side serializers explicitly allowlist permitted fields and omit `unitSellingPriceSnapshot`, `discountAmountSnapshot`, `netSellingTotal`, and internal notes. |
| **Client-Side Price / Commission / Status Tampering** | Order creation, manual payment, Razorpay callback | Server ignores client-calculated totals; recomputes prices from active DB catalogue/partner contracts (`Decimal.js`) and never marks an invoice paid from browser redirects without server-verified HMAC signature or webhook. |
| **Split-Payment Race Condition / Overpayment** | Concurrent counter + webhook payment against same `Invoice` | `SELECT ... FOR UPDATE` row lock on `invoices` inside `prisma.$transaction`; validates `amount <= balanceDue` (unless `allowInvoiceOverpayment` explicitly enabled). |
| **Duplicate Webhook / Replay Attack** | `POST /api/v1/webhooks/razorpay` | Raw-body (`await request.text()`) HMAC-SHA256 verification via `crypto.timingSafeEqual` + `UNIQUE (gateway, event_id)` on `payment_webhook_events` + `UNIQUE (gateway, gateway_payment_id)` on `payment_gateway_transactions`. |
| **Double Settlement of Completed Test Item** | Concurrent or repeated settlement runs | Partial unique index on `settlement_items (order_item_id) WHERE is_active_lock = true` + `order_items.settlement_lock_status` verified transactionally. |
| **Unauthorized Diagnostic Report / Invoice Download** | Direct object storage URL guessing or leaked link | Zero public S3 buckets. Files served only via RBAC/scope-checked server streaming or short-lived presigned URLs; external customer links use 256-bit random tokens stored as SHA-256 hashes in `document_share_tokens` with TTL expiry and instant revocation. |
| **Malicious File Upload (Polyglot / Executable / Oversized)** | Report upload & partner agreement upload | Server validates file size (`<= 20 MB`), extension allowlist (`.pdf`, `.jpg`, `.jpeg`, `.png`), MIME header, **and** binary magic-byte header (`%PDF-`, `FF D8 FF`, `89 50 4E 47`), stores outside webroot with randomized UUID storage keys, and serves with `Content-Disposition: attachment` / `X-Content-Type-Options: nosniff`. Optional ClamAV TCP daemon scan hook (`CLAMAV_HOST`). |
| **Credential Stuffing / Brute Force / Token Enumeration** | `/api/v1/auth/login`, `/d/[token]`, `/payments/*` | Sliding-window rate limiter per IP + identifier; per-account progressive lockout (`failedLoginCount`, `lockedUntil` after 5 consecutive failures). |
| **CSRF / Session Hijacking / XSS** | Mutating requests & browser cookies | `HttpOnly; Secure; SameSite=Lax` session cookie (`__Host-dcms_session` in HTTPS prod), strict `Origin`/`Host` verification + anti-CSRF token header on mutating endpoints, React auto-escaping + strict `Content-Security-Policy` headers, zero `dangerouslySetInnerHTML` on user data. |

---

## 2. Authentication & Session Architecture

1. **Password Storage:** Passwords hashed using Node `crypto.scrypt` (`N=16384, r=8, p=1`, 64-byte key length, unique 16-byte cryptographic random salt per password) with constant-time verification (`crypto.timingSafeEqual`). Minimum password length: 10 characters; paste allowed per NCSC/NIST usability-security guidance.
2. **Database-Backed Sessions:**
   - Sign-in generates a 32-byte (`256-bit`) cryptographically random token (`base64url`), sends the raw token only in an `HttpOnly` cookie, and persists `SHA-256(token)` in `sessions.session_token_hash`.
   - Even a read-only database backup leak cannot be used to hijack active sessions because raw session tokens are never stored.
   - Idle timeout (`12 hours` default) and absolute expiry (`7 days` default).
   - Deactivating a user (`isActive = false`), changing roles, or resetting a password atomically sets `revokedAt = NOW()` on all active sessions for that `userId`.

---

## 3. Server-Side RBAC Permission Matrix

All permissions are checked via `requirePermission(actor, permission)` in Domain Services / Route Handlers before executing any query or mutation.

| Capability / Permission Code | Super Admin | Admin | Receptionist | Accountant | Report Mgr | Viewer / Auditor | Partner Admin | Partner Staff | Partner Report Mgr |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `org:settings:manage` | Yes | — | — | — | — | — | — | — | — |
| `users:manage` | Yes | — | — | — | — | — | Own Partner | — | — |
| `patients:read` / `patients:write` | Yes | Yes | Yes | Read | Read | Read | Scoped Min | Scoped Min | Scoped Min |
| `catalogue:read` / `catalogue:manage` | Yes | Yes | Read | Read | Read | Read | Scoped Read | Scoped Read | Scoped Read |
| `partners:manage` / `pricing:manage` | Yes | Yes | — | Read | — | Read | Own Profile | — | — |
| `orders:create` / `orders:amend` | Yes | Yes | Create | Read | Read | Read | — | — | — |
| `orders:status:update` | Yes | Yes | Confirm | — | Yes | — | Own Orders | Own Orders | Own Orders |
| `orders:completion:approve` | Yes | Yes | — | — | Yes | — | — | — | — |
| `invoices:issue` / `invoices:share` | Yes | Yes | Yes | Yes | — | Read | — | — | — |
| `invoices:adjust` (Credit/Debit Note) | Yes | Yes | — | Yes | — | — | — | — | — |
| `payments:collect` | Yes | Yes | Yes | Yes | — | Read | — | — | — |
| `payments:reconcile` | Yes | Yes | — | Yes | — | Read | — | — | — |
| `refunds:initiate` / `refunds:approve` | Yes | Approve | — | Initiate | — | Read | — | — | — |
| `reports:upload` / `reports:download` | Yes | Yes | Download | — | Yes | Read | Own Orders | — | Own Orders |
| `reports:share` | Yes | Yes | Yes | — | Yes | — | — | — | — |
| `settlements:prepare` / `settlements:pay` | Yes | Read | — | Yes | — | Read | Own Read | — | — |
| `settlements:approve` / `settlements:reverse` | Yes | Yes | — | — | — | — | — | — | — |
| `accounting:manage` / `reports:finance` | Yes | Read | — | Yes | — | Read | — | — | — |
| `audit:read` | Yes | Yes | — | — | — | Yes | — | — | — |

---

## 4. Partner Row-Level Isolation Contract

Every Partner Portal request resolves an immutable `PartnerScopeContext`:
```ts
export interface PartnerScopeContext {
  readonly portal: "PARTNER";
  readonly userId: string;
  readonly partnerIds: readonly [string, ...string[]]; // Non-empty tuple verified against active partner_users
  readonly roles: readonly PartnerRoleCode[];
}
```
1. Partner routes (`/api/v1/partner/*` and `/partner/*`) reject any user without `portal === "PARTNER"` and at least one active `partner_users` row (`isActive = true` and `partner.status = 'ACTIVE'`).
2. Every lookup by ID (`getOrderForPartner(scope, orderId)`, `uploadReportForPartner(scope, orderItemId, ...)`) filters `WHERE id = $1 AND partner_id IN ($scope.partnerIds)` and returns `404 Not Found` (not `403`, preventing existence oracle leakage) when an ID belongs to another partner.
3. Patient data returned to Partner Portal is stripped to: `fullName`, `ageYears` / `dateOfBirth`, `gender`, `patientCode`, and `mobile` masked (`+91 ******1234`) unless `OrganizationSettings.partnerPatientPhoneVisibility === 'FULL'`.

---

## 5. Privacy, Logging Redaction & Notification Safety

1. **Data Minimization:** No Aadhaar, biometric, religion, or clinical diagnosis fields are collected.
2. **Notification Privacy:** WhatsApp and Email messages never embed diagnostic test findings, abnormal values, or clinical notes in message body previews; notifications state only neutral status (e.g., *"Your diagnostic report for Order ORD-2026-00042 is ready for secure viewing"*) with an expiring token link.
3. **Structured Log Redaction:** The central logger (`src/lib/logger`) recursively strips/masks keys matching `/password|secret|token|authorization|cookie|signature|pan|gstin_secret|card|cvv|otp/i` and masks phone/email in raw gateway webhook payloads before persisting to `payment_webhook_events.redacted_payload_json` or stdout.
4. **Audit Completeness:** Sensitive reads (report downloads, patient history views, share token opens) and 100% of financial, status, user, permission, pricing, and settlement mutations write append-only rows to `audit_logs` within the same database transaction where applicable.

---

## 6. Secrets, Transport Security & Backup Encryption

- **Secrets Management:** Razorpay `KEY_SECRET`, `WEBHOOK_SECRET`, S3 credentials, `SESSION_SECRET`, WhatsApp API tokens, and SMTP credentials live exclusively in environment variables / host secret manager validated at boot via `src/lib/env.ts`. Zero secrets in database tables, client bundles (`NEXT_PUBLIC_*` restricted strictly to non-secret public identifiers like `NEXT_PUBLIC_APP_URL`), or git history.
- **HTTP Security Headers:** `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and strict `Content-Security-Policy` allowing Razorpay Checkout (`https://checkout.razorpay.com`, `https://api.razorpay.com`) only on payment views.
- **Encrypted Backups:** Daily automated `pg_dump` archives are encrypted at rest using `age` / `gpg` asymmetric/symmetric keys stored separately from the database host, with documented quarterly/monthly restore verification drills (`docs/backup-and-restore.md`).

