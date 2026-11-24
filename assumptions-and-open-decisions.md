# Assumptions & Open Business Decisions Register — DCMS

**Document Status:** Living Governance Register v1.0  
**Source of Truth:** [Diagnostic_Consultancy_Management_System_PRD.md](./Diagnostic_Consultancy_Management_System_PRD.md) (Section 15, Section 5, Section 6.15)

> [!IMPORTANT]
> **Strict Engineering Governance Rule:** This system does **not** invent legal, tax, accounting, commission, or payment-provider rules. Every unresolved item from PRD Section 15 is catalogued below, isolated behind an explicit database/configuration policy in `OrganizationSettings` or `PartnerContract` (never hardcoded in TypeScript), and gated with conservative safe defaults until confirmed by the Product Owner, Chartered Accountant (CA), Legal Counsel, or Payment/Messaging Provider.

---

## 1. Mandatory Open Decisions (PRD Section 15)

### OD-001 — Model B Commission Calculation Basis
- **PRD Reference:** Section 5.3, Section 15.1
- **Unresolved Question:** Should percentage commission under Model B be computed on:
  1. `NET_AFTER_DISCOUNT_EXCL_TAX` (Net diagnostic amount after patient discount, excluding GST),
  2. `GROSS_BEFORE_DISCOUNT_EXCL_TAX` (Partner gross tariff before discount, excluding GST), or
  3. `NET_INCL_TAX` (Total collected by partner including tax)?
- **Material Impact:** Directly alters partner commission receivables, partner statements, and revenue recognition.
- **Architectural Handling (No Hardcoded Assumption):** Modeled as `CommissionCalculationBasis` enum on `OrganizationSettings`, `PartnerContract`, and `PartnerCommissionRate`, and snapshotted onto `OrderItem.commissionBasisSnapshot`. Until confirmed by the owner/CA, new live partner contracts default to `UNCONFIGURED`, which blocks finalizing live Model B commission statements until an authorized Super Admin selects the contractually agreed basis.

### OD-002 — Consultancy Approval Before Test Completion Financial Eligibility
- **PRD Reference:** Section 5.2, Section 15.2
- **Unresolved Question:** When a partner user marks an `OrderItem` as `COMPLETED`, does it immediately become eligible for Model A Payable / Model B Commission, or must a consultancy Admin/Report Manager first approve completion?
- **Material Impact:** Controls when partner liabilities and commission receivables accrue.
- **Architectural Handling:** Controlled by `OrganizationSettings.requireConsultancyCompletionApproval` (`boolean`). Both `completedAt`/`completedByUserId` and `completionApprovedAt`/`completionApprovedById` are stored on `OrderItem`. Default in configuration: `false` (configurable per owner sign-off without schema change).

### OD-003 — Refund, Cancellation & Partner Deduction Rules
- **PRD Reference:** Section 6.9, Section 14 Phase 0, Section 15.3
- **Unresolved Question:** Under what conditions may an order item be cancelled after sample collection/in-progress, who absorbs Razorpay gateway fees on customer refunds, and what partner cancellation deductions apply?
- **Material Impact:** Affects customer net refund amounts and partner debit/credit adjustments.
- **Architectural Handling:** Refunds require explicit `refunds:initiate` / `refunds:approve` RBAC permissions, mandatory reason text, and link to a specific `PatientPayment`. Gateway fees are tracked separately on `PaymentGatewayTransaction` (not auto-reversed unless Razorpay webhook confirms fee refund). Partner deductions are never auto-guessed; they use explicit audited `PartnerAdjustment` rows requiring reason + approval.

### OD-004 — Invoice Overpayment & Patient Advance Handling
- **PRD Reference:** Section 6.7, Section 15.4
- **Unresolved Question:** May a patient pay more than `Invoice.balanceDue`, and if so, how are customer advances/credits accounted for?
- **Material Impact:** Liability accounting (unearned patient advances) and GST advance-receipt rules.
- **Architectural Handling:** Per PRD 6.7 ("Block overpayment by default"), `OrganizationSettings.allowInvoiceOverpayment` defaults to `false`, and the payment service strictly rejects any `amount > invoice.balanceDue` inside a row-locked transaction until an advance-ledger policy is approved by the CA.

### OD-005 — Static UPI QR Fallback Reconciliation Workflow
- **PRD Reference:** Section 6.8 (UPI QR), Section 15.5
- **Unresolved Question:** If dynamic Razorpay UPI QR is unavailable or temporarily down and a printed static consultancy QR is used at the counter, who is authorized to match bank/UPI UTR credits to invoices?
- **Material Impact:** Fraud/misallocation risk if receptionists can self-verify unverified static QR claims.
- **Architectural Handling:** `OrganizationSettings.staticQrFallbackEnabled` defaults to `false`. When enabled, static QR entries create a `PENDING` payment / `STATIC_QR_UNMATCHED` `CollectionRecord` with mandatory UTR/RRN reference that **does not** mark the invoice `PAID` until verified by a user holding `payments:reconcile` (`ACCOUNTANT` / `ADMIN` / `SUPER_ADMIN`).

### OD-006 — Razorpay Product Eligibility, Dynamic QR Availability & Merchant Pricing
- **PRD Reference:** Section 6.8, Section 15.6
- **Unresolved Question:** Which payment methods (UPI Intent/Collect, Dynamic `upi_qr` via `/v1/payments/qr_codes`, Debit/Credit Cards, Netbanking) are enabled on the consultancy's live Razorpay MID, and what is the negotiated MDR/fee schedule?
- **Material Impact:** Determines live counter checkout options and expected settlement deductions.
- **Architectural Handling:** Enabled methods and `dynamicQrEnabled` are configurable in `PaymentGatewaySettings`. Actual fees and fee taxes are read authoritatively from Razorpay's payment/settlement payloads (`fee`, `tax` in paise) rather than hardcoded MDR percentages.

### OD-007 — GST Applicability & Tax Rates for Diagnostic Services vs Consultancy Commission
- **PRD Reference:** Section 6.15, Section 15.7
- **Unresolved Question:** Under Indian GST law, healthcare clinical diagnostic services often carry specific exemptions (e.g., SAC 999316 / Notification 12/2017-CT(R)), whereas business intermediary/commission services or non-clinical administrative fees may attract 18% GST (`CGST 9% + SGST 9%` or `IGST 18%`), and Model A principal-vs-pure-agent structure materially changes tax treatment.
- **Material Impact:** Legal tax compliance, GSTIN registration obligations, HSN/SAC codes, and invoice tax lines.
- **Architectural Handling:** **Zero hardcoded GST rates.** `TaxCode` supports `0%` exempt, intra-state (`CGST` + `SGST`), and inter-state (`IGST`) computed dynamically from `Organization.stateCode` vs place-of-supply state code, separately per `supplyCategory` (`DIAGNOSTIC_SERVICE`, `CONSULTANCY_COMMISSION`, `OTHER_FEE`). Production invoice issuance requires explicit CA-approved tax configuration.

### OD-008 — Invoice Legal Wording, Numbering Format & Credit/Debit Note Rules
- **PRD Reference:** Section 6.6, Section 15.8
- **Unresolved Question:** Should Model A documents be titled `"Tax Invoice"`, `"Bill of Supply"` (if exempt), or `"Invoice"`, what prefix/FY reset sequence is required, and what approval workflow governs Credit/Debit Notes?
- **Material Impact:** Statutory GST invoice compliance under Rule 46 / Rule 49 CGST Rules.
- **Architectural Handling:** Document title, prefix (`INV/2026-27/`), terms, footer wording, and authorized signatory image are stored in `OrganizationSettings` & `InvoiceSequence` and snapshotted onto every issued invoice. Issued invoices are strictly immutable; adjustments generate numbered `InvoiceAdjustmentNote` (`CN-...` / `DN-...`) documents.

### OD-009 — Approved WhatsApp Business Provider & Message Templates
- **PRD Reference:** Section 6.10, Section 6.16, Section 15.9
- **Unresolved Question:** Which Meta-approved WhatsApp Business Solution Provider (BSP — e.g., Meta Cloud API direct, Gupshup, Interakt, Wati, Twilio) will the consultancy contract, and what are the approved template names/variables?
- **Material Impact:** Business-initiated WhatsApp messages in India require pre-approved Meta utility templates and DLT/BSP onboarding.
- **Architectural Handling:** Implemented behind a clean `WhatsAppProvider` adapter (`MetaCloudWhatsAppAdapter` + `NoopLoggedAdapter` when unconfigured — never faking delivery; unconfigured state explicitly reports `PROVIDER_NOT_CONFIGURED`). Template names and variable mappings are admin-configurable in `NotificationTemplate`.

### OD-010 — Data Retention, Patient Consent & Indian Privacy Compliance (DPDP Act 2023)
- **PRD Reference:** Section 6.2, Section 11, Section 15.10
- **Unresolved Question:** How long must diagnostic reports, invoices, and patient records be retained (e.g., 8 years for tax/accounting records under Indian tax rules vs clinical report retention), and what explicit patient consent wording is required at reception?
- **Material Impact:** Statutory compliance under India's Digital Personal Data Protection (DPDP) Act, 2023 and Income Tax / GST record-keeping mandates.
- **Architectural Handling:** `PatientConsent` records explicit per-purpose consent (`DATA_PROCESSING`, `WHATSAPP_COMMUNICATION`, `EMAIL_COMMUNICATION`, `PARTNER_SHARING`) with actor and timestamp. Financial/audit records block hard deletion; document share links default to expiring (`72h` configurable) and support instant one-click revocation.

### OD-011 — Partner Visibility of Patient Contact Details
- **PRD Reference:** Section 4.3, Section 6.12, Section 15.11
- **Unresolved Question:** Should partner portal users see the patient's full mobile number (e.g., to coordinate scan preparation/appointments) or only a masked mobile number (`+91 ******4321`)?
- **Material Impact:** Balances patient privacy/anti-poaching protection against partner centre operational coordination.
- **Architectural Handling:** Controlled by `OrganizationSettings.partnerPatientPhoneVisibility` (`MASKED | FULL`). Safe privacy-preserving default is **`MASKED`**, enforced in the server-side Partner DTO mapper (`src/modules/partners/dto.ts`) so full phone/email/address never even serialize over the wire when `MASKED` is active.

### OD-012 — Mandatory vs Optional Settlement Approval Step
- **PRD Reference:** Section 6.13, Section 15.12
- **Unresolved Question:** Must generated partner settlement statements pass through a two-step `DRAFT -> PENDING_APPROVAL -> APPROVED` workflow before payouts/remittances can be allocated, or can a single Admin/Accountant finalize directly?
- **Material Impact:** Internal financial control and segregation of duties.
- **Architectural Handling:** Controlled by `OrganizationSettings.requireSettlementApproval` (defaults to **`true`** for stronger internal financial control; toggleable by `SUPER_ADMIN`).

---

## 2. Technical & Operational Assumptions Register

| ID | Area | Assumption Recorded | Reversible / Configurable? |
|---|---|---|---|
| **TA-001** | Currency & Locale | All monetary amounts are Indian Rupees (`INR`, `₹`), formatted with Indian digit grouping (`en-IN`, e.g., `₹1,25,000.00`) in UI and PDFs, stored as `DECIMAL(14,2)`. | Yes |
| **TA-002** | Timezone | All database timestamps are stored in `UTC` (`TIMESTAMPTZ`). All operational dates, shift cutoffs, and PDF timestamps render in `Asia/Kolkata` (`UTC+05:30`). | Configurable in `OrganizationSettings` |
| **TA-003** | Financial Year | Document sequences (`INV`, `RCP`, `STL`, `CN`, `DN`, `JE`) partition by Indian Financial Year (`April 1 – March 31`, e.g., `2026-27`). | Configurable per `InvoiceSequence` |
| **TA-004** | Package Expansion | When a `TestPackage` is added to an order, it expands into constituent `OrderItem` rows linked via `sourcePackageId`, allocating selling price proportionally by `allocationWeight` (with exact penny reconciliation on the final item) so individual tests can be tracked and settled upon completion. | Standard per PRD 6.3 |
| **TA-005** | Report File Types | Allowed diagnostic report upload formats default to `application/pdf`, `image/jpeg`, and `image/png` (verified by both MIME header and file magic bytes), max `20 MB` per file. | Configurable via env (`MAX_REPORT_UPLOAD_MB`) |
| **TA-006** | Local Dev Storage | In local development/automated tests where S3 credentials are absent, `LocalPrivateStorageAdapter` writes outside `public/` (in `.private-storage/`), never serving static files directly; production requires `STORAGE_DRIVER=s3` validated at startup. | Enforced by `src/lib/env.ts` |

---

## 3. Product Owner & CA Sign-Off Checklist (Action Required Before Production Launch)

1. **[Owner + CA]** Confirm `OD-001` (Model B commission base: net after discount excl. tax vs gross vs incl. tax).
2. **[Owner + CA]** Confirm `OD-007` & `OD-008` (Consultancy GSTIN status, SAC codes, Model A principal vs pure-agent GST treatment, and exact invoice legal title/wording).
3. **[Owner]** Confirm `OD-002` (Whether partner-marked test completions require consultancy review before settlement eligibility) and `OD-011` (Masked vs full patient phone in Partner Portal).
4. **[Owner]** Confirm `OD-003`, `OD-004`, `OD-012` (Cancellation fee deductions, advance policy, settlement approval requirement).
5. **[Owner + Razorpay/BSP]** Confirm `OD-006` (Razorpay MID Dynamic `upi_qr` activation) and `OD-009` (WhatsApp BSP credentials & approved template IDs).

