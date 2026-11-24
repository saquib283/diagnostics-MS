# DCMS Phased Implementation Plan

> **For agentic workers:** Follow strict TDD (`test-driven-development`) and `verification-before-completion` gates at the end of every phase. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a production-grade Diagnostic Consultancy Management System (DCMS) modular monolith for an Indian diagnostic consultancy supporting Model A (Consultancy Collects + Split Payments + Partner Payables) and Model B (Patient Pays Partner + Commission Receivables), Razorpay Checkout & Dynamic UPI QR, immutable PDF billing/sharing, strict Partner Portal isolation, and double-entry financial traceability.

**Architecture:** Next.js 16 (App Router, TypeScript strict mode) modular monolith backed by PostgreSQL + Prisma ORM, `Decimal.js` fixed-precision arithmetic, server-side database-backed session authentication with RBAC and `PartnerScopeContext` repository guards, private S3-compatible document storage, PDFKit & ExcelJS server engines, and adapter-isolated Razorpay, WhatsApp Business, and Email integrations.

**Tech Stack:** Next.js `16.4.x`, React `19.x`, TypeScript `5.x`, PostgreSQL `18` + Prisma `6.19.x`, `decimal.js`, `zod` `4.x` / `3.24.x` (RHF-compatible), `react-hook-form`, Tailwind CSS `4.x`, `lucide-react`, `pdfkit`, `exceljs`, `@aws-sdk/client-s3`, `razorpay`, `vitest`, `@playwright/test`.

**Spec:** [Diagnostic_Consultancy_Management_System_PRD.md](./Diagnostic_Consultancy_Management_System_PRD.md), [architecture.md](./architecture.md), [design.md](./design.md), [database-design.md](./database-design.md), [api-specification.md](./api-specification.md), [security-and-privacy.md](./security-and-privacy.md), [assumptions-and-open-decisions.md](./assumptions-and-open-decisions.md).

## Global Constraints

- **Money & Rates:** Authoritative calculations use `Decimal` (`DECIMAL(14,2)` money, `DECIMAL(7,4)` percentages); never JavaScript `number` float arithmetic.
- **Order Cardinality:** Exactly one partner diagnostic centre per `DiagnosticOrder`; multiple tests per order; multiple orders per patient across centres.
- **Dual Payment Models:** Model A issues 1 consultancy invoice per order and tracks partner payables on `COMPLETED` items; Model B never issues a consultancy patient diagnostic invoice, never counts partner collections in consultancy cash/bank totals, and calculates commission receivables only on `COMPLETED` items.
- **Split Payments:** Unlimited payment rows (`PatientPayment`) per `Invoice` across methods and sessions; zero method-amount columns on `Invoice`; block overpayment by default.
- **Immutability & Non-Destructive History:** Freeze snapshots on `OrderItem` & `InvoiceItem`; `ON DELETE RESTRICT` on financial/clinical FKs; correct issued invoices/settlements only via Credit/Debit Notes, adjustments, and reversals.
- **Open Decisions Gate:** Never hardcode GST rates, commission bases, or unconfirmed legal policies; wire all 12 PRD Section 15 items to `OrganizationSettings` / `PartnerContract` configuration with safe defaults.
- **ERP UI Discipline:** Light neutral surfaces, Clinical Navy `#1B365D`, `2px–6px` radii, thin `1px` borders, `tabular-nums`, native `<dialog>`, accessible `<label htmlFor>`, zero pills/gradients/blobs/glassmorphism.

---

## Phase 1: Repository Inspection, Core Specifications & Architecture
**Deliverables:**
- [x] Inspect workspace & local runtime (`Node v24.14.1`, `PostgreSQL 18`).
- [x] Author `architecture.md`, `design.md`, `database-design.md`, `assumptions-and-open-decisions.md`, `security-and-privacy.md`, `api-specification.md`, and `implementation-plan.md`.

---

## Phase 2: Project Foundation, Design System, Auth, RBAC & Audit
**Files Created:**
- Config & Env: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `.env.example`, `.gitignore`, `src/lib/env.ts`
- Database & Seed: `prisma/schema.prisma`, `prisma/migrations/*`, `prisma/seed.ts`, `src/lib/db/index.ts`
- Core Libraries: `src/lib/money/index.ts`, `src/lib/logger/index.ts`, `src/lib/http/index.ts`, `src/lib/rate-limit/index.ts`
- Auth, RBAC & Audit: `src/lib/auth/password.ts`, `src/lib/auth/session.ts`, `src/lib/permissions/rbac.ts`, `src/lib/permissions/scope.ts`, `src/modules/audit/service.ts`, `src/modules/auth/service.ts`, `src/modules/users/service.ts`, `src/modules/organization/service.ts`
- ERP Design System & Shells: `src/app/globals.css`, `src/components/ui/*` (`button.tsx`, `input.tsx`, `select.tsx`, `badge.tsx`, `dialog.tsx`, `table.tsx`, `panel.tsx`), `src/components/layout/admin-shell.tsx`, `src/components/layout/partner-shell.tsx`
- Routes & Pages: `src/app/(auth)/login/page.tsx`, `src/app/admin/users/page.tsx`, `src/app/admin/settings/page.tsx`, `src/app/admin/audit/page.tsx`, `src/app/api/v1/auth/*`, `src/app/api/v1/users/*`, `src/app/api/v1/organization/settings/route.ts`, `src/app/api/v1/health/route.ts`
- Tests: `tests/unit/money.test.ts`, `tests/unit/password-and-rbac.test.ts`, `tests/unit/audit-redaction.test.ts`

**Verification Gate:** `npm run typecheck && npm run lint && npm test && npm run build`

---

## Phase 3: Master Data — Patients, Partners, Test Catalogue, Contracts & Pricing
**Files Created:**
- Domain Modules: `src/modules/patients/{schemas,repository,service}.ts`, `src/modules/catalogue/{schemas,repository,service}.ts`, `src/modules/partners/{schemas,repository,service,dto}.ts`
- API Routes: `/api/v1/patients/**`, `/api/v1/test-categories/**`, `/api/v1/tests/**`, `/api/v1/packages/**`, `/api/v1/partners/**`, `/api/v1/tax-codes/**`
- Admin Pages: `/admin/patients`, `/admin/patients/[id]`, `/admin/tests`, `/admin/packages`, `/admin/partners`, `/admin/partners/[id]`
- Tests: `tests/unit/pricing-and-commission-windows.test.ts`, `tests/unit/package-allocation.test.ts`, `tests/integration/master-data-rbac.test.ts`

**Verification Gate:** Verify non-overlapping partner price & commission effective-date guards, string mobile preservation (`+91` / leading `0`), package item weight allocation, and typecheck/lint/tests.

---

## Phase 4: Diagnostic Orders, Order Items, Status History & Commercial Snapshots
**Files Created:**
- Domain Module: `src/modules/orders/{state-machine,schemas,repository,service}.ts`
- API Routes: `/api/v1/orders`, `/api/v1/orders/[id]`, `/api/v1/orders/[id]/items/[itemId]/status`, `/api/v1/orders/[id]/items/[itemId]/approve-completion`
- Admin Pages: `/admin/orders`, `/admin/orders/new` (fast Reception Counter Order Builder), `/admin/orders/[id]`
- Tests: `tests/unit/order-state-machine.test.ts`, `tests/integration/order-snapshots.test.ts` (proving subsequent catalogue/partner price edits never alter historical orders)

---

## Phase 5: Invoicing, PDF Generation, Receipt Generation & Secure Sharing
**Files Created:**
- Storage, PDF & Sharing: `src/lib/storage/{types,s3-adapter,local-private-adapter,index}.ts`, `src/lib/pdf/{invoice-pdf,receipt-pdf,statement-pdf}.ts`, `src/modules/billing/{schemas,repository,service}.ts`, `src/modules/documents/{share-service}.ts`, `src/modules/notifications/{whatsapp-adapter,email-adapter,service}.ts`
- API & Customer Portal: `/api/v1/orders/[id]/invoice`, `/api/v1/orders/[id]/partner-invoice-ref`, `/api/v1/invoices/**`, `/api/v1/public/documents/[token]`, `/d/[token]/page.tsx`
- Admin Pages: `/admin/invoices`, `/admin/invoices/[id]`
- Tests: `tests/unit/invoice-immutability-and-tax.test.ts`, `tests/unit/share-tokens.test.ts`, `tests/integration/model-a-vs-model-b-billing.test.ts`

---

## Phase 6: Manual Cash Collection, Split-Payment Ledger, Receipts & Refunds
**Files Created:**
- Domain Modules: `src/modules/payments/{ledger-math,schemas,repository,service}.ts`, `src/modules/receipts/{service,refund-service}.ts`
- API Routes: `/api/v1/invoices/[id]/payments/manual`, `/api/v1/receipts/[id]/pdf`, `/api/v1/payments/[id]/refunds`
- UI Components & Pages: `src/components/payments/split-payment-panel.tsx`, `/admin/payments`, `/admin/refunds`
- Tests: `tests/unit/split-payment-ledger.test.ts` (including exact ₹5,000 = ₹2,000 cash + ₹2,000 UPI QR + ₹1,000 card multi-session test, overpayment rejection, failed/pending exclusion, partial/full refund recalculation, and `PARTIALLY_PAID` invariant)

---

## Phase 7: Razorpay Checkout, Dynamic UPI QR, Webhooks & Gateway Reconciliation
**Files Created:**
- Razorpay Adapter & Services: `src/modules/razorpay/{client,signature,qr-service,webhook-processor,reconciliation-service}.ts`
- API Routes: `/api/v1/invoices/[id]/payments/razorpay/order`, `/api/v1/payments/razorpay/verify`, `/api/v1/invoices/[id]/payments/qr`, `/api/v1/payments/qr/[qrSessionId]/**`, `/api/v1/webhooks/razorpay/route.ts` (raw-body HMAC), `/api/v1/reconciliation/**`
- UI Components: `src/components/payments/razorpay-checkout-button.tsx`, `src/components/payments/counter-upi-qr-dialog.tsx`
- Tests: `tests/unit/razorpay-signatures-and-webhooks.test.ts` (valid/invalid HMAC, duplicate `event_id` idempotency, `qr_code.credited`, expired QR, fee/tax separation, settlement batch vs bank credit separation)

---

## Phase 8: Partner Portal, Strict Row Isolation, Status Updates & Report Uploads
**Files Created:**
- Report Module: `src/lib/storage/file-validator.ts` (magic-byte PDF/JPEG/PNG inspector), `src/modules/reports/{schemas,repository,service}.ts`
- Partner APIs & Pages: `/api/v1/order-items/[itemId]/reports`, `/api/v1/reports/[fileId]/download`, `/api/v1/partner/**`, `/partner/dashboard`, `/partner/orders`, `/partner/orders/[id]`, `/partner/reports`, `/partner/settlements`, `/partner/users`, `/partner/profile`, `/admin/reports`
- Tests: `tests/unit/file-magic-bytes.test.ts`, `tests/integration/partner-isolation-idor.test.ts` (proving Partner A receives `404` and zero price/margin fields when probing Partner B orders, items, reports, or settlements)

---

## Phase 9: Settlements, Commission Receivables, Ledger & Financial Reports/Exports
**Files Created:**
- Modules: `src/modules/settlements/{eligibility,schemas,repository,service}.ts`, `src/modules/accounting/{ledger-service}.ts`, `src/modules/analytics/{dashboard-service,reports-service,excel-exporter}.ts`
- APIs & Pages: `/api/v1/settlements/**`, `/api/v1/dashboard/summary`, `/api/v1/reports/export/[reportType]`, `/admin/dashboard`, `/admin/settlements`, `/admin/settlements/[id]`, `/admin/accounting`
- Tests: `tests/unit/settlement-eligibility-and-commissions.test.ts` (completed-only rule, duplicate-settlement lock, partial allocations, settlement reversal & re-eligibility, Model B direct-collection exclusion from consultancy cash, balanced journal entries `SUM(debit) == SUM(credit)`)

---

## Phase 10: Security Hardening, E2E Suite, Operational Guides & Final Verification
**Files Created:**
- Security & Proxy: `src/proxy.ts` / security headers, endpoint rate-limiting integration
- Operational Guides & Scripts: `README.md`, `docs/deployment-and-operations.md`, `docs/backup-and-restore.md`, `docs/razorpay-sandbox-setup.md`, `docs/whatsapp-email-setup.md`, `scripts/backup-db.sh`, `scripts/backup-db.ps1`, `scripts/restore-db.sh`
- E2E Tests: `tests/e2e/reception-and-partner-workflow.spec.ts`
- Final Gate: Full `typecheck`, `lint`, unit + integration + isolation test suites, production `next build`, and traceability audit against PRD Section 13 Acceptance Criteria.

