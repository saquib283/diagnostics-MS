"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client/api";
import {
  Button,
  FormField,
  Input,
  Panel,
  Select,
} from "@/components/ui/primitives";

export function ReconciliationWorkbenchClient({
  staticQrFallbackEnabled,
  openInvoices,
  csrfToken,
}: {
  staticQrFallbackEnabled: boolean;
  openInvoices: Array<{
    id: string;
    invoiceNumber: string;
    patientName: string;
    balanceDue: string;
  }>;
  csrfToken?: string;
}) {
  const router = useRouter();

  // Form 1: Static QR Manual UTR -> Invoice Reconciliation
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(
    openInvoices[0]?.id ?? "",
  );
  const [staticAmount, setStaticAmount] = useState(
    openInvoices[0]?.balanceDue ?? "",
  );
  const [staticUtr, setStaticUtr] = useState("");
  const [staticNotes, setStaticNotes] = useState("");

  // Form 2: Razorpay Settlement Batch -> Bank UTR Reconciliation
  const [gatewaySettlementId, setGatewaySettlementId] = useState("");
  const [bankUtr, setBankUtr] = useState("");
  const [grossAmount, setGrossAmount] = useState("");
  const [totalFee, setTotalFee] = useState("0.00");
  const [totalTax, setTotalTax] = useState("0.00");
  const [netBankCreditAmount, setNetBankCreditAmount] = useState("");

  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleStaticQrReconcile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    setBusy(true);
    try {
      const res = await apiRequest<{
        receipt: { receiptNumber: string };
        balanceDue: string;
      }>("/api/v1/reconciliation", {
        method: "POST",
        csrfToken,
        body: {
          invoiceId: selectedInvoiceId,
          amount: staticAmount,
          utrReference: staticUtr,
          notes: staticNotes || null,
        },
      });
      setStaticUtr("");
      setStaticNotes("");
      setFeedback(
        `Static QR UTR matched — Receipt ${res.receipt.receiptNumber} issued (Remaining due: ₹${res.balanceDue}).`,
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Static QR manual reconciliation failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleGatewayBatchReconcile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    setBusy(true);
    try {
      await apiRequest("/api/v1/reconciliation?kind=gateway-settlement", {
        method: "POST",
        csrfToken,
        body: {
          gatewaySettlementId,
          utrNumber: bankUtr,
          grossAmount,
          totalFee,
          totalTax,
          netBankCreditAmount,
        },
      });
      setGatewaySettlementId("");
      setBankUtr("");
      setGrossAmount("");
      setTotalFee("0.00");
      setTotalTax("0.00");
      setNetBankCreditAmount("");
      setFeedback(
        "Razorpay settlement batch reconciled against bank credit UTR and posted to General Ledger.",
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gateway settlement batch reconciliation failed.",
      );
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
        <Panel title="Accountant Queue — Static UPI QR Manual UTR Reconciliation">
          {!staticQrFallbackEnabled ? (
            <p className="text-xs text-[#475569] m-0">
              Static QR fallback reconciliation is currently disabled in{" "}
              <strong>Organization Settings</strong> (dynamic invoice-linked Razorpay UPI QR is preferred). Enable Static QR Fallback in Settings if emergency manual UTR matching is required.
            </p>
          ) : openInvoices.length === 0 ? (
            <p className="text-xs text-[#475569] m-0">
              No unpaid or partially paid Model A invoices awaiting reconciliation.
            </p>
          ) : (
            <form
              method="post"
              onSubmit={handleStaticQrReconcile}
              className="space-y-3"
            >
              <FormField id="rec-inv" label="Target Open Model A Invoice" required>
                <Select
                  id="rec-inv"
                  value={selectedInvoiceId}
                  onChange={(e) => {
                    setSelectedInvoiceId(e.target.value);
                    const found = openInvoices.find(
                      (x) => x.id === e.target.value,
                    );
                    if (found) setStaticAmount(found.balanceDue);
                  }}
                >
                  {openInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — {inv.patientName} (Due: ₹
                      {inv.balanceDue})
                    </option>
                  ))}
                </Select>
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
                <FormField id="rec-amt" label="Verified Bank Amount (₹)" required>
                  <Input
                    id="rec-amt"
                    required
                    inputMode="decimal"
                    value={staticAmount}
                    onChange={(e) => setStaticAmount(e.target.value)}
                  />
                </FormField>
                <FormField id="rec-utr" label="UPI / Bank UTR Reference" required>
                  <Input
                    id="rec-utr"
                    required
                    minLength={4}
                    spellCheck={false}
                    value={staticUtr}
                    onChange={(e) => setStaticUtr(e.target.value)}
                    placeholder="432918827712"
                  />
                </FormField>
              </div>

              <FormField id="rec-notes" label="Verification Note">
                <Input
                  id="rec-notes"
                  value={staticNotes}
                  onChange={(e) => setStaticNotes(e.target.value)}
                  placeholder="Verified against HDFC merchant statement"
                />
              </FormField>

              <Button type="submit" variant="secondary" isLoading={busy}>
                Match Static QR UTR & Issue Receipt
              </Button>
            </form>
          )}
        </Panel>

        <Panel title="Stage 4 — Razorpay Settlement Batch to Bank Credit UTR">
          <form
            method="post"
            onSubmit={handleGatewayBatchReconcile}
            className="space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
              <FormField
                id="gw-stl-id"
                label="Razorpay Settlement ID"
                required
              >
                <Input
                  id="gw-stl-id"
                  required
                  minLength={4}
                  spellCheck={false}
                  value={gatewaySettlementId}
                  onChange={(e) => setGatewaySettlementId(e.target.value)}
                  placeholder="setl_Pq8912Kx..."
                />
              </FormField>
              <FormField id="gw-bank-utr" label="Bank Credit UTR #" required>
                <Input
                  id="gw-bank-utr"
                  required
                  minLength={4}
                  spellCheck={false}
                  value={bankUtr}
                  onChange={(e) => setBankUtr(e.target.value)}
                  placeholder="AXISCN09188271"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 items-end">
              <FormField id="gw-gross" label="Gross Clearing (₹)" required>
                <Input
                  id="gw-gross"
                  required
                  inputMode="decimal"
                  value={grossAmount}
                  onChange={(e) => setGrossAmount(e.target.value)}
                  placeholder="2000.00"
                />
              </FormField>
              <FormField id="gw-fee" label="GW Fee (₹)" required>
                <Input
                  id="gw-fee"
                  required
                  inputMode="decimal"
                  value={totalFee}
                  onChange={(e) => setTotalFee(e.target.value)}
                />
              </FormField>
              <FormField id="gw-tax" label="Fee GST (₹)" required>
                <Input
                  id="gw-tax"
                  required
                  inputMode="decimal"
                  value={totalTax}
                  onChange={(e) => setTotalTax(e.target.value)}
                />
              </FormField>
              <FormField id="gw-net" label="Net Bank Credit (₹)" required>
                <Input
                  id="gw-net"
                  required
                  inputMode="decimal"
                  value={netBankCreditAmount}
                  onChange={(e) => setNetBankCreditAmount(e.target.value)}
                  placeholder="1952.80"
                />
              </FormField>
            </div>

            <Button type="submit" isLoading={busy}>
              Reconcile Gateway Batch to Bank Ledger
            </Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}

