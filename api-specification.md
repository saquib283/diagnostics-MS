# API Specification — Diagnostic Consultancy Management System (DCMS)

**Document Status:** REST & Webhook Contract Baseline v1.0  
**Base URL:** `/api/v1`  
**Content-Type:** `application/json; charset=utf-8` (except multipart uploads & binary PDF/Excel streams)

---

## 1. Global API Conventions

### 1.1 Standard Response Envelopes

**Success (Single Resource — `200 OK` / `201 Created`):**
```json
{
  "data": { "id": "8e1c8c50-...", "...": "..." },
  "meta": { "requestId": "req_01J..." }
}
```

**Success (Paginated Collection — `200 OK`):**
```json
{
  "data": [ { "id": "..." } ],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "totalItems": 142,
    "totalPages": 6,
    "requestId": "req_01J..."
  }
}
```

**Error Envelope (`400`, `401`, `403`, `404`, `409`, `422`, `429`, `500`):**
```json
{
  "error": {
    "code": "OVERPAYMENT_NOT_ALLOWED",
    "message": "Payment amount (₹3,500.00) exceeds invoice outstanding balance (₹3,000.00).",
    "details": [{ "field": "amount", "issue": "Must be <= 3000.00" }],
    "requestId": "req_01J..."
  }
}
```

### 1.2 Authentication, CSRF & Idempotency Headers
- **Session Cookie:** `dcms_session` (`__Host-dcms_session` in production HTTPS) — `HttpOnly; SameSite=Lax; Path=/`.
- **CSRF Protection:** All mutating requests (`POST`, `PATCH`, `PUT`, `DELETE`) except external signed webhooks verify matching `Origin`/`Host` plus `X-CSRF-Token` header matching session CSRF secret.
- **Idempotency:** Financial & document creation endpoints require `Idempotency-Key: <uuid-or-client-key>` (up to 128 chars). Replays with the same key + payload hash return the original HTTP status and payload; replays with a mutated payload return `409 IDEMPOTENCY_PAYLOAD_MISMATCH`.
- **Monetary Values in JSON:** Always serialized as fixed-point strings with 2 decimals (`"5000.00"`, `"1400.50"`) to eliminate JSON `Number` precision ambiguity.

---

## 2. Endpoint Contracts by Domain

### 2.1 Authentication & Current User
| Method | Path | Auth / Permission | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Public (Rate-limited: 10/15m/IP) | Authenticate via `{ email, password }`; sets `HttpOnly` session cookie & returns user profile + portal route (`/admin/dashboard` or `/partner/dashboard`). |
| `POST` | `/api/v1/auth/logout` | Authenticated | Revokes current DB session & clears cookie. |
| `GET` | `/api/v1/auth/me` | Authenticated | Returns active user, role codes, permission set, CSRF token, and `partnerScope` (if Partner user). |
| `POST` | `/api/v1/auth/password/forgot` | Public (Rate-limited: 5/15m) | Issues single-use 30-min reset token via configured email adapter (constant-time response to prevent account enumeration). |
| `POST` | `/api/v1/auth/password/reset` | Public (Rate-limited) | Consumes reset token, updates `scrypt` hash, and revokes all existing sessions for the user. |

### 2.2 Organization Settings, Tax Codes & Users
| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/organization/settings` | Authenticated (Consultancy) | Fetch consultancy profile, sequence prefixes, and Open Decision policy flags. |
| `PATCH` | `/api/v1/organization/settings` | `org:settings:manage` | Update organization profile & policy settings (audited before/after diff). |
| `GET` / `POST` | `/api/v1/tax-codes` | `org:settings:manage` (`GET`: Consultancy) | List or create effective-dated HSN/SAC tax codes (`CGST`/`SGST`/`IGST`/exempt). |
| `GET` / `POST` | `/api/v1/users` | `users:manage` | List or create consultancy/partner users; assign roles and `partnerIds`. |
| `PATCH` | `/api/v1/users/[id]` | `users:manage` | Update roles or deactivate user (`isActive: false` atomically revokes active sessions). |

### 2.3 Patients
| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/patients` | `patients:read` | Paginated search (`?q=` matches `fullName`, `mobile`, `patientCode`; `?page=1&pageSize=25`). |
| `POST` | `/api/v1/patients` | `patients:write` | Register patient (`fullName`, `mobile` as string, `gender`, `dateOfBirth`, optional `email`, `address`, `consents`). Generates `PAT-YYYY-NNNNN`. |
| `GET` / `PATCH` | `/api/v1/patients/[id]` | `patients:read` / `patients:write` | Retrieve or update patient demographics & consents. |
| `GET` | `/api/v1/patients/[id]/history` | `patients:read` | Consolidated patient timeline: partner orders, Model A invoices, payments, report statuses, and share logs. |

### 2.4 Test Catalogue & Packages
| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` / `POST` | `/api/v1/test-categories` | `catalogue:read` / `catalogue:manage` | List or create diagnostic test categories. |
| `GET` / `POST` | `/api/v1/tests` | `catalogue:read` / `catalogue:manage` | List/filter (`?q=`, `?categoryId=`, `?activeOnly=true`) or create tests (`code`, `name`, `defaultSellingPrice`, `taxCodeId`). |
| `PATCH` | `/api/v1/tests/[id]` | `catalogue:manage` | Update test metadata/default price or toggle `isActive` (preserves historical snapshots). |
| `GET` / `POST` | `/api/v1/packages` | `catalogue:read` / `catalogue:manage` | List or create multi-test packages with `items: [{ testId, quantity, allocationWeight }]`. |
| `PATCH` | `/api/v1/packages/[id]` | `catalogue:manage` | Update package composition or `isActive`. |

### 2.5 Partners, Contracts, Negotiated Pricing & Commission Rates
| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` / `POST` | `/api/v1/partners` | `partners:read` / `partners:manage` | List or create partner diagnostic centres (`partnerCode`, `legalName`, `gstin`, `defaultPaymentModel`, `status`). |
| `GET` / `PATCH` | `/api/v1/partners/[id]` | `partners:read` / `partners:manage` | Partner detail, active contract summary, and status management. |
| `GET` / `POST` | `/api/v1/partners/[id]/contracts` | `partners:manage` | Manage effective-dated contracts (`allowedModels`, `commissionBasis`, `settlementCycle`). |
| `GET` / `POST` | `/api/v1/partners/[id]/prices` | `pricing:manage` (`GET`: `orders:create`) | List or set effective-dated `PartnerTestPrice` (`testId`, `agreedPurchasePrice`, `effectiveFrom`, `effectiveTo`). Rejects overlapping active date ranges (`409 PRICE_WINDOW_OVERLAP`). |
| `GET` / `POST` | `/api/v1/partners/[id]/commission-rates` | `pricing:manage` | List or set partner default (`testId: null`) or test-override (`testId`) percentage commission rates with `calculationBasis` and overlap validation. |

### 2.6 Diagnostic Orders & Item Status Transitions
| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/orders` | `orders:read` | Filterable paginated orders (`?partnerId=`, `?patientId=`, `?status=`, `?model=`, `?from=`, `?to=`). |
| `POST` | `/api/v1/orders` | `orders:create` | Create single-partner order: `{ patientId, partnerId, paymentModel, items: [{ testId?, packageId?, quantity, discountAmount }], referringDoctor?, notes? }`. Expands packages and freezes all price/tax/commission snapshots. |
| `GET` | `/api/v1/orders/[id]` | `orders:read` | Full order detail with item snapshots, status history, linked Model A invoice or Model B partner reference, and report statuses. |
| `POST` | `/api/v1/orders/[id]/items/[itemId]/status` | `orders:status:update` | Transition individual item status (`PENDING -> CONFIRMED -> IN_PROGRESS -> COMPLETED / CANCELLED / UNABLE_TO_PERFORM`) with `reason`, recording actor + timestamp and recomputing parent order status. |
| `POST` | `/api/v1/orders/[id]/items/[itemId]/approve-completion` | `orders:completion:approve` | Marks `completionApprovedAt` when `requireConsultancyCompletionApproval` policy is enabled. |
| `POST` | `/api/v1/orders/[id]/partner-invoice-ref` | `orders:create` / `invoices:issue` | **Model B only:** Record partner's direct invoice/receipt number, date, patient-paid amount, and optional attachment. Rejects with `422` if order is Model A. |

### 2.7 Invoices, Adjustments & Secure Document Sharing
| Method | Path | Permission | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/orders/[id]/invoice` | `invoices:issue` | **Model A only** (`Idempotency-Key`): Issues immutable consultancy `Invoice` (`INV-...`), freezes tax/party snapshots, posts AR journal, and generates immutable original PDF in private storage. Rejects Model B orders (`422 MODEL_B_INVOICE_PROHIBITED`). |
| `GET` | `/api/v1/invoices` | `invoices:read` | Paginated invoice register (`?status=UNPAID,PARTIALLY_PAID`, `?partnerId=`, `?patientId=`, `?from=`, `?to=`). |
| `GET` | `/api/v1/invoices/[id]` | `invoices:read` | Invoice header, line snapshots, tax breakdown, split `payments` array, `refunds`, `adjustmentNotes`, and share logs. |
| `GET` | `/api/v1/invoices/[id]/pdf` | `invoices:read` | Streams original immutable issued Invoice PDF (`?kind=statement` streams updated Account Statement PDF showing subsequent split payments & current `balanceDue`). |
| `POST` | `/api/v1/invoices/[id]/adjustments` | `invoices:adjust` | Issue Credit Note (`CN-...`) or Debit Note (`DN-...`) with reason and tax/amount delta without mutating original issued invoice lines. |
| `POST` | `/api/v1/invoices/[id]/share` | `invoices:share` | Create revocable expiring `DocumentShareToken` and dispatch via `WHATSAPP`, `EMAIL`, or `LINK_COPY`; writes `InvoiceShareLog`. |
| `POST` | `/api/v1/documents/shares/[tokenId]/revoke` | `invoices:share` / `reports:share` | Immediately revokes a previously shared customer link. |

### 2.8 Split Payments, Razorpay Checkout, Dynamic UPI QR & Webhooks
| Method | Path | Permission | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/invoices/[id]/payments/manual` | `payments:collect` | (`Idempotency-Key`) Record `CASH` or `BANK_TRANSFER` collection (`amount <= balanceDue`), atomically issue `PaymentReceipt` (`RCP-...`), update `Invoice.balanceDue` & status (`PARTIALLY_PAID` / `PAID`), and post journal entry. |
| `POST` | `/api/v1/invoices/[id]/payments/razorpay/order` | `payments:collect` | (`Idempotency-Key`) Creates `PENDING` `PatientPayment` + server-side Razorpay Order (`amount` in paise) for Checkout (`CARD`, `UPI_ONLINE`, `NETBANKING`). Never exposes `KEY_SECRET`. |
| `POST` | `/api/v1/payments/razorpay/verify` | `payments:collect` | Verifies `razorpay_order_id + "|" + razorpay_payment_id` HMAC-SHA256 signature server-side, fetches authoritative payment status/method/fee from Razorpay API, and posts capture idempotently. |
| `POST` | `/api/v1/invoices/[id]/payments/qr` | `payments:collect` | (`Idempotency-Key`) Creates `PENDING` `PatientPayment` + single-use fixed-amount Razorpay UPI QR (`POST /v1/payments/qr_codes`, `type: "upi_qr"`, `usage: "single_use"`, `fixed_amount: true`) and stores `PaymentQrSession` with `expiresAt`. |
| `GET` | `/api/v1/payments/qr/[qrSessionId]` | `payments:collect` | Returns live QR status (`ACTIVE`, `CREDITED`, `EXPIRED`, `CLOSED`) & linked receipt once webhook/server check confirms capture. |
| `POST` | `/api/v1/payments/qr/[qrSessionId]/close` | `payments:collect` | Closes active Razorpay QR code and marks session `CLOSED`/`CANCELLED` so cashier can issue a fresh QR or switch method. |
| `POST` | `/api/v1/webhooks/razorpay` | Razorpay HMAC Signature | Reads **raw unparsed body** (`request.text()`), verifies `X-Razorpay-Signature` with `RAZORPAY_WEBHOOK_SECRET` via `timingSafeEqual`, deduplicates by `x-razorpay-event-id`, and processes `payment.captured`, `payment.failed`, `qr_code.credited`, `qr_code.closed`, `refund.processed`, `refund.failed`, `settlement.processed`. |
| `POST` | `/api/v1/reconciliation/static-qr` | `payments:reconcile` | Controlled Accountant workflow to match an unallocated Static QR / bank credit (`CollectionRecord`) to a specific `Invoice`. |
| `POST` | `/api/v1/reconciliation/gateway-settlements` | `payments:reconcile` | Record/sync Razorpay settlement batch (`setl_...`, UTR) and reconcile bank statement credit. |

### 2.9 Receipts & Refunds
| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/receipts/[id]/pdf` | `payments:collect` / `invoices:read` | Streams individual transaction `PaymentReceipt` PDF showing payment method, reference, amount, and remaining invoice balance. |
| `POST` | `/api/v1/payments/[id]/refunds` | `refunds:initiate` | (`Idempotency-Key`) Initiates partial or full refund (`amount <= netRefundableAmountOnPayment`) via Razorpay Refund API (for gateway payments) or manual cash/bank reversal, updating invoice status (`PARTIALLY_REFUNDED` / `REFUNDED`). |

### 2.10 Reports & Authorized Private File Access
| Method | Path | Permission | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/order-items/[itemId]/reports` | `reports:upload` (Consultancy or Scoped Partner) | Multipart upload of PDF/JPEG/PNG report; validates MIME + magic bytes + size, computes SHA-256, increments `versionNumber`, uploads to private storage, updates `ReportTracking`, and audits. |
| `GET` | `/api/v1/reports/[fileId]/download` | `reports:download` (Scoped) | Verifies RBAC + Partner row scope, logs `DocumentAccessLog`, and streams private file with `Cache-Control: private, no-store`. |
| `GET` | `/api/v1/public/documents/[token]` | Valid Unexpired Non-Revoked Token (Rate-limited) | Verifies SHA-256 token hash, expiry, and revocation status; logs access and streams shared Invoice, Receipt, Statement, or Report PDF. |

### 2.11 Partner Portal Scoped Endpoints
| Method | Path | Scope | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/partner/orders` | `PartnerScopeContext` | Returns **only** orders assigned to `actor.partnerIds` via `PartnerOrderDTO` (zero consultancy selling prices/margins). |
| `GET` | `/api/v1/partner/orders/[id]` | `PartnerScopeContext` | Scoped order detail + test items + report upload history (`404` if not owned by partner). |
| `POST` | `/api/v1/partner/orders/[id]/items/[itemId]/status` | `PartnerScopeContext` | Partner updates permitted test status (`CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `UNABLE_TO_PERFORM`). |
| `GET` | `/api/v1/partner/settlements` | `PartnerScopeContext` | Partner views their own Model A payable or Model B commission statements & payment allocations. |
| `GET` / `POST` | `/api/v1/partner/users` | `PartnerScopeContext` (`PARTNER_ADMIN`) | Manage staff/report-manager accounts strictly within caller's own partner centre. |

### 2.12 Settlements, Accounting, Dashboard & Excel Exports
| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/settlements/eligible-items` | `settlements:prepare` | Preview `COMPLETED` (and policy-approved) unsettled `OrderItem` rows for `partnerId` and period `[periodStart, periodEnd]`. |
| `POST` | `/api/v1/settlements` | `settlements:prepare` | (`Idempotency-Key`) Atomically locks eligible `OrderItem` rows (`settlement_items` active lock) and creates Model A `PAYABLE_TO_PARTNER` or Model B `RECEIVABLE_FROM_PARTNER` statement. |
| `POST` | `/api/v1/settlements/[id]/approve` | `settlements:approve` | Approves settlement statement and posts immutable journal entry. |
| `POST` | `/api/v1/settlements/[id]/allocations` | `settlements:pay` | Records `PartnerPayment` (payout to partner or commission remittance from partner) with UTR/reference and allocates partial or full amount to settlement(s). |
| `POST` | `/api/v1/settlements/[id]/reverse` | `settlements:reverse` | Reverses posted settlement with reason, posts reversing journal entry, and releases `settlement_items.is_active_lock` so items can be accurately re-settled. |
| `GET` | `/api/v1/dashboard/summary` | Consultancy Authenticated | Aggregated KPIs for `[from, to]`: patient count, orders by status, completed vs pending tests, Model A invoice total, cash vs Razorpay method breakdown, outstanding patient balances, refunds, gateway fees, pending gateway settlements, partner payables, and Model B commission receivables (strictly excluding Model B direct collections from consultancy cash/bank totals). |
| `GET` | `/api/v1/reports/export/[reportType]` | `reports:finance` | Streams `.xlsx` workbook (`ExcelJS`) for all 13 PRD financial/operational registers (`daily-collections`, `invoice-register`, `patient-outstanding`, `cashier-closing`, `razorpay-transactions`, `razorpay-settlements`, `refund-register`, `partner-payables`, `partner-commissions`, `completed-tests`, `partner-performance`, `patient-order-history`, `gross-margin-analysis`). |

