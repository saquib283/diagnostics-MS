# WhatsApp Business & Email Provider Setup Guide — DCMS

## 1. Privacy & Clinical Data Protection Rules
- Ordinary WhatsApp and Email notifications **never** include diagnostic findings, test result values, or clinical notes.
- Messages transmit only neutral document metadata (e.g., Invoice number or *"Your diagnostic report is ready"*) paired with a short-lived, revocable SHA-256 token link (`/d/<token>`).
- When `WHATSAPP_PROVIDER="disabled"` or `EMAIL_PROVIDER="disabled"`, DCMS never fakes delivery — it records `PROVIDER_NOT_CONFIGURED` in `notification_logs` and `invoice_share_logs` while still allowing staff to copy the secure expiring link or download/print PDFs.

## 2. WhatsApp Business Cloud API Setup (OD-009)
1. Complete Meta Business Verification and register a dedicated WhatsApp Business phone number via Meta Cloud API (or your approved BSP).
2. Submit and obtain **Utility** template approval for:
   - `dcms_billing_document_link` — Body variables: `{{1}}` (Document Type: `INVOICE` / `RECEIPT` / `STATEMENT`), `{{2}}` (Secure expiring URL).
   - `dcms_report_ready_link` — Body variables: `{{1}}` (`REPORT`), `{{2}}` (Secure expiring URL).
3. Configure `.env`:
   ```env
   WHATSAPP_PROVIDER="meta_cloud"
   WHATSAPP_PHONE_NUMBER_ID="YOUR_META_PHONE_NUMBER_ID"
   WHATSAPP_ACCESS_TOKEN="YOUR_SYSTEM_USER_PERMANENT_TOKEN"
   WHATSAPP_API_BASE_URL="https://graph.facebook.com/v21.0"
   ```

## 3. Transactional Email (SMTP) Setup
1. Provision an authenticated transactional SMTP relay (e.g., AWS SES `ap-south-1`, Postmark, Resend SMTP, or Google Workspace SMTP relay) with SPF, DKIM, and DMARC configured on your domain.
2. Configure `.env`:
   ```env
   EMAIL_PROVIDER="smtp"
   SMTP_HOST="email-smtp.ap-south-1.amazonaws.com"
   SMTP_PORT="587"
   SMTP_SECURE="false"
   SMTP_USER="YOUR_SMTP_USERNAME"
   SMTP_PASSWORD="YOUR_SMTP_PASSWORD"
   EMAIL_FROM_ADDRESS="billing@your-consultancy.in"
   EMAIL_FROM_NAME="Your Consultancy Billing"
   ```

