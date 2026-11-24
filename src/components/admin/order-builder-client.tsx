"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/client/api";
import {
  Button,
  FormField,
  Input,
  Panel,
  Select,
  Textarea,
} from "@/components/ui/primitives";

interface LineDraft {
  key: string;
  kind: "TEST" | "PACKAGE";
  targetId: string;
  quantity: number;
  discountAmount: string;
}

export function OrderBuilderForm({
  csrfToken,
  preselectedPatientId,
  patients,
  partners,
  tests,
  packages,
}: {
  csrfToken?: string;
  preselectedPatientId?: string;
  patients: Array<{ id: string; patientCode: string; fullName: string; mobile: string }>;
  partners: Array<{
    id: string;
    partnerCode: string;
    displayName: string;
    defaultPaymentModel: "MODEL_A_CONSULTANCY_COLLECTS" | "MODEL_B_PATIENT_PAYS_PARTNER";
  }>;
  tests: Array<{ id: string; code: string; name: string; defaultSellingPrice: string }>;
  packages: Array<{ id: string; code: string; name: string; defaultSellingPrice: string }>;
}) {
  const router = useRouter();
  const [patientId, setPatientId] = useState(
    preselectedPatientId ?? patients[0]?.id ?? "",
  );
  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? "");
  const [paymentModel, setPaymentModel] = useState<
    "MODEL_A_CONSULTANCY_COLLECTS" | "MODEL_B_PATIENT_PAYS_PARTNER"
  >(partners[0]?.defaultPaymentModel ?? "MODEL_A_CONSULTANCY_COLLECTS");
  const [referringDoctor, setReferringDoctor] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([
    {
      key: "line-1",
      kind: "TEST",
      targetId: tests[0]?.id ?? "",
      quantity: 1,
      discountAmount: "0.00",
    },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function handlePartnerChange(nextId: string) {
    setPartnerId(nextId);
    const found = partners.find((p) => p.id === nextId);
    if (found) {
      setPaymentModel(found.defaultPaymentModel);
    }
  }

  function addLine(kind: "TEST" | "PACKAGE") {
    const defaultId =
      kind === "TEST" ? (tests[0]?.id ?? "") : (packages[0]?.id ?? "");
    setLines((prev) => [
      ...prev,
      {
        key: `line-${Date.now()}-${Math.random()}`,
        kind,
        targetId: defaultId,
        quantity: 1,
        discountAmount: "0.00",
      },
    ]);
  }

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const created = await apiRequest<{ id: string }>("/api/v1/orders", {
        method: "POST",
        csrfToken,
        body: {
          patientId,
          partnerId,
          paymentModel,
          referringDoctor: referringDoctor || null,
          clinicalNotes: clinicalNotes || null,
          items: lines.map((line) => ({
            testId: line.kind === "TEST" ? line.targetId : null,
            packageId: line.kind === "PACKAGE" ? line.targetId : null,
            quantity: line.quantity,
            discountAmount: line.discountAmount || "0.00",
          })),
        },
      });
      router.push(`/admin/orders/${created.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order creation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form method="post" onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <div
          role="alert"
          className="rounded-[4px] border border-[#FCA5A5] bg-[#FEE2E2] p-3 text-xs font-medium text-[#991B1B]"
        >
          {error}
        </div>
      ) : null}

      <Panel title="1. Patient, Partner Centre & Commercial Model">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <FormField id="ord-patient" label="Patient" required>
            <Select
              id="ord-patient"
              required
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} ({p.patientCode}) — {p.mobile}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            id="ord-partner"
            label="Assigned Partner Diagnostic Centre (Manual Selection)"
            required
            hint="One order per partner centre. Create separate orders for multi-centre visits."
          >
            <Select
              id="ord-partner"
              required
              value={partnerId}
              onChange={(e) => handlePartnerChange(e.target.value)}
            >
              {partners.map((prt) => (
                <option key={prt.id} value={prt.id}>
                  {prt.displayName} ({prt.partnerCode})
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <fieldset className="mt-4 rounded-[4px] border border-[#CBD5E1] p-3 m-0">
          <legend className="px-1 text-xs font-semibold text-[#0F172A]">
            Commercial & Collection Model *
          </legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="flex items-start gap-2">
              <input
                id="model-a"
                type="radio"
                name="paymentModel"
                checked={paymentModel === "MODEL_A_CONSULTANCY_COLLECTS"}
                onChange={() =>
                  setPaymentModel("MODEL_A_CONSULTANCY_COLLECTS")
                }
                className="mt-0.5 accent-[#1B365D]"
              />
              <label htmlFor="model-a" className="cursor-pointer">
                <strong className="font-semibold text-[#0F172A]">
                  Model A — Consultancy Collects from Patient
                </strong>
                <span className="block text-[#475569]">
                  Consultancy issues patient invoice, collects split/online/cash payments, and settles partner payable on completed tests.
                </span>
              </label>
            </div>

            <div className="flex items-start gap-2">
              <input
                id="model-b"
                type="radio"
                name="paymentModel"
                checked={paymentModel === "MODEL_B_PATIENT_PAYS_PARTNER"}
                onChange={() =>
                  setPaymentModel("MODEL_B_PATIENT_PAYS_PARTNER")
                }
                className="mt-0.5 accent-[#1B365D]"
              />
              <label htmlFor="model-b" className="cursor-pointer">
                <strong className="font-semibold text-[#0F172A]">
                  Model B — Patient Pays Partner Directly
                </strong>
                <span className="block text-[#475569]">
                  No consultancy patient invoice issued. Record partner invoice/receipt ref; consultancy earns % commission on completed tests.
                </span>
              </label>
            </div>
          </div>
        </fieldset>
      </Panel>

      <Panel
        title="2. Diagnostic Tests & Packages"
        actions={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => addLine("TEST")}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Add Test</span>
            </Button>
            {packages.length > 0 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => addLine("PACKAGE")}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Add Package</span>
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="space-y-3">
          {lines.map((line, index) => (
            <div
              key={line.key}
              className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end border-b border-[#E2E8F0] pb-3 last:border-b-0 last:pb-0"
            >
              <div className="md:col-span-6">
                <FormField
                  id={`line-target-${index}`}
                  label={`${line.kind === "PACKAGE" ? "Package" : "Diagnostic Test"} #${index + 1}`}
                  required
                >
                  <Select
                    id={`line-target-${index}`}
                    value={line.targetId}
                    onChange={(e) =>
                      updateLine(line.key, { targetId: e.target.value })
                    }
                  >
                    {line.kind === "TEST"
                      ? tests.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.code} — {t.name} (₹{t.defaultSellingPrice})
                          </option>
                        ))
                      : packages.map((pkg) => (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.code} — {pkg.name} (₹{pkg.defaultSellingPrice})
                          </option>
                        ))}
                  </Select>
                </FormField>
              </div>

              <div className="md:col-span-2">
                <FormField id={`line-qty-${index}`} label="Quantity" required>
                  <Input
                    id={`line-qty-${index}`}
                    type="number"
                    min={1}
                    max={20}
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(line.key, {
                        quantity: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                  />
                </FormField>
              </div>

              <div className="md:col-span-3">
                <FormField id={`line-disc-${index}`} label="Discount (₹)">
                  <Input
                    id={`line-disc-${index}`}
                    inputMode="decimal"
                    value={line.discountAmount}
                    onChange={(e) =>
                      updateLine(line.key, { discountAmount: e.target.value })
                    }
                  />
                </FormField>
              </div>

              <div className="md:col-span-1 flex justify-end">
                {lines.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`Remove line ${index + 1}`}
                    onClick={() => removeLine(line.key)}
                    className="h-9 w-9 p-0"
                  >
                    <Trash2 className="h-4 w-4 text-[#991B1B]" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="3. Clinical & Referring Notes">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField id="ord-doc" label="Referring Doctor (Optional)">
            <Input
              id="ord-doc"
              value={referringDoctor}
              onChange={(e) => setReferringDoctor(e.target.value)}
              placeholder="Dr. S. Kulkarni"
            />
          </FormField>
          <FormField
            id="ord-clinical"
            label="Clinical / Preparation Notes (Shared with Partner Lab)"
          >
            <Textarea
              id="ord-clinical"
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="e.g. 12h fasting confirmed; pacemaker check negative"
            />
          </FormField>
        </div>
      </Panel>

      <div className="flex justify-end gap-2">
        <Button type="submit" isLoading={busy}>
          Create Diagnostic Order & Snapshot Rates
        </Button>
      </div>
    </form>
  );
}

