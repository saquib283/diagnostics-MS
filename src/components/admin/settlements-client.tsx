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

export function SettlementGeneratorClient({
  csrfToken,
  partners,
}: {
  csrfToken?: string;
  partners: Array<{
    id: string;
    partnerCode: string;
    displayName: string;
    defaultPaymentModel: "MODEL_A_CONSULTANCY_COLLECTS" | "MODEL_B_PATIENT_PAYS_PARTNER";
  }>;
}) {
  const router = useRouter();
  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? "");
  const [commercialModel, setCommercialModel] = useState<
    "MODEL_A_CONSULTANCY_COLLECTS" | "MODEL_B_PATIENT_PAYS_PARTNER"
  >(partners[0]?.defaultPaymentModel ?? "MODEL_A_CONSULTANCY_COLLECTS");
  const [periodStart, setPeriodStart] = useState(
    `${new Date().toISOString().slice(0, 7)}-01`,
  );
  const [periodEnd, setPeriodEnd] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const created = await apiRequest<{ id: string }>("/api/v1/settlements", {
        method: "POST",
        csrfToken,
        idempotencyKey: newIdempotencyKey(),
        body: {
          partnerId,
          commercialModel,
          periodStart,
          periodEnd,
        },
      });
      router.push(`/admin/settlements/${created.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Settlement generation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Generate Partner Payable (Model A) or Commission Statement (Model B)">
      <form method="post" onSubmit={handleGenerate} className="space-y-3">
        {error ? (
          <div role="alert" className="rounded-[4px] bg-[#FEE2E2] p-2.5 text-xs text-[#991B1B]">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <FormField id="stl-partner" label="Partner Centre" required>
            <Select
              id="stl-partner"
              value={partnerId}
              onChange={(e) => {
                setPartnerId(e.target.value);
                const p = partners.find((x) => x.id === e.target.value);
                if (p) setCommercialModel(p.defaultPaymentModel);
              }}
            >
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName} ({p.partnerCode})
                </option>
              ))}
            </Select>
          </FormField>

          <FormField id="stl-model" label="Statement Model" required>
            <Select
              id="stl-model"
              value={commercialModel}
              onChange={(e) =>
                setCommercialModel(
                  e.target.value as
                    | "MODEL_A_CONSULTANCY_COLLECTS"
                    | "MODEL_B_PATIENT_PAYS_PARTNER",
                )
              }
            >
              <option value="MODEL_A_CONSULTANCY_COLLECTS">
                Model A — Payable to Partner
              </option>
              <option value="MODEL_B_PATIENT_PAYS_PARTNER">
                Model B — Commission Receivable
              </option>
            </Select>
          </FormField>

          <FormField id="stl-start" label="Completed From" required>
            <Input
              id="stl-start"
              type="date"
              required
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </FormField>

          <FormField id="stl-end" label="Completed Through" required>
            <Input
              id="stl-end"
              type="date"
              required
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </FormField>
        </div>

        <Button type="submit" isLoading={busy}>
          Lock Eligible Completed Items & Generate Statement
        </Button>
      </form>
    </Panel>
  );
}

export function SettlementDetailActionsClient({
  settlementId,
  status,
  balanceAmount,
  direction,
  canApprove,
  canPay,
  csrfToken,
}: {
  settlementId: string;
  status: string;
  balanceAmount: string;
  direction: "PAYABLE_TO_PARTNER" | "RECEIVABLE_FROM_PARTNER";
  canApprove: boolean;
  canPay: boolean;
  csrfToken?: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(balanceAmount);
  const [paymentMethod, setPaymentMethod] = useState("NEFT");
  const [utrOrReference, setUtrOrReference] = useState("");
  const [adjType, setAdjType] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [reversalReason, setReversalReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleApprove() {
    setError(null);
    setBusy(true);
    try {
      await apiRequest(`/api/v1/settlements/${settlementId}?action=approve`, {
        method: "POST",
        csrfToken,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAllocate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiRequest(`/api/v1/settlements/${settlementId}`, {
        method: "POST",
        csrfToken,
        body: { amount, paymentMethod, utrOrReference },
      });
      setUtrOrReference("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment allocation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddAdjustment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiRequest(
        `/api/v1/settlements/${settlementId}?action=adjustment`,
        {
          method: "POST",
          csrfToken,
          body: {
            adjustmentType: adjType,
            amount: adjAmount,
            reason: adjReason,
          },
        },
      );
      setAdjAmount("");
      setAdjReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adjustment failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReverse(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiRequest(`/api/v1/settlements/${settlementId}?action=reverse`, {
        method: "POST",
        csrfToken,
        body: { reason: reversalReason },
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reversal failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div role="alert" className="rounded-[4px] bg-[#FEE2E2] p-2.5 text-xs text-[#991B1B]">
          {error}
        </div>
      ) : null}

      {status === "PENDING_APPROVAL" && canApprove ? (
        <Panel title="Statement Approval Required">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[#334155] m-0">
              Verify eligible completed test items before authorizing payout or remittance allocation.
            </p>
            <Button onClick={handleApprove} isLoading={busy}>
              Approve Settlement Statement
            </Button>
          </div>
        </Panel>
      ) : null}

      {(status === "APPROVED" || status === "PARTIALLY_SETTLED") &&
      canPay &&
      Number(balanceAmount) > 0 ? (
        <Panel
          title={
            direction === "PAYABLE_TO_PARTNER"
              ? "Record Payout to Partner (Supports Partial / Full Allocation)"
              : "Record Commission Remittance Received from Partner"
          }
        >
          <form method="post" onSubmit={handleAllocate} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <FormField id="alloc-amt" label="Amount (₹)" required>
              <Input
                id="alloc-amt"
                required
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </FormField>
            <FormField id="alloc-mode" label="Bank / Payout Mode" required>
              <Select
                id="alloc-mode"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="IMPS">IMPS</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
              </Select>
            </FormField>
            <FormField id="alloc-utr" label="UTR / Bank Reference" required>
              <Input
                id="alloc-utr"
                required
                spellCheck={false}
                value={utrOrReference}
                onChange={(e) => setUtrOrReference(e.target.value)}
                placeholder="HDFCN520261124..."
              />
            </FormField>
            <Button type="submit" isLoading={busy}>
              Record & Allocate ₹{amount}
            </Button>
          </form>
        </Panel>
      ) : null}

      {canApprove &&
      status !== "SETTLED" &&
      status !== "REVERSED" &&
      status !== "CANCELLED" ? (
        <Panel title="Partner Credit / Debit Adjustment">
          <form
            method="post"
            onSubmit={handleAddAdjustment}
            className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
          >
            <FormField id="stl-adj-type" label="Adjustment Type">
              <Select
                id="stl-adj-type"
                value={adjType}
                onChange={(e) =>
                  setAdjType(e.target.value as "CREDIT" | "DEBIT")
                }
              >
                <option value="CREDIT">Credit (+ Increase Net Statement)</option>
                <option value="DEBIT">Debit (- Deduct from Net Statement)</option>
              </Select>
            </FormField>
            <FormField id="stl-adj-amt" label="Amount (₹)" required>
              <Input
                id="stl-adj-amt"
                required
                inputMode="decimal"
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
                placeholder="150.00"
              />
            </FormField>
            <FormField id="stl-adj-reason" label="Audit Reason" required>
              <Input
                id="stl-adj-reason"
                required
                minLength={5}
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value)}
                placeholder="Sample repeat consumable credit"
              />
            </FormField>
            <Button type="submit" variant="secondary" isLoading={busy}>
              Post Adjustment
            </Button>
          </form>
        </Panel>
      ) : null}

      {canApprove && status !== "REVERSED" && status !== "SETTLED" ? (
        <Panel title="Audited Statement Reversal (Unlocks Items for Re-Settlement)">
          <form method="post" onSubmit={handleReverse} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-60">
              <FormField id="rev-reason" label="Reversal Reason" required>
                <Input
                  id="rev-reason"
                  required
                  minLength={5}
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="Period cutoff correction"
                />
              </FormField>
            </div>
            <Button type="submit" variant="destructive" isLoading={busy}>
              Reverse Statement
            </Button>
          </form>
        </Panel>
      ) : null}
    </div>
  );
}

