"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, newIdempotencyKey } from "@/lib/client/api";
import {
  Button,
  FormField,
  Input,
  Panel,
  Select,
} from "@/components/ui/primitives";

export function OrderDetailActionsClient({
  orderId,
  paymentModel,
  hasInvoice,
  netSellingTotal,
  csrfToken,
}: {
  orderId: string;
  paymentModel: "MODEL_A_CONSULTANCY_COLLECTS" | "MODEL_B_PATIENT_PAYS_PARTNER";
  hasInvoice: boolean;
  netSellingTotal: string;
  csrfToken?: string;
}) {
  const router = useRouter();
  const [partnerInvoiceNumber, setPartnerInvoiceNumber] = useState("");
  const [partnerReceiptNumber, setPartnerReceiptNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [netAmountPaidByPatient, setNetAmountPaidByPatient] =
    useState(netSellingTotal);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleIssueInvoice() {
    setError(null);
    setBusy(true);
    try {
      const inv = await apiRequest<{ id: string }>(
        `/api/v1/orders/${orderId}/invoice`,
        {
          method: "POST",
          csrfToken,
          idempotencyKey: newIdempotencyKey(),
        },
      );
      router.push(`/admin/invoices/${inv.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to issue invoice.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePartnerRef(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiRequest(`/api/v1/orders/${orderId}/partner-invoice-ref`, {
        method: "POST",
        csrfToken,
        body: {
          partnerInvoiceNumber,
          partnerReceiptNumber: partnerReceiptNumber || null,
          invoiceDate,
          grossAmount: netAmountPaidByPatient,
          discountAmount: "0.00",
          taxAmount: "0.00",
          netAmountPaidByPatient,
          paymentModeReported: "DIRECT_AT_PARTNER",
        },
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record partner reference.");
    } finally {
      setBusy(false);
    }
  }

  if (paymentModel === "MODEL_A_CONSULTANCY_COLLECTS" && !hasInvoice) {
    return (
      <div className="flex flex-col items-end gap-2">
        {error ? <p className="text-xs text-[#991B1B] m-0">{error}</p> : null}
        <Button onClick={handleIssueInvoice} isLoading={busy}>
          Issue Immutable Consultancy Invoice (Model A)
        </Button>
      </div>
    );
  }

  if (paymentModel === "MODEL_B_PATIENT_PAYS_PARTNER") {
    return (
      <Panel title="Model B — Record Partner Direct Invoice / Receipt Reference">
        <form method="post" onSubmit={handleSavePartnerRef} className="space-y-3">
          {error ? (
            <div role="alert" className="rounded-[4px] bg-[#FEE2E2] p-2 text-xs text-[#991B1B]">
              {error}
            </div>
          ) : null}
          <p className="text-xs text-[#475569] m-0">
            Consultancy does not issue a patient invoice for Model B diagnostic services. Direct partner collections are tracked separately and excluded from consultancy cash/bank totals.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <FormField id="pref-inv" label="Partner Invoice #" required>
              <Input
                id="pref-inv"
                required
                spellCheck={false}
                value={partnerInvoiceNumber}
                onChange={(e) => setPartnerInvoiceNumber(e.target.value)}
                placeholder="STAR-INV-8821"
              />
            </FormField>
            <FormField id="pref-rcp" label="Partner Receipt #">
              <Input
                id="pref-rcp"
                spellCheck={false}
                value={partnerReceiptNumber}
                onChange={(e) => setPartnerReceiptNumber(e.target.value)}
                placeholder="STAR-RCP-4410"
              />
            </FormField>
            <FormField id="pref-date" label="Collection Date" required>
              <Input
                id="pref-date"
                type="date"
                required
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </FormField>
            <FormField id="pref-amt" label="Patient Paid Partner (₹)" required>
              <Input
                id="pref-amt"
                required
                inputMode="decimal"
                value={netAmountPaidByPatient}
                onChange={(e) => setNetAmountPaidByPatient(e.target.value)}
              />
            </FormField>
          </div>
          <Button type="submit" variant="secondary" isLoading={busy}>
            Save Partner Invoice Reference
          </Button>
        </form>
      </Panel>
    );
  }

  return null;
}

export function OrderAmendAndCancelPanel({
  orderId,
  orderStatus,
  initialReferringDoctor,
  initialClinicalNotes,
  csrfToken,
}: {
  orderId: string;
  orderStatus: string;
  initialReferringDoctor?: string | null;
  initialClinicalNotes?: string | null;
  csrfToken?: string;
}) {
  const router = useRouter();
  const [referringDoctor, setReferringDoctor] = useState(
    initialReferringDoctor ?? "",
  );
  const [clinicalNotes, setClinicalNotes] = useState(
    initialClinicalNotes ?? "",
  );
  const [amendReason, setAmendReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleAmend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    setBusy(true);
    try {
      await apiRequest(`/api/v1/orders/${orderId}`, {
        method: "PATCH",
        csrfToken,
        body: {
          action: "AMEND_NOTES",
          referringDoctor: referringDoctor || null,
          clinicalNotes: clinicalNotes || null,
          reason: amendReason,
        },
      });
      setAmendReason("");
      setFeedback("Clinical notes / referring doctor amended and logged.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order amendment failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelOrder(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    setBusy(true);
    try {
      await apiRequest(`/api/v1/orders/${orderId}`, {
        method: "PATCH",
        csrfToken,
        body: {
          action: "CANCEL_ORDER",
          reason: cancelReason,
        },
      });
      setCancelReason("");
      setFeedback("Order cancelled and any unpaid invoice voided.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order cancellation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Order Amendment & Cancellation Governance">
      <div className="space-y-4">
        {feedback ? (
          <div
            role="status"
            className="rounded-[4px] border border-[#86EFAC] bg-[#DCFCE7] p-2 text-xs text-[#166534]"
          >
            {feedback}
          </div>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="rounded-[4px] border border-[#FCA5A5] bg-[#FEE2E2] p-2 text-xs text-[#991B1B]"
          >
            {error}
          </div>
        ) : null}

        <form method="post" onSubmit={handleAmend} className="space-y-2.5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <FormField id="ord-amend-doc" label="Referring Doctor">
              <Input
                id="ord-amend-doc"
                value={referringDoctor}
                onChange={(e) => setReferringDoctor(e.target.value)}
                placeholder="Dr. S. Kulkarni"
              />
            </FormField>
            <FormField id="ord-amend-notes" label="Clinical Notes">
              <Input
                id="ord-amend-notes"
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Fasting 10–12 hrs advised"
              />
            </FormField>
            <FormField id="ord-amend-reason" label="Audit Reason" required>
              <Input
                id="ord-amend-reason"
                required
                minLength={5}
                value={amendReason}
                onChange={(e) => setAmendReason(e.target.value)}
                placeholder="Updated physician referral details"
              />
            </FormField>
          </div>
          <Button type="submit" size="sm" variant="secondary" isLoading={busy}>
            Save Clinical Amendment
          </Button>
        </form>

        {orderStatus !== "CANCELLED" && orderStatus !== "COMPLETED" ? (
          <form
            method="post"
            onSubmit={handleCancelOrder}
            className="flex flex-wrap items-end gap-3 border-t border-[#E2E8F0] pt-3"
          >
            <div className="flex-1 min-w-60">
              <FormField
                id="ord-cancel-reason"
                label="Cancel Entire Order (Requires 0 Completed Items & ₹0 Net Collected)"
                required
              >
                <Input
                  id="ord-cancel-reason"
                  required
                  minLength={5}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Patient withdrew prior to sample collection"
                />
              </FormField>
            </div>
            <Button type="submit" size="sm" variant="destructive" isLoading={busy}>
              Cancel Order
            </Button>
          </form>
        ) : null}
      </div>
    </Panel>
  );
}

export function OrderItemRowControls({
  orderId,
  itemId,
  currentStatus,
  apiPrefix = "/api/v1/orders",
  canUploadReport = true,
  canApproveCompletion = false,
  isCompletionApproved = false,
  canShareReport = false,
  latestReportFileId = null,
  patientMobile,
  patientEmail,
  csrfToken,
}: {
  orderId: string;
  itemId: string;
  currentStatus: string;
  apiPrefix?: string;
  canUploadReport?: boolean;
  canApproveCompletion?: boolean;
  isCompletionApproved?: boolean;
  canShareReport?: boolean;
  latestReportFileId?: string | null;
  patientMobile?: string;
  patientEmail?: string | null;
  csrfToken?: string;
}) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [sharedReportUrl, setSharedReportUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const optionsMap: Record<string, string[]> = {
    PENDING: ["CONFIRMED", "IN_PROGRESS", "UNABLE_TO_PERFORM", "CANCELLED"],
    CONFIRMED: ["IN_PROGRESS", "COMPLETED", "UNABLE_TO_PERFORM", "CANCELLED"],
    IN_PROGRESS: ["COMPLETED", "UNABLE_TO_PERFORM", "CANCELLED"],
  };
  const allowed = (optionsMap[currentStatus] ?? []).filter(
    (s) => !(apiPrefix.includes("/partner/") && s === "CANCELLED"),
  );

  async function handleStatusUpdate() {
    if (!nextStatus) return;
    setError(null);
    setBusy(true);
    try {
      await apiRequest(`${apiPrefix}/${orderId}/items/${itemId}/status`, {
        method: "POST",
        csrfToken,
        body: { newStatus: nextStatus },
      });
      setNextStatus("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleApproveCompletion() {
    setError(null);
    setBusy(true);
    try {
      await apiRequest(
        `/api/v1/orders/${orderId}/items/${itemId}/approve-completion`,
        {
          method: "POST",
          csrfToken,
        },
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Completion approval failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleShareReport() {
    if (!latestReportFileId) return;
    setError(null);
    setBusy(true);
    try {
      const res = await apiRequest<{ shareUrl: string }>(
        `/api/v1/invoices/${latestReportFileId}/share`,
        {
          method: "POST",
          csrfToken,
          body: {
            resourceType: "REPORT",
            channel: "LINK_COPY",
            recipientMobile: patientMobile || null,
            recipientEmail: patientEmail || null,
          },
        },
      );
      setSharedReportUrl(res.shareUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report link share failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await apiRequest(`/api/v1/order-items/${itemId}/reports`, {
        method: "POST",
        csrfToken,
        body: fd,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report upload failed.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {allowed.length > 0 ? (
        <div className="flex items-center gap-1.5">
          <Select
            aria-label="Select next test status"
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value)}
            className="h-8 text-xs w-38"
          >
            <option value="">Update status...</option>
            {allowed.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            variant="secondary"
            disabled={!nextStatus}
            isLoading={busy}
            onClick={handleStatusUpdate}
          >
            Apply
          </Button>
        </div>
      ) : null}

      {canApproveCompletion && currentStatus === "COMPLETED" ? (
        isCompletionApproved ? (
          <span className="text-[11px] font-medium text-[#166534]">
            Completion Approved
          </span>
        ) : (
          <div>
            <Button
              size="sm"
              variant="secondary"
              isLoading={busy}
              onClick={handleApproveCompletion}
            >
              Approve Completion
            </Button>
          </div>
        )
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        {canUploadReport &&
        currentStatus !== "CANCELLED" &&
        currentStatus !== "UNABLE_TO_PERFORM" ? (
          <div>
            <label
              htmlFor={`upload-rep-${itemId}`}
              className="inline-flex h-7 items-center rounded-[4px] border border-[#CBD5E1] bg-[#F8FAFC] px-2 text-xs font-medium text-[#1B365D] hover:bg-[#E2E8F0] cursor-pointer"
            >
              Upload PDF/Image Report
            </label>
            <input
              id={`upload-rep-${itemId}`}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={handleFileUpload}
              className="visually-hidden"
            />
          </div>
        ) : null}

        {canShareReport && latestReportFileId ? (
          <Button
            size="sm"
            variant="ghost"
            isLoading={busy}
            onClick={handleShareReport}
          >
            Share Report Link
          </Button>
        ) : null}
      </div>

      {sharedReportUrl ? (
        <span className="rounded-[4px] bg-[#F1F5F9] px-1.5 py-1 text-[11px] font-mono-code break-all text-[#0F172A]">
          {sharedReportUrl}
        </span>
      ) : null}

      {error ? <span className="text-[11px] text-[#991B1B]">{error}</span> : null}
    </div>
  );
}

