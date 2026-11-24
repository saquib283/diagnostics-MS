# Diagnostic Consultancy Management System

## Product Requirements Document (PRD)

**Version:** 1.3\
**Status:** Product requirements baseline for implementation\
**Target market:** India\
**Primary users:** Diagnostic consultancy staff, partner diagnostic
centres, patients (via shared documents/links)

------------------------------------------------------------------------

## 1. Product overview

The Diagnostic Consultancy Management System (DCMS) is a web-based
business operations platform for a diagnostic consultancy that works
with multiple diagnostic centres.

The consultancy receives patients, registers them, selects a partner
diagnostic centre, creates a separate order and bill for each selected
centre, collects payments where applicable, tracks test completion and
reports, and settles accounts with partner centres.

The platform must support two commercial/payment models:

-   **Model A -- Consultancy collects:** The patient pays the
    consultancy. The consultancy issues the patient invoice and pays the
    partner centre later.
-   **Model B -- Patient pays partner:** The patient pays the partner
    diagnostic centre directly. The partner's invoice/receipt reference
    is recorded, and the consultancy earns a percentage commission from
    the partner.

The system is intended initially for approximately **50--200 patients
per month** and **5--20 partner diagnostic centres**, while using an
architecture that can scale without premature microservices.

This is an operational and financial management system, not a Laboratory
Information System (LIS), Hospital Information System (HIS), or
diagnostic equipment integration platform.

## 2. Goals

1.  Maintain a centralized patient registry and patient history.
2.  Maintain diagnostic test and package catalogues.
3.  Manage partner diagnostic centres and negotiated pricing.
4.  Create one diagnostic order per partner centre, with multiple tests
    per order.
5.  Let an administrator manually choose the partner centre for each
    order.
6.  Generate separate bills for each diagnostic centre order.
7.  Support both consultancy-collected and partner-collected payment
    models.
8.  Support cash, UPI, card, netbanking and other configured payment
    methods.
9.  Integrate Razorpay for supported online payment methods.
10. Display/generate a consultancy UPI QR code for counter collections.
11. Support split payments, such as part cash and part UPI, against one
    invoice.
12. Track payment attempts, successful collections, refunds and Razorpay
    settlements.
13. Track each test independently and make only completed tests eligible
    for partner settlement or commission calculation.
14. Allow consultancy staff and authorized partner users to upload and
    manage reports manually.
15. Generate professional PDF invoices, payment receipts and statements.
16. Share invoices and receipts with customers through WhatsApp and
    email, as configured.
17. Provide partner-wise settlement, commission, collection and
    profitability reports.
18. Maintain audit trails, role-based permissions and strict partner
    data isolation.

## 3. Non-goals

The initial release will not: - Connect directly to laboratory machines
or diagnostic equipment. - Integrate with partner LIS/HIS systems. -
Automatically fetch reports from partner systems. - Provide clinical
diagnosis, medical advice or interpretation of reports. - Replace
accounting/tax advice from a qualified CA. - Operate as a multi-tenant
SaaS product for unrelated consultancies unless separately scoped. -
Assume that every partner supports the same payment gateway or
collection process.

## 4. Users and roles

### 4.1 Consultancy-side roles

-   **Super Admin:** Full system configuration, user and permission
    management.
-   **Admin:** Operational management of patients, tests, partners,
    orders, invoices and reports.
-   **Receptionist:** Patient registration, order creation, invoice
    generation and payment collection within assigned permissions.
-   **Accountant:** Payment verification, refunds (if authorized),
    partner settlements, reconciliation and financial reports.
-   **Report Manager:** Report tracking, upload, review and delivery.
-   **Viewer/Auditor:** Read-only access to explicitly permitted
    records.

### 4.2 Partner-side roles

-   **Partner Admin:** Manages users for their own centre and accesses
    that centre's orders, reports and settlement statements.
-   **Partner Staff:** Views assigned orders and updates permitted test
    statuses.
-   **Partner Report Manager:** Uploads and manages reports for that
    partner's orders.

A user may have multiple roles if permitted. Partner users must be
linked to a specific partner centre (or explicitly authorized set of
centres).

### 4.3 Permission principles

-   Permissions must be enforced on the server, not only by hiding
    frontend controls.
-   Partner users may access only records belonging to their partner
    centre and only the patient information required to fulfil the
    order.
-   Partner users must not see other partners, the consultancy's
    complete patient directory, internal purchase margins, consultancy
    selling prices, or consultancy-wide financial/profit dashboards.
-   Sensitive actions such as issuing invoices, recording refunds,
    approving settlements, changing commission rates and managing users
    require explicit permissions.
-   All important financial and access-sensitive actions must be
    audited.

## 5. Business model and core business rules

### 5.1 Order structure

-   A patient can have multiple diagnostic orders.
-   **One order belongs to exactly one partner diagnostic centre.**
-   An order can contain multiple test items.
-   If a patient needs tests at three different centres, create three
    orders and, under Model A, three separate invoices.
-   The administrator manually selects the partner centre.
-   Partner-specific test prices and applicable commission terms are
    used when the order is created.
-   Prices, discounts, commission rates and tax values must be
    snapshotted on the order item/invoice so later catalogue changes do
    not rewrite history.

### 5.2 Test-level status

Each order item/test has its own status. Suggested statuses:

-   Pending
-   Confirmed
-   In Progress
-   Completed
-   Cancelled
-   Unable to Perform (optional configurable status)

The overall order status is derived from its items or maintained
consistently by a defined state-transition service. It must support
partially completed orders.

**Settlement eligibility rule:** Only completed test items are eligible
for partner settlement under Model A or commission calculation under
Model B. Pending, in-progress, cancelled and unable-to-perform items are
excluded unless an explicitly authorized adjustment policy is
configured.

Partner status changes must be recorded with actor, timestamp, previous
status and new status. The system must not silently mark a test
complete.

Whether consultancy review/approval is required before completion
becomes financially eligible is a configurable business rule and must be
confirmed before implementation. Do not assume mandatory approval
without product-owner confirmation.

### 5.3 Payment models

#### Model A -- Consultancy collects from patient

-   The consultancy issues the patient invoice.
-   The patient pays the consultancy using cash, UPI, card, netbanking
    or another enabled method.
-   The consultancy records each collection against the invoice.
-   The partner amount becomes payable only for completed test items,
    according to the partner's agreed rates.
-   The consultancy later pays the partner and records the
    settlement/payment allocation.
-   Patient collection and partner payable must be accounted for
    separately.

Example: - Patient invoice amount: ₹2,000. - Partner negotiated amount
for completed tests: ₹1,400. - Illustrative gross difference: ₹600
before applicable expenses, taxes and accounting adjustments.

#### Model B -- Patient pays partner directly

-   The patient pays the partner diagnostic centre directly.
-   The consultancy does not issue its own patient invoice for the
    partner's diagnostic service.
-   Record the partner's invoice number, receipt number, date, amount
    and optional uploaded document.
-   Record direct collection details separately from consultancy
    collections.
-   The consultancy earns a percentage commission under its agreement
    with the partner.
-   Commission is calculated only on completed test items.
-   The partner later remits commission to the consultancy; track this
    as a receivable and reconcile receipts.

Example: - Patient pays partner: ₹2,000. - Illustrative commission rate:
15%. - Illustrative commission: ₹300.

The exact commission calculation base (gross/net, before/after discount,
inclusion/exclusion of GST and other adjustments) is **not yet
confirmed**. It must be configurable and approved against the partner
agreement and CA advice. Do not hardcode an assumption.

### 5.4 Commission configuration

-   Percentage-based commission is required.
-   A default percentage may be configured per partner.
-   An optional test-specific override may be supported.
-   Rates should have effective-from/effective-to dates.
-   Snapshot the applied percentage, calculation basis and computed
    commission on the order item.
-   Historical transactions must not change when a future rate changes.
-   Prevent overlapping active rates for the same partner/test scope,
    using transactional validation and database constraints where
    feasible.

### 5.5 Partner pricing

-   Maintain negotiated partner purchase prices per test.
-   Support effective dates and historical price records.
-   Optionally support partner-specific package pricing.
-   Snapshot the selected partner price at order creation.
-   Do not expose internal purchase prices to partner users.

## 6. Functional requirements

### 6.1 Authentication and user management

-   Secure sign-in and sign-out.
-   Password hashing using a modern password hashing algorithm.
-   Password reset flow.
-   Session expiry and secure cookie settings.
-   Role-based access control (RBAC).
-   Partner-to-user association and partner-scoped access.
-   User activation/deactivation.
-   Audit logs for user and permission changes.
-   Optional MFA can be considered for administrators.

### 6.2 Patient management

-   Create, view, edit and search patients.
-   Generate a unique patient code.
-   Search by patient name, mobile number and patient code.
-   Store full name, mobile, alternate mobile, date of birth, gender,
    email and address as required.
-   Store mobile numbers as strings, preserving country codes and
    leading zeros.
-   Show patient history: orders, invoices, payments, report
    availability and communication history as permitted.
-   Avoid collecting unnecessary personal information.
-   Record who created or updated a patient.

### 6.3 Test catalogue and packages

-   Manage test name, code, category, description, active status and
    default selling price.
-   Manage packages and package-to-test composition.
-   Support a package expanding into individual order items for
    fulfilment and settlement.
-   Allow a test to be inactive for new orders while preserving
    historical order records.
-   Snapshot test names/descriptions/prices on order items and invoice
    lines.

### 6.4 Partner centre management

-   Create and maintain partner diagnostic centre profiles.
-   Store legal/business name, partner code, contacts, address, email,
    phone, GST details where applicable and status.
-   Store contract dates, payment terms, default payment model and
    agreement attachments.
-   Configure partner-specific test prices.
-   Configure percentage commission rules for Model B.
-   Support multiple partner users per centre.
-   Disable a partner without deleting historical records.

### 6.5 Order creation and assignment

-   Search/select an existing patient or register a new patient.
-   Select one partner centre manually.
-   Add multiple tests/packages to that partner order.
-   Show relevant partner price and consultancy selling price to
    authorized staff.
-   Support quantity, discount and notes.
-   Validate that the selected partner can perform the selected test (if
    capability mapping is configured).
-   Choose Model A or Model B according to the applicable
    contract/transaction.
-   Generate a unique order number.
-   Preserve the partner, payment model and pricing snapshots.
-   Create separate orders when tests are assigned to different
    partners.
-   Do not allow an issued order to be silently rewritten; use an
    audited amendment/cancellation process.

### 6.6 Invoicing and bill generation

-   One invoice per diagnostic order for Model A.
-   Model A invoice issuer is the consultancy.
-   Model B must not create a consultancy patient invoice for the
    partner's diagnostic service. Instead, record partner
    invoice/receipt references.
-   Generate a professional PDF invoice with:
    -   Consultancy name, logo, address and contact information.
    -   Configured GSTIN and applicable tax details.
    -   Unique invoice number and date.
    -   Patient name, patient code and relevant contact information.
    -   Partner diagnostic centre name.
    -   Test names, quantities and prices.
    -   Discounts, taxable amount and tax breakdown where applicable.
    -   Grand total.
    -   Amount paid and outstanding amount.
    -   Payment status.
    -   Terms and conditions.
    -   Authorized signature/stamp if configured.
-   Support print and download.
-   Support invoice numbering sequences and appropriate uniqueness.
-   Issued invoices are immutable. Corrections use credit notes, debit
    notes or audited adjustment documents.
-   A refreshed account statement may show later payments, but must not
    silently alter the original issued invoice PDF.
-   Keep invoice and receipt as separate document types.

### 6.7 Payment collection

The consultancy must be able to collect patient payments through:

-   Cash (manual recording).
-   UPI QR code.
-   UPI online through Razorpay where supported.
-   Debit/credit cards through Razorpay.
-   Netbanking through Razorpay.
-   Other payment methods enabled on the merchant account.
-   Manual bank transfer recording if required.

#### Split/multiple payment methods

This is mandatory.

-   One invoice can have multiple payment transactions.
-   A single invoice may be paid using cash + UPI, cash + card, UPI +
    card or any supported combination.
-   A patient may make multiple payments at different times.
-   Each payment method/transaction must have its own payment record,
    amount, status, reference and collector/gateway details.
-   Example: ₹5,000 invoice = ₹2,000 cash + ₹2,000 UPI QR + ₹1,000 card.
-   The application calculates total successful payments and outstanding
    balance.
-   Do not store cash_amount, upi_amount and card_amount as columns on
    the invoice. Store transaction rows linked to the invoice.
-   Block overpayment by default. Any authorized excess must be recorded
    as an explicit advance/refund/adjustment, not silently applied.

#### Payment status

Suggested invoice statuses: - UNPAID - PARTIALLY_PAID - PAID -
PARTIALLY_REFUNDED - REFUNDED - VOID

A failed or pending payment attempt must not reduce the outstanding
balance. If overpayments/credits are explicitly supported, define their
status and accounting treatment separately.

### 6.8 Razorpay integration

-   Integrate Razorpay using server-side API calls.
-   Keep API keys/secrets only on the backend and in secure environment
    configuration.
-   Support Razorpay checkout for enabled methods such as UPI, cards and
    netbanking.
-   Create payment/order records on the server and associate them with
    the relevant invoice/payment attempt.
-   Verify payment signatures server-side.
-   Verify webhook signatures.
-   Process webhook events idempotently.
-   Do not mark an invoice paid based only on a browser redirect or
    client-side response.
-   Store Razorpay order ID, payment ID, refund ID, QR ID and settlement
    references where applicable.
-   Store the actual method returned by Razorpay.
-   Record gateway fees and applicable gateway taxes separately from the
    patient's invoice amount.
-   Track Razorpay settlement batches/UTR and bank-credit reconciliation
    separately from successful customer payments.
-   Handle failed, pending, expired, cancelled and duplicate payment
    events safely.
-   Use Razorpay's current official API documentation during
    implementation. Confirm merchant account eligibility, enabled
    products, pricing, QR availability and settlement terms before
    launch.

#### UPI QR

Preferred flow: invoice-linked, fixed-amount, single-use dynamic QR if
enabled for the merchant account.

1.  Cashier selects Collect Payment → UPI QR.
2.  Backend determines the permitted amount (normally the current
    outstanding amount or a cashier-entered partial amount).
3.  Backend creates a QR/payment attempt using the supported Razorpay QR
    API.
4.  Store the Razorpay QR identifier, invoice, payment attempt, amount,
    status and expiry.
5.  Display the QR to the patient.
6.  Receive and verify Razorpay webhook events.
7.  Update the payment and invoice only after verified success.
8.  Expire/close old QR attempts and allow a new one.
9.  Prevent one QR/payment from being applied more than once.

A reusable printed static consultancy QR may be offered as a fallback.
Since static QR collections may not reliably identify the invoice,
provide a controlled reconciliation workflow to match the bank/gateway
transaction to a patient invoice. Do not assume automatic invoice
matching unless the provider supports it.

### 6.9 Payment receipts and refunds

-   Generate a receipt for each successful payment transaction.
-   Receipt should show invoice/order reference, patient, amount,
    payment method, date, transaction reference and remaining balance.
-   A split payment can produce multiple receipts or one consolidated
    receipt statement; individual transaction traceability is mandatory.
-   Support full and partial refunds subject to permissions and gateway
    capability.
-   Refunds must reference the original payment.
-   Do not delete or overwrite original payment records.
-   Track refund status and gateway refund reference.
-   Recalculate net collected amount and invoice balance using a
    well-defined ledger.
-   Maintain audit history for manual refunds and adjustments.

### 6.10 Customer invoice and receipt sharing

The system must generate and share bills with customers.

Supported actions: - Download invoice PDF. - Print invoice. - Share
through WhatsApp. - Send through email. - Copy a secure invoice link. -
Generate payment receipt PDF and share it. - Share an updated account
statement showing payments and outstanding balance.

WhatsApp/email messages may include: - Invoice PDF or secure invoice
link. - Payment receipt. - Payment confirmation. - Outstanding balance
reminder. - Report-ready notification, if enabled.

Use an approved WhatsApp Business Platform provider and approved
templates for business-initiated messages where required. Log message
attempts and provider delivery status where available.

Secure sharing: - Use private storage. - Generate expiring/revocable
links or authenticated access. - Do not expose public sequential
document IDs. - Avoid including sensitive medical report details in
ordinary notification text. - Keep invoice sharing separate from
diagnostic report sharing. - Record who shared what, when, destination
and provider result.

### 6.11 Report management

-   Reports are manually uploaded by consultancy staff or authorized
    partner users.
-   Reports are linked to individual order items/tests.
-   Support multiple files/revisions per test when necessary.
-   Store original filename, MIME type, file size, checksum, storage
    key, uploader and timestamp.
-   Track statuses such as Awaiting, Processing, Ready, Uploaded and
    Delivered.
-   Record expected date, received date and delivered date if used.
-   Partner users can upload reports only for their own centre's orders.
-   Consultancy staff can review, manage and share reports according to
    permissions.
-   Use private object storage and short-lived authorized download
    links.
-   Validate allowed file types and sizes; scan uploads where feasible.
-   Audit report upload, replacement, download and sharing actions.
-   Reports should not be accessible merely because someone knows a URL.

### 6.12 Partner portal

Partner users can: - Sign in securely. - View only orders assigned to
their partner centre. - View minimum necessary patient and test
details. - Update permitted test statuses. - Mark tests completed and
record completion time. - Upload reports against the relevant test. -
View their own settlement statements and payment status. - View
permitted partner invoice/receipt details. - Manage partner users only
if they have Partner Admin permission.

Partner users cannot: - View other partner centres' data. - Browse the
consultancy's full patient directory. - View consultancy selling prices
or internal purchase margins. - View consultancy-wide collections,
profit or accounting reports. - Access unrelated patient documents.

### 6.13 Settlements and partner accounting

#### Model A -- Payable to partner

-   Only completed order items are eligible.
-   Generate partner settlement statements for a selected period.
-   Include eligible completed tests, agreed partner rates, adjustments
    and net payable.
-   Prevent the same eligible amount/item from being settled twice.
-   Support full and partial settlement payments.
-   Track payment method, transaction reference, date and bank/UTR
    reference.
-   Support approved debit/credit adjustments with reasons and audit
    history.

#### Model B -- Commission receivable from partner

-   Only completed order items are eligible for commission.
-   Calculate commission using the snapshotted percentage and configured
    calculation basis.
-   Generate partner-wise commission statements.
-   Track amount due, amount received and outstanding commission.
-   Record partner remittance and allocate it to commission statements.
-   Do not count direct patient-to-partner collections as consultancy
    cash or bank collections.

#### Settlement states

Suggested states: DRAFT, PENDING_APPROVAL (if approval is configured),
APPROVED, PARTIALLY_SETTLED, SETTLED, CANCELLED, REVERSED.

A posted settlement must not be silently edited. Corrections require
reversal/adjustment entries.

### 6.14 Financial reports and dashboard

Dashboard metrics should include: - Patient count. - Orders by status. -
Completed/pending tests. - Invoice value. - Cash collected. - Razorpay
collections by method. - Total successful collections. - Outstanding
patient balances. - Refunds. - Razorpay gateway fees. - Razorpay
settlements pending/reconciled. - Partner payables. - Partner commission
receivables. - Partner-wise completed tests and settlement balances. -
Date-range filters and export.

Reports: - Daily collection report by method and cashier. - Invoice
register. - Patient outstanding report. - Cashier shift/cash closing
report. - Razorpay transaction report. - Razorpay settlement
reconciliation report. - Refund report. - Partner payable statement. -
Partner commission receivable statement. - Completed test register. -
Partner performance report. - Patient/order history. - Profitability
report with clearly defined accounting basis.

Do not label gross difference as net profit unless expenses, taxes and
accounting adjustments are included.

### 6.15 GST and tax configuration

-   GST treatment must be configurable and confirmed by a qualified CA
    before production.
-   Do not hardcode GST rates or assume the consultancy and partner
    services have identical tax treatment.
-   Support configured GSTIN, registration details, HSN/SAC, place of
    supply, taxable value, CGST, SGST and IGST fields where applicable.
-   Preserve tax snapshots on issued invoices.
-   Different supplies (diagnostic service, consultancy/commission
    service, other fees) may require different treatment.
-   Maintain effective dates for tax codes/configuration.
-   Tax configuration is not a substitute for professional tax advice.

### 6.16 Notifications

-   WhatsApp and email notifications for invoices, receipts, payment
    confirmation, outstanding reminders and report-ready events.
-   Templates configurable by administrators.
-   Provider credentials stored securely.
-   Delivery status and failure reason logged where available.
-   Retry transient failures safely without duplicating payment or
    document actions.
-   Do not send sensitive report details in notification previews.

### 6.17 Audit and activity history

Audit: - Login and security-sensitive events. - Patient creation/update
and access to sensitive records. - Order creation, assignment, amendment
and cancellation. - Test status changes. - Invoice issue and
adjustments. - Payment creation, verification, refund and
reconciliation. - Razorpay webhook processing. - Report
upload/download/share. - Commission/pricing changes. - Settlement
creation, approval, payment and reversal. - User/role/permission
changes.

Audit records should be append-only for ordinary users and should
include actor, action, entity, timestamp, relevant before/after metadata
and source where appropriate. Avoid logging passwords, API secrets, full
payment credentials or unnecessary medical data.

## 7. UX/UI and visual design requirements

This is a mandatory product-wide requirement.

### 7.1 Design direction

The application must look like a mature, professionally designed
healthcare/business ERP, not a generic AI-generated dashboard.

-   User-friendly, professional, restrained and practical.
-   Desktop-first for reception, finance and admin workflows; responsive
    on tablet and mobile.
-   Clear information hierarchy and predictable navigation.
-   Fast workflows with minimal unnecessary clicks.
-   Dense information presented through readable tables and structured
    forms.
-   Consistent components and design tokens across admin and partner
    portals.

### 7.2 Avoid

-   Excessive rounded corners and pill-shaped controls.
-   Oversized rounded cards everywhere.
-   Unnecessary gradients, glow effects, glassmorphism and decorative
    blobs.
-   Flashy animations, parallax and distracting transitions.
-   Giant headings, excessive whitespace and decorative charts that do
    not support decisions.
-   Random icon styles, inconsistent spacing and arbitrary colors.
-   Generic AI-generated dashboard patterns.

### 7.3 Preferred design

-   White/light neutral backgrounds.
-   Restrained navy/blue primary color with accessible semantic
    success/warning/error colors.
-   Inter or another readable sans-serif.
-   Thin borders and minimal shadows.
-   Mostly square or subtly rounded corners (approximately 2--6px as a
    starting design token, not a rigid requirement).
-   Rectangular, clearly labelled buttons.
-   Consistent Lucide icon family.
-   Tables with search, filters, sorting, pagination and export.
-   Clear empty, loading, validation, success and error states.
-   Accessible contrast, keyboard navigation and visible focus states.
-   Responsive navigation and usable touch targets.

### 7.4 Key UX workflows

-   Receptionist can register/search a patient and create an order
    quickly.
-   Order form clearly separates partner selection, tests, prices and
    payment model.
-   Invoice page prominently shows total, paid, balance and payment
    history.
-   Split-payment entry is intuitive and validates total allocations.
-   UPI QR is easy to display at the counter.
-   Partner portal focuses on assigned orders, test progress and report
    uploads.
-   Financial tables support date/partner/status filters.
-   Destructive actions require confirmation.
-   Do not use a modal for every action; prefer context-appropriate
    pages/drawers.

## 8. Technical architecture

### 8.1 Recommended stack

-   Frontend and application server: latest stable Next.js with
    TypeScript.
-   Database: PostgreSQL.
-   ORM: Prisma.
-   UI: Tailwind CSS and shadcn/ui, customized to the design system
    above.
-   Validation: Zod.
-   Forms: React Hook Form where appropriate.
-   Authentication: Auth.js or a secure server-side session
    implementation.
-   PDF: a maintained server-side PDF generation library.
-   Excel exports: ExcelJS or equivalent.
-   File storage: private S3-compatible object storage.
-   Payments: Razorpay APIs and webhooks.
-   Notifications: approved WhatsApp Business provider and email
    provider.
-   Deployment: Ubuntu VPS, Nginx reverse proxy, process
    manager/container approach selected by implementation team.
-   Backups: automated encrypted PostgreSQL backups and restore testing.

Use a **modular monolith** initially. Do not introduce microservices for
the initial scale.

### 8.2 Suggested modules

-   auth
-   users-and-permissions
-   patients
-   test-catalogue
-   partners
-   partner-contracts-and-pricing
-   orders
-   billing-and-invoices
-   payments
-   razorpay-integration
-   receipts-and-refunds
-   documents-and-sharing
-   reports
-   settlements
-   accounting-and-reconciliation
-   notifications
-   audit
-   dashboard-and-reports
-   organization-settings

### 8.3 Suggested application routes

Admin: - `/admin/dashboard` - `/admin/patients` -
`/admin/patients/[id]` - `/admin/tests` - `/admin/packages` -
`/admin/partners` - `/admin/partners/[id]` - `/admin/orders` -
`/admin/orders/[id]` - `/admin/invoices` - `/admin/invoices/[id]` -
`/admin/payments` - `/admin/refunds` - `/admin/reports` -
`/admin/settlements` - `/admin/accounting` - `/admin/users` -
`/admin/settings`

Partner: - `/partner/dashboard` - `/partner/orders` -
`/partner/orders/[id]` - `/partner/reports` - `/partner/settlements` -
`/partner/users` - `/partner/profile`

Customer access: - Secure, expiring invoice/receipt/report links or
authenticated customer document pages. Do not expose internal admin
routes.

### 8.4 Suggested project structure

``` text
src/
  app/
    (auth)/
    admin/
    partner/
    api/
  components/
    ui/
    forms/
    tables/
    billing/
    payments/
    reports/
  modules/
    auth/
    patients/
    partners/
    tests/
    orders/
    billing/
    payments/
    razorpay/
    reports/
    settlements/
    accounting/
    notifications/
    audit/
  lib/
    db/
    auth/
    permissions/
    storage/
    validation/
    pdf/
    money/
  server/
    services/
    repositories/
    jobs/
  types/
prisma/
  schema.prisma
  migrations/
  seed.ts
tests/
  unit/
  integration/
  e2e/
```

The team may adapt the structure, but domain boundaries and separation
of UI, services, persistence and integrations must remain clear.

## 9. Database architecture -- logical model

Use UUID primary keys unless a justified exception exists. Use
`DECIMAL(14,2)` or suitable fixed-precision decimal types for money,
never floating-point types for financial values. Store timestamps
consistently (UTC in storage; display local timezone as configured).

### 9.1 Identity and access

-   `users`
-   `roles`
-   `permissions`
-   `user_roles`
-   `role_permissions`
-   `partner_users` (user-to-partner association and partner role)
-   `audit_logs`
-   Optional `sessions` if required by auth implementation

### 9.2 Organization and configuration

-   `organizations`
-   `organization_settings`
-   `invoice_sequences`
-   `tax_codes`
-   `tax_configurations`
-   `notification_templates`
-   `payment_gateway_settings` (store references/config metadata;
    secrets belong in secret manager/environment, not plaintext DB)

### 9.3 Patients

-   `patients`
-   Optional `patient_contacts` if multiple contacts are needed
-   Optional `patient_consents` for consent records and communication
    preferences

### 9.4 Partners and commercial terms

-   `partners`
-   `partner_contracts`
-   `partner_users`
-   `partner_test_prices`
-   Optional `partner_package_prices`
-   `partner_commission_rates`
-   `partner_test_capabilities` (optional, if validating which tests a
    centre performs)

### 9.5 Catalogue

-   `test_categories`
-   `tests`
-   `test_packages`
-   `test_package_items`

### 9.6 Orders

-   `diagnostic_orders`
-   `order_items`
-   Optional `order_status_history`
-   Optional `order_attachments`

Important `order_items` snapshots: - test name/code snapshot -
quantity - partner price snapshot - selling price snapshot - discount
snapshot - commission percentage and basis snapshot - computed
commission snapshot - tax code/rate snapshot where appropriate - status
and completion metadata

### 9.7 Invoices and documents

-   `invoices`
-   `invoice_items`
-   `invoice_tax_snapshots`
-   `invoice_documents`
-   `partner_invoice_references`
-   `invoice_share_logs`

For Model B, `partner_invoice_references` records partner-issued
invoice/receipt number, date, amount, receipt reference and optional
document storage key. Do not issue a consultancy patient invoice for the
partner's diagnostic service.

### 9.8 Payments

-   `patient_payments`
-   `payment_gateway_transactions`
-   `payment_qr_sessions`
-   `payment_webhook_events`
-   `payment_receipts`
-   `refunds`
-   `razorpay_settlements` or a provider-neutral `gateway_settlements`
-   `gateway_settlement_allocations`
-   `collection_records` for partner-direct collections in Model B, if
    the business wants to record them for commission reconciliation

A payment row represents one collection transaction/method. A single
invoice can have many payment rows. Keep gateway details in related
gateway transaction records. Do not put one column per payment method on
the invoice.

Suggested fields:

`patient_payments`: - id, invoice_id, amount, currency - payment_method
(CASH, UPI_QR, UPI_ONLINE, CARD, NETBANKING, BANK_TRANSFER, OTHER) -
payment_status (PENDING, SUCCESS, FAILED, CANCELLED, REFUNDED,
PARTIALLY_REFUNDED) - payment_date, collected_by, receipt_number,
external_reference, notes - created_at, updated_at

`payment_gateway_transactions`: - id, payment_id, gateway,
gateway_order_id, gateway_payment_id - gateway_method, gateway_status,
gateway_fee, gateway_fee_tax - raw_response (carefully
redacted/minimized), verified_at, created_at

`payment_qr_sessions`: - id, payment_id, invoice_id, gateway_qr_id,
amount - qr_image/storage reference, status, expires_at, created_at

`payment_webhook_events`: - id, gateway, event_id, event_type, payload
(redacted as appropriate) - signature_verified, processing_status,
processed_at, received_at - unique constraint on gateway + event_id
where supported

`refunds`: - id, payment_id, gateway_refund_id, amount, reason, status -
requested_by, processed_at, created_at

### 9.9 Reports and files

-   `report_tracking`
-   `report_files`
-   `file_attachments`
-   Optional `document_access_logs`

Reports are attached to individual order items. Store private storage
keys, not public permanent URLs.

### 9.10 Settlements and accounting

-   `settlements`
-   `settlement_items`
-   `partner_payments`
-   `payment_allocations`
-   `partner_adjustments`
-   `chart_of_accounts`
-   `journal_entries`
-   `journal_entry_lines`
-   `accounting_periods`
-   `bank_accounts`
-   `reconciliation_records`

Use explicit direction values such as `PAYABLE_TO_PARTNER` and
`RECEIVABLE_FROM_PARTNER`.

Prevent duplicate settlement eligibility/settlement. If partial
settlement or reversals are required, use allocation/ledger records
rather than creating duplicate settlement lines for the same completed
test without traceability.

### 9.11 Important database rules

-   Use foreign keys and appropriate indexes.
-   Unique patient code, order number, invoice number, receipt number
    and settlement number.
-   Index patient mobile, patient code, order number, invoice number,
    partner ID, statuses and date fields.
-   Use transactions for invoice issuance, payment posting, refunds,
    settlement creation and journal posting.
-   Derive invoice balance from a reliable payment/refund ledger or
    maintain a transactional cached balance with reconciliation checks.
-   Never trust a client-provided amount, partner ID, payment status or
    commission amount without server-side validation.
-   Historical snapshots preserve issued commercial terms.
-   Issued invoices and posted financial transactions are immutable;
    correct through credit/debit notes, reversals or adjustments.
-   Enforce partner data isolation in every server-side query and
    mutation.
-   Add idempotency keys for payment initiation and webhook processing.
-   Avoid cascading deletes for financial and patient history records.

## 10. Financial accounting and reconciliation

The system should support a basic auditable financial ledger. Final
chart of accounts and tax postings must be approved by the CA.

Illustrative Model A entries (accounting mapping to be finalized): -
Invoice: debit patient receivable; credit applicable revenue/tax
accounts. - Patient payment: debit cash/bank/gateway clearing; credit
patient receivable. - Completed partner service: debit partner service
cost; credit partner payable. - Partner payout: debit partner payable;
credit bank/cash.

Illustrative Model B entries: - Commission earned: debit partner
commission receivable; credit commission revenue/tax accounts as
advised. - Commission received: debit bank/gateway; credit commission
receivable. - Patient-to-partner direct payment is not consultancy
cash/bank collection.

Razorpay reconciliation must distinguish: 1. Customer payment success.
2. Razorpay fee and fee tax. 3. Razorpay settlement batch. 4. Actual
bank credit. 5. Refunds, chargebacks and adjustments.

A successful gateway payment is not automatically proof that the money
has reached the consultancy bank account.

## 11. Security, privacy and compliance

-   Enforce RBAC and partner-level row scoping server-side.
-   Use HTTPS everywhere.
-   Secure password hashing and session handling.
-   Protect against CSRF, XSS, SQL injection, IDOR and insecure direct
    object references.
-   Validate and authorize every file upload/download.
-   Use private file storage and expiring access links.
-   Encrypt backups and protect secrets.
-   Keep Razorpay secrets out of frontend bundles and source control.
-   Verify payment signatures and webhooks.
-   Use idempotency for payment and webhook flows.
-   Rate-limit authentication, payment initiation and public document
    endpoints.
-   Maintain audit logs.
-   Minimize patient data collection and retention.
-   Establish a retention/deletion policy with legal/CA guidance.
-   Do not claim legal or healthcare compliance merely because technical
    controls exist. Review applicable Indian privacy, data protection,
    tax and healthcare obligations with qualified professionals before
    production.

## 12. Non-functional requirements

-   Responsive and usable on modern desktop browsers, tablets and mobile
    devices.
-   Initial expected load: 50--200 patients/month and 5--20 partners.
-   Architecture should allow growth through indexing, query
    optimization and horizontal scaling later.
-   Paginate large tables; avoid loading all records.
-   Provide reliable error handling and operational logs.
-   No sensitive patient or payment credentials in logs.
-   Automated database backups; test restoration periodically.
-   Monitor application health, database availability, job failures and
    webhook processing.
-   Background jobs for notifications, exports and reconciliation tasks
    where appropriate.
-   Use database transactions for critical workflows.
-   Provide clear user feedback for long-running actions.
-   Define a target availability and recovery objective with the owner
    before production.

## 13. Acceptance criteria

The release is acceptable only when the following can be demonstrated:

### Patient and order

-   Staff can create and search patients.
-   Staff can create one order per partner with multiple tests.
-   Admin manually selects the partner.
-   A patient can have multiple partner orders.
-   Each test item has independent status.
-   Historical pricing/commission snapshots remain unchanged after
    catalogue updates.

### Billing

-   Model A creates one consultancy invoice per partner order.
-   Model B records partner invoice/receipt reference and does not issue
    a consultancy invoice for that diagnostic service.
-   Invoice PDF can be generated, downloaded and printed.
-   Invoice is shareable through configured WhatsApp/email workflow.
-   Original issued invoice remains immutable.
-   Payment receipts are distinct from invoices.

### Payments

-   Cash can be recorded manually.
-   Razorpay card, UPI and netbanking flows work for methods enabled on
    the merchant account.
-   Consultancy UPI QR can be generated/displayed if enabled for the
    account.
-   One invoice supports multiple payment transactions and mixed
    methods.
-   Example: ₹5,000 invoice can be paid ₹2,000 cash + ₹2,000 UPI +
    ₹1,000 card.
-   Partial payment updates outstanding balance correctly.
-   Failed/pending gateway attempts do not reduce outstanding balance.
-   Duplicate webhooks do not create duplicate collections.
-   Refunds are linked to original payments.
-   Razorpay payment and bank settlement are separately reconcilable.

### Reports and partner portal

-   Partner users see only their own orders.
-   Partner can update permitted test statuses and upload reports.
-   Reports are linked to the correct test item.
-   Private report links require authorization/expiry.
-   Consultancy staff can track and share reports.

### Settlements and finance

-   Only completed test items are eligible for settlement/commission.
-   Duplicate settlement of an item is prevented.
-   Model A partner payables are tracked.
-   Model B commission receivables are tracked.
-   Partial partner payments/remittances can be allocated.
-   Direct partner collections are not included in consultancy cash
    totals.
-   Financial changes are audited.

### UX/security

-   UI follows the professional, restrained design requirements.
-   Main workflows are usable on desktop and tablet.
-   Partner data isolation is tested at API/service level.
-   Sensitive actions are permission-protected.
-   Backup restoration is tested before production launch.

## 14. Delivery roadmap

### Phase 0 -- Business sign-off

Confirm: - Legal entity and invoice issuer details. - Model A/Model B
contract rules. - Commission calculation basis. - Refund and
cancellation rules. - Whether completion requires consultancy
approval. - GST treatment and invoice wording with CA. - Razorpay
products/QR eligibility, fees and settlement terms. - WhatsApp provider
and template requirements. - Report retention and access policy.

### Phase 1 -- Foundation

-   Project setup, design system and responsive shell.
-   Authentication, RBAC, partner scoping and audit framework.
-   Organization settings and user management.

### Phase 2 -- Master data

-   Patients.
-   Tests, categories and packages.
-   Partners, contracts, pricing and commission rates.

### Phase 3 -- Orders and billing

-   Order creation and manual partner assignment.
-   Test-level status management.
-   Model A invoice generation.
-   Model B partner invoice reference capture.
-   PDF invoice and receipt generation.

### Phase 4 -- Payments

-   Cash collection.
-   Split/multiple payment support.
-   Razorpay checkout.
-   Dynamic UPI QR if enabled.
-   Webhooks, verification, refunds and reconciliation.

### Phase 5 -- Partner portal and reports

-   Partner login and data isolation.
-   Test progress.
-   Manual report upload and delivery.
-   Secure document sharing.

### Phase 6 -- Settlements and reporting

-   Model A partner payable statements.
-   Model B commission receivable statements.
-   Partner payments and allocations.
-   Dashboards, exports and financial reports.

### Phase 7 -- Hardening and launch

-   Security testing.
-   Payment/webhook failure testing.
-   Backup and restore testing.
-   User acceptance testing.
-   Production deployment, monitoring and documentation.

## 15. Open decisions -- must not be silently assumed by the AI agent

The following require owner/CA/provider confirmation:

1.  Commission base: before/after discounts and whether taxes are
    excluded.
2.  Whether test completion requires consultancy approval before
    financial eligibility.
3.  Refund and cancellation rules, including partner deductions.
4.  Whether a patient may pay an invoice in excess and how advances are
    handled.
5.  Static QR fallback reconciliation process.
6.  Razorpay QR product availability and merchant account eligibility.
7.  Exact GST treatment for diagnostic services and consultancy
    commission.
8.  Invoice legal wording, numbering and credit/debit note process.
9.  WhatsApp provider and approved templates.
10. Data retention, consent and privacy policy.
11. Whether partner users can see patient mobile numbers or only masked
    contact details.
12. Whether settlement approval is mandatory or optional.

The implementation agent must create an assumptions register and ask the
product owner for decisions where these materially affect accounting,
legal treatment or irreversible workflow design. It must not invent
answers.

------------------------------------------------------------------------

## Appendix A -- Core data relationships

-   One patient → many diagnostic orders.
-   One partner → many diagnostic orders.
-   One diagnostic order → many order items.
-   One Model A diagnostic order → one consultancy invoice (unless an
    explicitly approved amendment/credit-note workflow applies).
-   One invoice → many invoice items.
-   One invoice → many patient payment transactions.
-   One payment transaction → zero or one gateway transaction (or
    multiple gateway events linked through gateway transaction/event
    records, as appropriate).
-   One payment → zero or many refund records.
-   One order item → report tracking and many report files/revisions.
-   One partner → many contracts, prices, commission rules, settlements
    and partner users.
-   One settlement → many settlement items.
-   One settlement → many payment allocations.
-   One audit log → actor and affected entity reference.

## Appendix B -- Design principle

The system is an operational healthcare-business ERP. Prioritize
correctness, traceability, ease of use and financial integrity over
decorative UI. Every screen should support a real task and expose only
the information required for that task.
