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

export function PartnerPricingAndCommissionForms({
  partnerId,
  csrfToken,
  tests,
}: {
  partnerId: string;
  csrfToken?: string;
  tests: Array<{ id: string; code: string; name: string; defaultSellingPrice: string }>;
}) {
  const router = useRouter();
  const [priceTestId, setPriceTestId] = useState(tests[0]?.id ?? "");
  const [agreedPurchasePrice, setAgreedPurchasePrice] = useState("");
  const [priceFrom, setPriceFrom] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const [commTestId, setCommTestId] = useState("");
  const [commissionPercentage, setCommissionPercentage] = useState("15.00");
  const [calculationBasis, setCalculationBasis] = useState(
    "NET_AFTER_DISCOUNT_EXCL_TAX",
  );
  const [commFrom, setCommFrom] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleAddPrice(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiRequest(`/api/v1/partners/${partnerId}/prices`, {
        method: "POST",
        csrfToken,
        body: {
          testId: priceTestId,
          agreedPurchasePrice,
          effectiveFrom: priceFrom,
        },
      });
      setAgreedPurchasePrice("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save negotiated price.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddCommission(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiRequest(`/api/v1/partners/${partnerId}/commission-rates`, {
        method: "POST",
        csrfToken,
        body: {
          testId: commTestId || null,
          commissionPercentage,
          calculationBasis,
          effectiveFrom: commFrom,
        },
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save commission rate.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div role="alert" className="rounded-[4px] bg-[#FEE2E2] p-2.5 text-xs text-[#991B1B]">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Panel title="Set Model A Negotiated Purchase Price (Internal Only)">
          <form method="post" onSubmit={handleAddPrice} className="space-y-3">
            <FormField id="pp-test" label="Diagnostic Test" required>
              <Select
                id="pp-test"
                value={priceTestId}
                onChange={(e) => setPriceTestId(e.target.value)}
              >
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} — {t.name} (Default Sell ₹{t.defaultSellingPrice})
                  </option>
                ))}
              </Select>
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <FormField id="pp-rate" label="Negotiated Partner Rate (₹)" required>
                <Input
                  id="pp-rate"
                  required
                  inputMode="decimal"
                  value={agreedPurchasePrice}
                  onChange={(e) => setAgreedPurchasePrice(e.target.value)}
                  placeholder="1400.00"
                />
              </FormField>
              <FormField id="pp-from" label="Effective From" required>
                <Input
                  id="pp-from"
                  type="date"
                  required
                  value={priceFrom}
                  onChange={(e) => setPriceFrom(e.target.value)}
                />
              </FormField>
            </div>
            <Button type="submit" isLoading={busy}>
              Save Negotiated Rate
            </Button>
          </form>
        </Panel>

        <Panel title="Set Model B Percentage Commission Rule">
          <form method="post" onSubmit={handleAddCommission} className="space-y-3">
            <FormField id="cm-scope" label="Test Scope (Default or Test Override)">
              <Select
                id="cm-scope"
                value={commTestId}
                onChange={(e) => setCommTestId(e.target.value)}
              >
                <option value="">Partner-Wide Default (All Tests)</option>
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    Override: {t.code} — {t.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
              <FormField id="cm-pct" label="Commission (%)" required>
                <Input
                  id="cm-pct"
                  required
                  inputMode="decimal"
                  value={commissionPercentage}
                  onChange={(e) => setCommissionPercentage(e.target.value)}
                />
              </FormField>
              <FormField id="cm-basis" label="Calculation Basis" required>
                <Select
                  id="cm-basis"
                  value={calculationBasis}
                  onChange={(e) => setCalculationBasis(e.target.value)}
                >
                  <option value="NET_AFTER_DISCOUNT_EXCL_TAX">
                    Net Excl. Tax
                  </option>
                  <option value="GROSS_BEFORE_DISCOUNT_EXCL_TAX">
                    Gross Excl. Tax
                  </option>
                  <option value="NET_INCL_TAX">Net Incl. Tax</option>
                </Select>
              </FormField>
              <FormField id="cm-from" label="Effective From" required>
                <Input
                  id="cm-from"
                  type="date"
                  required
                  value={commFrom}
                  onChange={(e) => setCommFrom(e.target.value)}
                />
              </FormField>
            </div>
            <Button type="submit" isLoading={busy}>
              Save Commission Rule
            </Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}

export function PartnerContractAndStatusControls({
  partnerId,
  currentStatus,
  csrfToken,
}: {
  partnerId: string;
  currentStatus: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  csrfToken?: string;
}) {
  const router = useRouter();
  const [contractNumber, setContractNumber] = useState("");
  const [allowedModels, setAllowedModels] = useState("BOTH");
  const [commissionBasis, setCommissionBasis] = useState(
    "NET_AFTER_DISCOUNT_EXCL_TAX",
  );
  const [settlementCycle, setSettlementCycle] = useState("MONTHLY");
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleStatusChange(
    nextStatus: "ACTIVE" | "INACTIVE" | "SUSPENDED",
  ) {
    setError(null);
    setBusy(true);
    try {
      await apiRequest(`/api/v1/partners/${partnerId}`, {
        method: "PATCH",
        csrfToken,
        body: { status: nextStatus },
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateContract(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiRequest(`/api/v1/partners/${partnerId}/contracts`, {
        method: "POST",
        csrfToken,
        body: {
          contractNumber,
          allowedModels,
          commissionBasis,
          settlementCycle,
          effectiveFrom,
        },
      });
      setContractNumber("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save contract.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Partner Commercial Contract & Operational Status"
      actions={
        <div className="flex items-center gap-1.5">
          {(["ACTIVE", "INACTIVE", "SUSPENDED"] as const).map((st) => (
            <Button
              key={st}
              size="sm"
              variant={currentStatus === st ? "primary" : "secondary"}
              disabled={currentStatus === st}
              isLoading={busy}
              onClick={() => handleStatusChange(st)}
            >
              {st}
            </Button>
          ))}
        </div>
      }
    >
      {error ? (
        <div role="alert" className="mb-3 rounded-[4px] bg-[#FEE2E2] p-2 text-xs text-[#991B1B]">
          {error}
        </div>
      ) : null}

      <form
        method="post"
        onSubmit={handleCreateContract}
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3 items-end"
      >
        <FormField id="cnt-num" label="Contract Number" required>
          <Input
            id="cnt-num"
            required
            spellCheck={false}
            value={contractNumber}
            onChange={(e) => setContractNumber(e.target.value)}
            placeholder="CNT-2026-004"
          />
        </FormField>
        <FormField id="cnt-models" label="Permitted Models" required>
          <Select
            id="cnt-models"
            value={allowedModels}
            onChange={(e) => setAllowedModels(e.target.value)}
          >
            <option value="BOTH">Model A & Model B</option>
            <option value="MODEL_A_ONLY">Model A Only</option>
            <option value="MODEL_B_ONLY">Model B Only</option>
          </Select>
        </FormField>
        <FormField id="cnt-basis" label="Commission Basis">
          <Select
            id="cnt-basis"
            value={commissionBasis}
            onChange={(e) => setCommissionBasis(e.target.value)}
          >
            <option value="NET_AFTER_DISCOUNT_EXCL_TAX">Net Excl. Tax</option>
            <option value="GROSS_BEFORE_DISCOUNT_EXCL_TAX">
              Gross Excl. Tax
            </option>
            <option value="NET_INCL_TAX">Net Incl. Tax</option>
          </Select>
        </FormField>
        <FormField id="cnt-cycle" label="Settlement Cycle" required>
          <Select
            id="cnt-cycle"
            value={settlementCycle}
            onChange={(e) => setSettlementCycle(e.target.value)}
          >
            <option value="WEEKLY">Weekly</option>
            <option value="FORTNIGHTLY">Fortnightly</option>
            <option value="MONTHLY">Monthly</option>
          </Select>
        </FormField>
        <FormField id="cnt-start" label="Effective From" required>
          <Input
            id="cnt-start"
            type="date"
            required
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
        </FormField>
        <Button type="submit" variant="secondary" isLoading={busy}>
          Add Contract
        </Button>
      </form>
    </Panel>
  );
}

