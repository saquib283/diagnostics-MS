"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Printer, QrCode, Share2, Undo2 } from "lucide-react";
import { apiRequest, newIdempotencyKey } from "@/lib/client/api";
import { ModalDialog } from "@/components/ui/modal-dialog";
import {
  Button,
  FormField,
  Input,
  Panel,
  Select,
} from "@/components/ui/primitives";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

async function loadRazorpayCheckoutScript(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.Razorpay) return true;
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function PrintInvoiceButton() {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={() => {
        if (typeof window !== "undefined") {
          window.print();
        }
      }}
    >
      <Printer className="h-3.5 w-3.5" aria-hidden="true" />
      <span>Print View</span>
    </Button>
  );
}

export function RevokeShareLinkButton({
  tokenId,
  csrfToken,
}: {
  tokenId: string;
  csrfToken?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleRevoke() {
    setBusy(true);
    try {
      await apiRequest(`/api/v1/documents/shares/${tokenId}/revoke`, {
        method: "POST",
        csrfToken,
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="destructive"
      isLoading={busy}
      onClick={handleRevoke}
    >
      Revoke Link
    </Button>
  );
}

export function InvoiceSplitPaymentAndShareWorkbench({
  invoiceId,
  invoiceNumber,
  balanceDue,
  patientMobile,
  patientEmail,
  receipts = [],
  csrfToken,
}: {
  invoiceId: string;
  invoiceNumber: string;
  balanceDue: string;
  patientMobile: string;
  patientEmail?: string | null;
  receipts?: Array<{ id: string; receiptNumber: string; amount: string }>;
  csrfToken?: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(balanceDue);
  const [channelMode, setChannelMode] = useState<
    "CASH" | "BANK_TRANSFER" | "UPI_QR" | "RAZORPAY_CHECKOUT"
  >("CASH");
  const [externalReference, setExternalReference] = useState("");
  const [notes, setNotes] = useState("");

  // Dynamic QR Modal State
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [activeQr, setActiveQr] = useState<{
    id: string;
    qrImageUrl?: string | null;
    amount: string;
    expiresAt: string;
    status: string;
  } | null>(null);

  // Share State
  const [shareDocTarget, setShareDocTarget] = useState<string>("INVOICE");
  const [shareChannel, setShareChannel] = useState<"LINK_COPY" | "WHATSAPP" | "EMAIL">("LINK_COPY");
  const [shareRecipientMobile, setShareRecipientMobile] = useState(patientMobile);
  const [shareRecipientEmail, setShareRecipientEmail] = useState(patientEmail ?? "");
  const [generatedShareLink, setGeneratedShareLink] = useState<string | null>(null);

  // Credit/Debit Note Adjustment State
  const [adjType, setAdjType] = useState<"CREDIT_NOTE" | "DEBIT_NOTE">("CREDIT_NOTE");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");

  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hasDue = Number(balanceDue) > 0;

  async function handleCollectPayment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    setBusy(true);

    try {
      if (channelMode === "CASH" || channelMode === "BANK_TRANSFER") {
        const res = await apiRequest<{
          receipt: { receiptNumber: string };
          balanceDue: string;
        }>(`/api/v1/invoices/${invoiceId}/payments/manual`, {
          method: "POST",
          csrfToken,
          idempotencyKey: newIdempotencyKey(),
          body: {
            amount,
            paymentMethod: channelMode,
            externalReference: externalReference || null,
            notes: notes || null,
          },
        });
        setFeedback(
          `Payment recorded (${res.receipt.receiptNumber}). Remaining balance: ₹${res.balanceDue}`,
        );
        setAmount(res.balanceDue);
        setExternalReference("");
        router.refresh();
      } else if (channelMode === "UPI_QR") {
        const qr = await apiRequest<{
          id: string;
          qrImageUrl?: string | null;
          amount: string;
          expiresAt: string;
          status: string;
        }>(`/api/v1/invoices/${invoiceId}/payments/qr`, {
          method: "POST",
          csrfToken,
          idempotencyKey: newIdempotencyKey(),
          body: { amount },
        });
        setActiveQr(qr);
        setQrModalOpen(true);
      } else if (channelMode === "RAZORPAY_CHECKOUT") {
        const scriptReady = await loadRazorpayCheckoutScript();
        if (!scriptReady || !window.Razorpay) {
          throw new Error("Razorpay Checkout SDK could not be loaded.");
        }

        const orderInit = await apiRequest<{
          razorpayKeyId: string;
          razorpayOrderId: string;
          amountPaise: number;
          currency: string;
          patientName: string;
          patientMobile: string;
        }>(`/api/v1/invoices/${invoiceId}/payments/razorpay/order`, {
          method: "POST",
          csrfToken,
          idempotencyKey: newIdempotencyKey(),
          body: { amount, preferredMethod: "CARD" },
        });

        const rzp = new window.Razorpay({
          key: orderInit.razorpayKeyId,
          amount: orderInit.amountPaise,
          currency: orderInit.currency,
          name: "Diagnostic Consultancy",
          description: `Invoice ${invoiceNumber}`,
          order_id: orderInit.razorpayOrderId,
          prefill: {
            name: orderInit.patientName,
            contact: orderInit.patientMobile,
          },
          handler: async (resp: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            await apiRequest("/api/v1/payments/razorpay/verify", {
              method: "POST",
              csrfToken,
              body: {
                razorpayOrderId: resp.razorpay_order_id,
                razorpayPaymentId: resp.razorpay_payment_id,
                razorpaySignature: resp.razorpay_signature,
              },
            });
            setFeedback("Razorpay payment verified on server and receipt issued.");
            router.refresh();
          },
        });
        rzp.open();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment initiation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRefreshQrStatus() {
    if (!activeQr) return;
    try {
      const res = await apiRequest<{
        qrSession: { status: string };
        availability: string;
      }>(`/api/v1/payments/qr/${activeQr.id}`);
      setActiveQr((prev) =>
        prev ? { ...prev, status: res.qrSession.status } : null,
      );
      if (res.qrSession.status === "CREDITED") {
        setQrModalOpen(false);
        setFeedback("Dynamic UPI QR payment verified via webhook!");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check QR status.");
    }
  }

  async function handleCloseQr() {
    if (!activeQr) return;
    await apiRequest(`/api/v1/payments/qr/${activeQr.id}`, {
      method: "POST",
      csrfToken,
    });
    setQrModalOpen(false);
    setActiveQr(null);
    router.refresh();
  }

  async function handleShare(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const isReceiptShare = shareDocTarget.startsWith("RECEIPT:");
      const targetId = isReceiptShare
        ? shareDocTarget.slice("RECEIPT:".length)
        : invoiceId;
      const resourceType = isReceiptShare
        ? "RECEIPT"
        : (shareDocTarget as "INVOICE" | "STATEMENT");

      const res = await apiRequest<{
        shareUrl: string;
        deliveryStatus: string;
        errorMessage?: string | null;
      }>(`/api/v1/invoices/${targetId}/share`, {
        method: "POST",
        csrfToken,
        body: {
          resourceType,
          channel: shareChannel,
          recipientMobile: shareRecipientMobile || null,
          recipientEmail: shareRecipientEmail || null,
        },
      });
      setGeneratedShareLink(res.shareUrl);
      setFeedback(
        `Secure link generated (${res.deliveryStatus})${res.errorMessage ? ` — ${res.errorMessage}` : ""}`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sharing failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleIssueAdjustment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiRequest(`/api/v1/invoices/${invoiceId}/adjustments`, {
        method: "POST",
        csrfToken,
        body: {
          noteType: adjType,
          taxableDelta: adjAmount,
          taxDelta: "0.00",
          reason: adjReason,
        },
      });
      setAdjAmount("");
      setAdjReason("");
      setFeedback(`${adjType.replace("_", " ")} issued without mutating original invoice.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adjustment failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {feedback ? (
        <div
          role="status"
          className="rounded-[4px] border border-[#86EFAC] bg-[#DCFCE7] p-2.5 text-xs font-medium text-[#166534]"
        >
          {feedback}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-[4px] border border-[#FCA5A5] bg-[#FEE2E2] p-2.5 text-xs font-medium text-[#991B1B]"
        >
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Panel title="Collect Payment (Supports Split / Multi-Session Payments)">
          {hasDue ? (
            <form method="post" onSubmit={handleCollectPayment} className="space-y-3">
              <fieldset className="rounded-[4px] border border-[#CBD5E1] p-2.5 m-0">
                <legend className="px-1 text-xs font-semibold text-[#0F172A]">
                  Payment Method *
                </legend>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: "CASH", label: "Cash (Counter)" },
                    { id: "UPI_QR", label: "Dynamic UPI QR" },
                    { id: "RAZORPAY_CHECKOUT", label: "Razorpay (Card/UPI/NB)" },
                    { id: "BANK_TRANSFER", label: "Bank Transfer / NEFT" },
                  ].map((opt) => (
                    <span key={opt.id} className="inline-flex items-center gap-1.5">
                      <input
                        id={`pay-mode-${opt.id}`}
                        type="radio"
                        name="channelMode"
                        checked={channelMode === opt.id}
                        onChange={() =>
                          setChannelMode(opt.id as typeof channelMode)
                        }
                        className="accent-[#1B365D]"
                      />
                      <label htmlFor={`pay-mode-${opt.id}`}>{opt.label}</label>
                    </span>
                  ))}
                </div>
              </fieldset>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <FormField
                  id="split-pay-amount"
                  label="Collection Amount (₹)"
                  required
                  hint={`Max permitted: ₹${balanceDue}`}
                >
                  <Input
                    id="split-pay-amount"
                    required
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </FormField>

                <FormField id="split-pay-ref" label="Counter / Bank Reference">
                  <Input
                    id="split-pay-ref"
                    spellCheck={false}
                    value={externalReference}
                    onChange={(e) => setExternalReference(e.target.value)}
                    placeholder="Cashier drawer / UTR"
                  />
                </FormField>
              </div>

              <FormField id="split-pay-notes" label="Notes (Optional)">
                <Input
                  id="split-pay-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Part 1 of split payment"
                />
              </FormField>

              <Button type="submit" isLoading={busy}>
                {channelMode === "UPI_QR" ? (
                  <QrCode className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <CreditCard className="h-4 w-4" aria-hidden="true" />
                )}
                <span>
                  {channelMode === "UPI_QR"
                    ? `Generate Counter UPI QR for ₹${amount}`
                    : channelMode === "RAZORPAY_CHECKOUT"
                      ? `Open Razorpay Checkout for ₹${amount}`
                      : `Record ₹${amount} Collection`}
                </span>
              </Button>
            </form>
          ) : (
            <p className="text-xs text-[#166534] font-medium m-0">
              This invoice has ₹0.00 balance due. Overpayments are blocked by policy.
            </p>
          )}
        </Panel>

        <Panel title="Secure Customer Sharing & Credit/Debit Adjustments">
          <form method="post" onSubmit={handleShare} className="space-y-3 border-b border-[#E2E8F0] pb-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <FormField id="share-doc-type" label="Document to Share">
                <Select
                  id="share-doc-type"
                  value={shareDocTarget}
                  onChange={(e) => setShareDocTarget(e.target.value)}
                >
                  <option value="INVOICE">Original Issued Invoice PDF</option>
                  <option value="STATEMENT">Updated Account Statement PDF</option>
                  {receipts.map((rcp) => (
                    <option key={rcp.id} value={`RECEIPT:${rcp.id}`}>
                      Receipt {rcp.receiptNumber} (₹{rcp.amount})
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField id="share-chan" label="Share Channel">
                <Select
                  id="share-chan"
                  value={shareChannel}
                  onChange={(e) =>
                    setShareChannel(
                      e.target.value as "LINK_COPY" | "WHATSAPP" | "EMAIL",
                    )
                  }
                >
                  <option value="LINK_COPY">Generate Secure Expiring Link</option>
                  <option value="WHATSAPP">WhatsApp Business Template</option>
                  <option value="EMAIL">Transactional Email</option>
                </Select>
              </FormField>
            </div>

            {shareChannel === "WHATSAPP" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
                <FormField id="share-mob" label="WhatsApp Mobile" required>
                  <Input
                    id="share-mob"
                    type="tel"
                    required
                    value={shareRecipientMobile}
                    onChange={(e) => setShareRecipientMobile(e.target.value)}
                  />
                </FormField>
                <Button type="submit" variant="secondary" isLoading={busy}>
                  <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Share Document</span>
                </Button>
              </div>
            ) : shareChannel === "EMAIL" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
                <FormField id="share-em" label="Patient Email" required>
                  <Input
                    id="share-em"
                    type="email"
                    required
                    value={shareRecipientEmail}
                    onChange={(e) => setShareRecipientEmail(e.target.value)}
                  />
                </FormField>
                <Button type="submit" variant="secondary" isLoading={busy}>
                  <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Share Document</span>
                </Button>
              </div>
            ) : (
              <div>
                <Button type="submit" variant="secondary" isLoading={busy}>
                  <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Share Document</span>
                </Button>
              </div>
            )}

            {generatedShareLink ? (
              <div className="rounded-[4px] bg-[#F1F5F9] p-2 text-xs break-all font-mono-code">
                {generatedShareLink}
              </div>
            ) : null}
          </form>

          <form method="post" onSubmit={handleIssueAdjustment} className="space-y-2.5">
            <p className="text-xs font-semibold text-[#0F172A] m-0">
              Immutable Invoice Correction (Credit / Debit Note)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
              <FormField id="adj-type" label="Note Type">
                <Select
                  id="adj-type"
                  value={adjType}
                  onChange={(e) =>
                    setAdjType(e.target.value as "CREDIT_NOTE" | "DEBIT_NOTE")
                  }
                >
                  <option value="CREDIT_NOTE">Credit Note (-)</option>
                  <option value="DEBIT_NOTE">Debit Note (+)</option>
                </Select>
              </FormField>
              <FormField id="adj-amt" label="Amount Delta (₹)" required>
                <Input
                  id="adj-amt"
                  required
                  inputMode="decimal"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  placeholder="250.00"
                />
              </FormField>
              <FormField id="adj-reason" label="Audit Reason" required>
                <Input
                  id="adj-reason"
                  required
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="Cancelled sub-test credit"
                />
              </FormField>
            </div>
            <Button type="submit" variant="secondary" size="sm" isLoading={busy}>
              Issue Adjustment Note
            </Button>
          </form>
        </Panel>
      </div>

      <ModalDialog
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title={`Counter Dynamic UPI QR — ₹${activeQr?.amount ?? amount}`}
      >
        {activeQr ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-xs text-[#334155] m-0">
              Single-use fixed-amount QR linked to <strong>{invoiceNumber}</strong>. Invoice updates only after server-verified Razorpay webhook.
            </p>
            {activeQr.qrImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeQr.qrImageUrl}
                alt={`Razorpay UPI QR code for INR ${activeQr.amount}`}
                className="h-64 w-64 border border-[#CBD5E1] rounded-[4px]"
              />
            ) : null}
            <p className="text-xs text-[#475569] tabular-nums m-0">
              Expires: {activeQr.expiresAt} · Status: {activeQr.status}
            </p>
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" onClick={handleRefreshQrStatus}>
                Check Verification Status
              </Button>
              <Button variant="destructive" onClick={handleCloseQr}>
                Close / Cancel QR
              </Button>
            </div>
          </div>
        ) : null}
      </ModalDialog>
    </div>
  );
}

export function PaymentRefundRowAction({
  paymentId,
  maxRefundable,
  isGateway,
  csrfToken,
}: {
  paymentId: string;
  maxRefundable: string;
  isGateway: boolean;
  csrfToken?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(maxRefundable);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleConfirmRefund(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiRequest(`/api/v1/payments/${paymentId}/refunds`, {
        method: "POST",
        csrfToken,
        idempotencyKey: newIdempotencyKey(),
        body: {
          amount,
          refundMethod: isGateway ? "GATEWAY_REVERSAL" : "CASH",
          reason,
        },
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refund failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Refund</span>
      </Button>

      <ModalDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Confirm Payment Refund"
      >
        <form method="post" onSubmit={handleConfirmRefund} className="space-y-3">
          {error ? (
            <div role="alert" className="rounded-[4px] bg-[#FEE2E2] p-2 text-xs text-[#991B1B]">
              {error}
            </div>
          ) : null}
          <FormField
            id={`rfd-amt-${paymentId}`}
            label="Refund Amount (₹)"
            required
            hint={`Maximum refundable against this payment: ₹${maxRefundable}`}
          >
            <Input
              id={`rfd-amt-${paymentId}`}
              required
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </FormField>
          <FormField id={`rfd-reason-${paymentId}`} label="Refund Reason" required>
            <Input
              id={`rfd-reason-${paymentId}`}
              required
              minLength={5}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Patient cancelled test prior to sample collection"
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              autoFocus
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" isLoading={busy}>
              Process Refund of ₹{amount}
            </Button>
          </div>
        </form>
      </ModalDialog>
    </>
  );
}

