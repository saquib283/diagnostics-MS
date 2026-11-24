# UI/UX & Design System Specification — DCMS

**Document Status:** Design System Baseline v1.0  
**Surface Mode:** Operate Mode (Commercial Healthcare & Financial ERP)  
**Source of Truth:** [Diagnostic_Consultancy_Management_System_PRD.md](./Diagnostic_Consultancy_Management_System_PRD.md) (Section 7 & Appendix B)

---

## 1. Design Philosophy & Aesthetic Direction

DCMS is a high-trust operational workbench used by front-desk receptionists during live patient queues, accountants reconciling split payments and partner settlements, and lab partner staff updating test statuses and uploading diagnostic PDFs.

### 1.1 Core Principles
1. **Earned Familiarity & Quiet Precision:** Every screen prioritizes scannability, predictable placement, tabular alignment of monetary figures, and minimal click depth over visual novelty.
2. **Structure Encodes Meaning:** Thin `1px` borders, subtle neutral surface layering, and semantic status badges organize dense operational data. If an element does not help a staff member complete or verify a task, remove it.
3. **Context-Appropriate Surfaces over Modal Sprawl:** Multi-field workflows (Patient Registration + Order Creation, Settlement Review) live on structured full pages or slide-over drawers; native `<dialog>` modals are reserved strictly for focused confirmations, counter UPI QR display, and short atomic actions.
4. **Identical Craft Across Portals:** Both the Consultancy Admin Portal (`/admin/*`) and the Partner Diagnostic Centre Portal (`/partner/*`) share one unified token and component system, differentiated subtly by top-bar scope context so dual-hat administrators immediately know which portal they are viewing.

### 1.2 Explicit Bans (Anti-Patterns)
- **No** pill-shaped buttons, inputs, or cards (`border-radius: 9999px` is banned on interactive controls; badges use `2px–4px` crisp corners).
- **No** gradients, glassmorphism (`backdrop-filter: blur` decoration), neon glows, drop-shadow halos, or decorative background blobs.
- **No** ALL-CAPS tracked-out "eyebrow/kicker" text above headings or numbered decorative markers (`01 / 02 / 03`) on non-sequential blocks.
- **No** oversized SaaS hero-metric cards or decorative sparkline/donut charts that do not drive an operational decision.
- **No** unstyled browser defaults on scrollbars, focus outlines, text selection, or proportional numbers in financial columns.

---

## 2. Design Tokens

### 2.1 Color Palette (WCAG 2.2 AA Verified)

| Token Name | CSS Variable | Hex | Contrast on Surface | Role |
|---|---|---|---|---|
| **Canvas Background** | `--bg-canvas` | `#F8FAFC` | — | Primary app workspace canvas behind content panels |
| **Surface Primary** | `--bg-surface` | `#FFFFFF` | — | Tables, forms, invoice sheets, dialogs |
| **Surface Chrome** | `--bg-chrome` | `#F1F5F9` | — | Left navigation rail, table `<thead>`, summary footers |
| **Surface Hover / Active** | `--bg-subtle` | `#E2E8F0` | — | Row hover, selected nav item background |
| **Ink Primary** | `--ink-primary` | `#0F172A` | `17.4:1` on `#FFF` | Headings, primary table cells, monetary totals |
| **Ink Secondary** | `--ink-secondary` | `#334155` | `10.3:1` on `#FFF` | Form labels, secondary cells, descriptions |
| **Ink Muted** | `--ink-muted` | `#475569` | `7.5:1` on `#FFF` | Timestamps, helper hints, captions (exceeds 4.5:1 AA) |
| **Border Hairline** | `--border-subtle` | `#E2E8F0` | — | Table row dividers, panel borders |
| **Border Strong** | `--border-strong` | `#CBD5E1` | — | Panel headers, sticky column separators |
| **Border Control** | `--border-input` | `#64748B` | `4.7:1` on `#FFF` | Form input/select resting border (meets WCAG 1.4.11 ≥3:1) |
| **Primary Brand (Clinical Navy)** | `--brand-primary` | `#1B365D` | `11.8:1` with `#FFF` | Primary CTA buttons, active navigation indicator |
| **Primary Hover** | `--brand-hover` | `#122644` | `14.5:1` with `#FFF` | Primary button hover/active state |
| **Focus Ring** | `--focus-ring` | `#1D4ED8` | `6.7:1` on `#FFF` | `:focus-visible` `2px` solid outline (`outline-offset: 2px`) |
| **Success (Completed / Paid)** | `--status-success-fg` / `--status-success-bg` | `#166534` / `#DCFCE7` | `7.1:1` | `COMPLETED`, `PAID`, `SETTLED`, verified webhook |
| **Warning (Partial / Pending)** | `--status-warn-fg` / `--status-warn-bg` | `#92400E` / `#FEF3C7` | `6.8:1` | `PARTIALLY_PAID`, `IN_PROGRESS`, `PENDING_APPROVAL` |
| **Info (Confirmed / Active)** | `--status-info-fg` / `--status-info-bg` | `#075985` / `#E0F2FE` | `6.9:1` | `CONFIRMED`, `UPI_QR` active session, Model B badge |
| **Danger (Failed / Overdue)** | `--status-danger-fg` / `--status-danger-bg` | `#991B1B` / `#FEE2E2` | `7.4:1` | `FAILED`, `CANCELLED`, destructive actions, validation errors |

### 2.2 Typography System

- **Primary UI Font:** `Inter`, system-ui, -apple-system, sans-serif. One cohesive sans-serif carries headings, labels, controls, and prose.
- **Technical Identifier Font:** `JetBrains Mono`, ui-monospace, monospace — reserved **strictly** for machine identifiers (`PAT-2026-00001`, `ORD-2026-00042`, `INV-2026-00018`, Razorpay IDs, SHA-256 checksums, GSTINs).
- **Mandatory Numeric Alignment:** Every price, tax, percentage, balance, date, and count cell applies `font-variant-numeric: tabular-nums lining-nums` so decimal points align vertically down every column.
- **Fixed `rem` Scale (No Fluid `clamp()`):**

| Token | Size (`rem` / `px`) | Weight | Line Height | Usage |
|---|---|---|---|---|
| `text-page-title` | `1.375rem` (22px) | `600` | `1.3` | Page `<h1>` (single `<h1>` per document) |
| `text-section-title` | `1.0625rem` (17px) | `600` | `1.35` | Panel / section `<h2>`, `<dialog>` title |
| `text-subheading` | `0.9375rem` (15px) | `600` | `1.4` | Subsection `<h3>`, summary group header |
| `text-body` | `0.875rem` (14px) | `400` / `500` | `1.5` | Standard desktop UI labels, prose (max `70ch`), buttons |
| `text-input` | `max(1rem, 0.875rem)` | `400` | `1.4` | `16px` on mobile/coarse pointers (prevents iOS auto-zoom), `14px` on desktop (`@media (pointer: fine)`) |
| `text-table` | `0.8125rem` (13px) | `400` / `500` | `1.4` | Dense operational data table cells |
| `text-meta` | `0.75rem` (12px) | `500` | `1.35` | Status badges, audit timestamps, input helper hints |

### 2.3 Spacing, Border Radius & Elevation

- **Spacing Grid:** Base `4px` (`0.25rem`) unit.
  - Label-to-input gap: `4px` (`0.25rem`) vs Form-group-to-form-group gap: `16px–20px` (`1rem–1.25rem`) — enforcing Gestalt proximity.
  - Dense table cell padding: `8px 12px` (`0.5rem 0.75rem`); comfortable table cell padding: `10px 14px`.
  - Page container padding: `24px` desktop, `16px` tablet/mobile.
- **Border Radius Scale:**
  - `--radius-xs`: `2px` — status badges, code chips
  - `--radius-sm`: `4px` — buttons, inputs, selects, checkboxes
  - `--radius-md`: `6px` — panels, table wrappers, `<dialog>` modals, drawers
- **Shadows:**
  - Panels and cards in page flow: `box-shadow: none` (`1px solid var(--border-subtle)` only).
  - Sticky headers: `0 1px 2px rgba(15, 23, 42, 0.05)`.
  - Modal `<dialog>` / Popover menus: `0 10px 25px -5px rgba(15, 23, 42, 0.14), 0 4px 10px -4px rgba(15, 23, 42, 0.08)`.

---

## 3. Core Component Specifications

### 3.1 Buttons
- **Shape:** Rectangular (`border-radius: 4px`), font-weight `500`, horizontal padding `14px`, height `36px` desktop (`44px` minimum on `@media (pointer: coarse)`).
- **Variants:**
  - `primary`: `#1B365D` fill, `#FFFFFF` text. Action-oriented verbs ("Create Order", "Issue Invoice", "Record Cash Payment" — never generic "Submit").
  - `secondary`: `#FFFFFF` fill, `1px solid #CBD5E1`, `#0F172A` text, hover `#F8FAFC`.
  - `ghost`: Transparent fill, `#334155` text, hover `#F1F5F9` (table row actions, toolbar toggles).
  - `destructive`: `#991B1B` fill, `#FFFFFF` text — always paired with a confirmation `<dialog>` where **Cancel** holds initial `autofocus`.
- **States:** Every button implements `default`, `hover`, `:focus-visible`, `active`, `disabled` / `aria-disabled`, and `loading` (locks duplicate clicks post-submit while keeping label width stable).

### 3.2 Accessible Forms & Validation
- Wrap all mutations in `<form method="post">` and all table filter bars in `<search><form method="get">`.
- Explicit `<label htmlFor={id}>` stacked visually above every `<input>`, `<select>`, and `<textarea>`. Never rely on `placeholder` as a label.
- Identifiers (`email`, `patientCode`, `orderNumber`, `gstin`, `utr`) set `spellcheck={false}`, `autoCorrect="off"`, `autoCapitalize="none"`.
- Sign-in form uses `type="email" autoComplete="username" required` and `type="password" autoComplete="current-password" required` with an accessible `Show password` toggle (`type="button"`, `aria-pressed`) and allows password pasting.
- Mobile phone numbers use `type="tel"` (stored as strings preserving `+91` and leading zeros; never `type="number"`).
- **Selection Control Rule:** 2–5 mutually exclusive choices (e.g., Commercial Model: `Model A — Consultancy Collects` vs `Model B — Patient Pays Partner`; Gender) render as visible `<fieldset><legend>...</legend><input type="radio" /></fieldset>` for zero-click scanning; 6+ choices (e.g., Partner Centre, Test Category) use `<select>` or searchable combobox.
- **Validation Timing:** Validate on `blur` (after initial interaction) and on `submit`; clear field errors immediately on `input` once resolved; move focus to the first invalid control or error summary on failed submit; link error text via `aria-invalid="true"` and `aria-describedby`.

### 3.3 Operational Data Tables
- Semantic `<table>` with `<caption class="visually-hidden">`, `<thead>`, `<th scope="col">`, and `<th scope="row">` on the primary identifier column.
- Wrapped in `<div tabIndex={0} role="region" aria-labelledby={captionId} className="table-wrapper">` with `container-type: inline-size` and sticky `<thead>` (`position: sticky; inset-block-start: 0`).
- Right-align all monetary (`₹`) and numeric quantity columns (`text-right tabular-nums`); left-align text, names, and status badges.
- Below `@container (width < 640px)`, adapt cleanly to stacked record blocks with CSS variable column labels (`--col-label`) or horizontal sticky first-column scroll depending on workflow density.
- Built-in toolbar: `<search>` input, status/date/partner filter controls, total row count, page-size selector (`20 / 50 / 100`), pagination controls, and `Export Excel` button where permitted.
- **Loading & Empty States:** Render structural row skeletons while fetching; render actionable empty states ("No diagnostic orders match this filter — Clear filters or Create Order").

### 3.4 Status Badges
- Crisp `2px` radius, `1px` semantic border, `12px` medium text, paired with a `12px` `lucide-react` icon (`CheckCircle2`, `Clock`, `AlertTriangle`, `XCircle`, `Ban`) so color-blind users never rely on hue alone.
- **Critical Billing Rule:** An invoice with `paidAmount > 0 && balanceDue > 0` ALWAYS renders `PARTIALLY PAID` (amber warning badge + explicit `Due: ₹X,XXX.XX` callout) — never green or "Paid".

### 3.5 Dialogs & Drawers
- Confirmation modals and Counter UPI QR displays use the native HTML `<dialog>` element opened via `.showModal()`, inheriting browser top-layer promotion, `inert` background, `Esc` handling, and automatic focus restoration without fragile JS focus traps.
- Apply `overscroll-behavior: contain` on `dialog:modal` and `overflow: hidden; overscroll-behavior: contain` on `dialog::backdrop` (never `overflow: hidden` on `<body>`, avoiding layout scrollbar shift).

---

## 4. Layout & Workflow Wireframes

### 4.1 Consultancy Admin Shell & Counter Order + Split-Payment Flow

```text
+--------------------------------------------------------------------------------------------------+
| [DCMS] Apex Diagnostic Consultancy          [Search Patient / Order / Invoice...]  [Reception v] |
+----------------------+---------------------------------------------------------------------------+
| OVERVIEW             | Breadcrumb: Invoices / INV-2026-00104                                     |
|  Dashboard           |                                                                           |
| OPERATIONS           | Invoice INV-2026-00104  [PARTIALLY PAID]     [Download PDF] [Share] [Print]|
|  Patients            | Patient: Rajesh Sharma (PAT-2026-00089) | Partner: Metro Scans (Model A)  |
|  Diagnostic Orders   |---------------------------------------------------------------------------|
|  Invoices & Bills  < |  INVOICE TOTAL       AMOUNT COLLECTED      OUTSTANDING BALANCE            |
|  Payments & QR       |  ₹5,000.00           ₹4,000.00             ₹1,000.00 (Due)                |
|  Lab Reports         |---------------------------------------------------------------------------|
| CATALOGUE & PARTNERS | Line Items (Immutable Snapshot)                        | Record Payment   |
|  Tests & Packages    | # | Test Code | Description       | Status    | Amount | Method:          |
|  Partner Centres     | 1 | MRI-BRAIN | Brain MRI Plain   | Completed | 3,500  | (o) Cash         |
| FINANCE              | 2 | CBC-01    | Complete Blood Ct | In Prog   |   500  | ( ) UPI QR       |
|  Settlements         | 3 | LIPID-01  | Lipid Profile     | Pending   | 1,000  | ( ) Razorpay     |
|  Accounting & Recon  |--------------------------------------------------------| Amount (₹):      |
| ADMINISTRATION       | Payment Ledger (Split Transactions)                    | [ 1000.00      ] |
|  Users & Roles       | RCP-0201 | 24 Nov 10:12 | CASH   | SUCCESS | ₹2,000.00 | Ref / Notes:     |
|  Audit Trail         | RCP-0202 | 24 Nov 10:14 | UPI_QR | SUCCESS | ₹2,000.00 | [ Counter #1   ] |
|  Settings            | [Record Remaining ₹1,000.00]                           | [Record ₹1,000]  |
+----------------------+---------------------------------------------------------------------------+
```

### 4.2 Partner Diagnostic Centre Portal (`/partner/*`)

```text
+--------------------------------------------------------------------------------------------------+
| [PARTNER PORTAL] Metro Scans & Labs (PARTNER SCOPE ACTIVE)                   [Priya Nair - Lab v]|
+----------------------+---------------------------------------------------------------------------+
| MY CENTRE            | Assigned Diagnostic Orders                                                |
|  Today's Queue     < | [Search Order # / Patient Name]  [Status: All v]  [Date: Today v]         |
|  All Orders          |---------------------------------------------------------------------------|
|  Report Uploads      | Order #        | Patient       | Tests           | Item Progress | Action |
|  Settlements         | ORD-2026-00188 | Rajesh Sharma | MRI Brain, CBC  | 1/2 Completed | Open   |
|  Centre Users        |                | 42Y / Male    |                 |               |        |
|  Centre Profile      |---------------------------------------------------------------------------|
|                      | NOTE: Consultancy selling prices, discounts, and margins are never        |
|                      | transmitted to or rendered in this portal.                                |
+----------------------+---------------------------------------------------------------------------+
```

---

## 5. Responsive Breakpoints & Accessibility Rules

| Breakpoint | Width | Layout Adaptation |
|---|---|---|
| **Mobile** | `360px – 767px` | Left sidebar collapses into a `<dialog>` off-canvas navigation drawer; forms stack to 1 column; tables switch via `@container` to stacked record cards or sticky-first-column horizontal scroll; touch targets ≥ `44px–48px`. |
| **Tablet (Counter)** | `768px – 1023px` | Compact `64px` icon+tooltip rail (expandable) + full-width main workspace; split-payment composer stacks cleanly below invoice summary; counter UPI QR modal renders high-contrast `280px × 280px` scan target. |
| **Desktop** | `1024px – 1279px` | Persistent `232px` left navigation rail + fluid `<main>` workspace; 2-column master/summary splits on order and invoice pages. |
| **Wide ERP** | `1280px+` | Full multi-column data tables with sticky headers, inline status filters, and side-by-side payment/report action panels (`max-width: 1600px`). |

### Mandatory Accessibility Checklist
- `<html lang="en">` and unique front-loaded `<title>` on every route (`Invoices | DCMS`).
- Skip link (`<a href="#main-content" class="visually-hidden">Skip to main content</a>`) as the first focusable element, targeting `<h1 id="main-content" tabIndex={-1}>`.
- Landmarks: `<header>`, `<nav aria-label="Primary">`, single `<main>`, optional `<aside>`.
- Icon-only buttons always carry an explicit `aria-label` or `.visually-hidden` span; decorative Lucide SVGs always carry `aria-hidden="true"`.
- Respect `@media (prefers-reduced-motion: reduce)` globally by disabling non-essential transitions (`150ms` state transitions shorten to `0ms`).

