# Razorpay Sandbox & Production Setup Guide — DCMS

## 1. Overview & Security Rules
- DCMS initiates all Razorpay Orders, Dynamic UPI QR Codes, and Refunds **exclusively on the server**.
- Never expose `RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET` in client code or `NEXT_PUBLIC_*` variables.
- Payments are marked `SUCCESS` only after cryptographic HMAC-SHA256 verification and authoritative server confirmation (never from browser redirect parameters alone).

## 2. Sandbox Configuration Steps
1. Sign in to the [Razorpay Dashboard](https://dashboard.razorpay.com) and switch to **Test Mode**.
2. Navigate to **Account & Settings → API Keys** and generate a Test Key pair (`rzp_test_...` and secret).
3. Populate `.env` on your server:
   ```env
   RAZORPAY_ENABLED="true"
   RAZORPAY_KEY_ID="rzp_test_YOUR_KEY_ID"
   RAZORPAY_KEY_SECRET="YOUR_TEST_KEY_SECRET"
   RAZORPAY_WEBHOOK_SECRET="YOUR_STRONG_WEBHOOK_SECRET"
   RAZORPAY_DYNAMIC_QR_ENABLED="true"
   RAZORPAY_QR_TTL_SECONDS="600"
   ```
4. **Configure Webhooks:**
   - In Razorpay Dashboard → **Account & Settings → Webhooks**, click **+ Add New Webhook**.
   - **Webhook URL:** `https://<your-domain>/api/v1/webhooks/razorpay` (for local sandbox testing, expose port `3000` via an authenticated tunnel such as Cloudflare Tunnel / ngrok).
   - **Secret:** Enter the exact value of `RAZORPAY_WEBHOOK_SECRET`.
   - **Active Events to Enable:**
     - `payment.captured`
     - `payment.failed`
     - `qr_code.credited`
     - `qr_code.closed`
     - `refund.processed`
     - `refund.failed`
     - `settlement.processed`

## 3. Dynamic UPI QR Eligibility Check (OD-006)
- Dynamic invoice-linked single-use QR uses `POST https://api.razorpay.com/v1/payments/qr_codes` (`type: "upi_qr"`, `usage: "single_use"`, `fixed_amount: true`).
- Confirm with Razorpay Support that **QR Codes API** is enabled on your live Merchant ID (MID) before switching `RAZORPAY_DYNAMIC_QR_ENABLED="true"` in production.
- If unavailable on your MID, keep `RAZORPAY_DYNAMIC_QR_ENABLED="false"` and only enable `staticQrFallbackEnabled` in `/admin/settings` if an Accountant reviews UTR credits via `POST /api/v1/reconciliation`.

## 4. Pre-Launch Sandbox Verification Checklist
- [ ] Split payment test: ₹5,000 invoice paid via ₹2,000 Cash + ₹2,000 Dynamic UPI QR + ₹1,000 Razorpay Card.
- [ ] Failed card attempt leaves invoice `balanceDue` unchanged.
- [ ] Replaying the same `x-razorpay-event-id` webhook returns `200 OK` with `IGNORED_DUPLICATE` and zero duplicate receipts.
- [ ] Tampered `x-razorpay-signature` returns `401` and does not mutate payment state.
- [ ] Partial refund updates `PatientPayment` to `PARTIALLY_REFUNDED` and recalculates `Invoice` net collected.
- [ ] Gateway settlement batch (`setl_...`) and bank credit UTR reconcile separately from customer payment capture.

