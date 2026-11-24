# Diagnostic Consultancy Management System (DCMS)

Production-grade operational and financial ERP for an Indian diagnostic consultancy working across multiple partner diagnostic centres.

## Core Capabilities
- **Central Patient Registry:** Unique `PAT-YYYY-NNNNN` codes, string-preserved Indian/international mobile numbers, consent tracking, and consolidated clinical/billing timelines.
- **Single-Partner Order Architecture:** Manual partner centre selection, multi-test & multi-package orders (with deterministic package-to-item expansion), test-level status tracking (`PENDING`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `UNABLE_TO_PERFORM`), and immutable transaction-time commercial snapshots.
- **Dual Commercial Models:**
  - **Model A (`CONSULTANCY_COLLECTS`):** One immutable consultancy invoice per order, **mandatory multi-method split payments** (`Cash + Dynamic UPI QR + Razorpay Card/Netbanking` in one or multiple sessions), separate per-transaction receipts, credit/debit adjustment notes, and partner payable settlements on completed tests.
  - **Model B (`PATIENT_PAYS_PARTNER`):** Prohibits consultancy diagnostic invoices, records partner direct invoice/receipt references separately from consultancy cash/bank collections, and calculates percentage commission receivables strictly on completed tests.
- **Razorpay Integration:** Backend-only order & single-use fixed-amount Dynamic UPI QR creation, server-side HMAC-SHA256 Checkout & raw-body Webhook verification, idempotent event deduplication, separate gateway fee/GST tracking, and 4-stage bank UTR reconciliation.
- **Partner Diagnostic Centre Portal:** Server-enforced row-level `PartnerScopeContext` isolation (zero consultancy selling prices, margins, global patient directory, or cross-partner access), status updates, and magic-byte-validated private diagnostic report uploads.
- **Double-Entry Financial Traceability & Exports:** Balanced immutable journal entries and 13 downloadable `.xlsx` financial/operational registers.

---

## Architecture & Engineering Documentation
- [PRD Baseline](./Diagnostic_Consultancy_Management_System_PRD.md)
- [System Architecture](./architecture.md)
- [UI/UX & ERP Design System](./design.md)
- [Database Schema Design](./database-design.md)
- [REST & Webhook API Specification](./api-specification.md)
- [Security & Privacy Controls](./security-and-privacy.md)
- [Assumptions & Open Business Decisions Register](./assumptions-and-open-decisions.md)
- [Phased Implementation Plan](./implementation-plan.md)
- [Razorpay Sandbox Setup](./docs/razorpay-sandbox-setup.md)
- [WhatsApp & Email Provider Setup](./docs/whatsapp-email-setup.md)
- [Deployment & Operations](./docs/deployment-and-operations.md)
- [Backup & Restore Procedure](./docs/backup-and-restore.md)

---

## Local Setup Instructions

### 1. Prerequisites
- **Node.js:** `22.x` or `24.x` LTS
- **PostgreSQL:** `16+` (verified on PostgreSQL `18`)

### 2. Environment Configuration
Copy `.env.example` to `.env` and set your local PostgreSQL connection string and a 32+ character `SESSION_SECRET`:
```powershell
Copy-Item .env.example .env
# Optional on Windows with PostgreSQL 18 installed: boot an isolated workspace-local DB on port 5435
powershell -ExecutionPolicy Bypass -File .\scripts\dev-db.ps1 -Action start
```

### 3. Install Dependencies, Run Migrations & Seed Synthetic Demo Data
```bash
npm install
npm run db:generate
npm run db:deploy
npm run db:seed
```

> **Synthetic Demo Accounts (Seeded by `prisma/seed.ts` — Password for all demo accounts: `Demo#Erp2026!`):**
> - Super Admin: `superadmin@demo-dcms.local`
> - Receptionist: `reception@demo-dcms.local`
> - Accountant: `accounts@demo-dcms.local`
> - Partner A Admin (Metro Scans — Model A): `partner.metro@demo-dcms.local`
> - Partner B Admin (Star Care — Model B): `partner.star@demo-dcms.local`

### 4. Start Development Server
```bash
npm run dev
```
Open `http://localhost:3000`.

### 5. Verification & Test Suites
```bash
npm run typecheck   # Strict TypeScript compiler check
npm run lint        # ESLint (zero explicit any, Next.js rules)
npm test            # Vitest unit & integration suites
npm run build       # Production Next.js + Prisma build check
npm run test:e2e    # Playwright end-to-end browser suite
```

---

## Legal & CA Review Notice
Before enabling live invoicing, GST calculation, or Model B commission settlements in production, review and sign off all items in [assumptions-and-open-decisions.md](./assumptions-and-open-decisions.md) with your Product Owner, Chartered Accountant, and legal counsel, then configure the confirmed policies in `/admin/settings`.

