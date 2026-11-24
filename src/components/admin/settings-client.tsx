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
  Textarea,
} from "@/components/ui/primitives";

export function OrganizationSettingsClientForm({
  initial,
  csrfToken,
}: {
  initial: {
    legalName: string;
    displayName: string;
    gstin: string | null;
    pan: string | null;
    registeredAddress: string;
    city: string;
    stateCode: string;
    stateName: string;
    pincode: string;
    contactEmail: string;
    contactPhone: string;
    settings: {
      defaultCommissionBasis: string;
      requireConsultancyCompletionApproval: boolean;
      allowInvoiceOverpayment: boolean;
      partnerPatientPhoneVisibility: string;
      requireSettlementApproval: boolean;
      gstEnabled: boolean;
      invoiceDocumentTitle: string;
      staticQrFallbackEnabled: boolean;
      staticQrVpaLabel: string | null;
      shareLinkDefaultTtlHours: number;
      invoiceTermsText: string | null;
    };
  };
  csrfToken?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    legalName: initial.legalName,
    displayName: initial.displayName,
    gstin: initial.gstin ?? "",
    pan: initial.pan ?? "",
    registeredAddress: initial.registeredAddress,
    city: initial.city,
    stateCode: initial.stateCode,
    stateName: initial.stateName,
    pincode: initial.pincode,
    contactEmail: initial.contactEmail,
    contactPhone: initial.contactPhone,
    defaultCommissionBasis: initial.settings.defaultCommissionBasis,
    requireConsultancyCompletionApproval:
      initial.settings.requireConsultancyCompletionApproval,
    allowInvoiceOverpayment: initial.settings.allowInvoiceOverpayment,
    partnerPatientPhoneVisibility:
      initial.settings.partnerPatientPhoneVisibility,
    requireSettlementApproval: initial.settings.requireSettlementApproval,
    gstEnabled: initial.settings.gstEnabled,
    invoiceDocumentTitle: initial.settings.invoiceDocumentTitle,
    staticQrFallbackEnabled: initial.settings.staticQrFallbackEnabled,
    staticQrVpaLabel: initial.settings.staticQrVpaLabel ?? "",
    shareLinkDefaultTtlHours: initial.settings.shareLinkDefaultTtlHours,
    invoiceTermsText: initial.settings.invoiceTermsText ?? "",
  });
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedMsg(null);
    setBusy(true);
    try {
      await apiRequest("/api/v1/organization/settings", {
        method: "PATCH",
        csrfToken,
        body: form,
      });
      setSavedMsg("Organization profile and Open Decision policies saved and audited.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form method="post" onSubmit={handleSave} className="space-y-4">
      {savedMsg ? (
        <div role="status" className="rounded-[4px] bg-[#DCFCE7] p-2.5 text-xs text-[#166534]">
          {savedMsg}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="rounded-[4px] bg-[#FEE2E2] p-2.5 text-xs text-[#991B1B]">
          {error}
        </div>
      ) : null}

      <Panel title="Consultancy Legal Entity & Invoice Issuer Details">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-end">
          <FormField id="org-legal" label="Legal Entity Name" required>
            <Input
              id="org-legal"
              required
              value={form.legalName}
              onChange={(e) => setForm({ ...form, legalName: e.target.value })}
            />
          </FormField>
          <FormField id="org-disp" label="Display Name" required>
            <Input
              id="org-disp"
              required
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            />
          </FormField>
          <FormField id="org-gstin" label="GSTIN (Confirm with CA)">
            <Input
              id="org-gstin"
              spellCheck={false}
              value={form.gstin}
              onChange={(e) => setForm({ ...form, gstin: e.target.value })}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 mt-3.5 items-end">
          <div className="md:col-span-2">
            <FormField id="org-addr" label="Registered Address" required>
              <Input
                id="org-addr"
                required
                value={form.registeredAddress}
                onChange={(e) =>
                  setForm({ ...form, registeredAddress: e.target.value })
                }
              />
            </FormField>
          </div>
          <FormField id="org-email" label="Billing Email" required>
            <Input
              id="org-email"
              type="email"
              required
              value={form.contactEmail}
              onChange={(e) =>
                setForm({ ...form, contactEmail: e.target.value })
              }
            />
          </FormField>
          <FormField id="org-phone" label="Contact Phone" required>
            <Input
              id="org-phone"
              type="tel"
              required
              value={form.contactPhone}
              onChange={(e) =>
                setForm({ ...form, contactPhone: e.target.value })
              }
            />
          </FormField>
        </div>
      </Panel>

      <Panel title="Business & CA Policy Controls (PRD Section 15 Open Decisions)">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-end">
          <FormField
            id="pol-comm"
            label="Default Model B Commission Basis (OD-001)"
          >
            <Select
              id="pol-comm"
              value={form.defaultCommissionBasis}
              onChange={(e) =>
                setForm({ ...form, defaultCommissionBasis: e.target.value })
              }
            >
              <option value="UNCONFIGURED">
                UNCONFIGURED (Block until CA confirms)
              </option>
              <option value="NET_AFTER_DISCOUNT_EXCL_TAX">
                Net After Discount Excl. GST
              </option>
              <option value="GROSS_BEFORE_DISCOUNT_EXCL_TAX">
                Gross Before Discount Excl. GST
              </option>
              <option value="NET_INCL_TAX">Net Including GST</option>
            </Select>
          </FormField>

          <FormField
            id="pol-phone"
            label="Partner Visibility of Patient Phone (OD-011)"
          >
            <Select
              id="pol-phone"
              value={form.partnerPatientPhoneVisibility}
              onChange={(e) =>
                setForm({
                  ...form,
                  partnerPatientPhoneVisibility: e.target.value,
                })
              }
            >
              <option value="MASKED">MASKED (+91******1234 — Recommended)</option>
              <option value="FULL">FULL (Unmasked for appointment calls)</option>
            </Select>
          </FormField>

          <FormField
            id="pol-title"
            label="Model A Document Title (OD-008)"
          >
            <Input
              id="pol-title"
              value={form.invoiceDocumentTitle}
              onChange={(e) =>
                setForm({ ...form, invoiceDocumentTitle: e.target.value })
              }
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-xs">
          {[
            {
              key: "gstEnabled" as const,
              label:
                "Enable GST Calculation on Invoices (OD-007 — Enable only after CA sign-off)",
            },
            {
              key: "requireConsultancyCompletionApproval" as const,
              label:
                "Require Consultancy Approval Before Test Completion Enters Settlements (OD-002)",
            },
            {
              key: "requireSettlementApproval" as const,
              label:
                "Require Explicit Settlement Statement Approval Before Payouts (OD-012)",
            },
            {
              key: "allowInvoiceOverpayment" as const,
              label: "Allow Excess / Advance Payment Over Invoice Balance (OD-004)",
            },
            {
              key: "staticQrFallbackEnabled" as const,
              label:
                "Enable Static UPI QR Manual Accountant Reconciliation Queue (OD-005)",
            },
          ].map((chk) => (
            <div key={chk.key} className="inline-flex items-center gap-2">
              <input
                id={`chk-${chk.key}`}
                type="checkbox"
                checked={form[chk.key]}
                onChange={(e) =>
                  setForm({ ...form, [chk.key]: e.target.checked })
                }
                className="accent-[#1B365D]"
              />
              <label htmlFor={`chk-${chk.key}`}>{chk.label}</label>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <FormField id="pol-terms" label="Invoice Terms & Conditions">
            <Textarea
              id="pol-terms"
              value={form.invoiceTermsText}
              onChange={(e) =>
                setForm({ ...form, invoiceTermsText: e.target.value })
              }
            />
          </FormField>
        </div>
      </Panel>

      <Button type="submit" isLoading={busy}>
        Save Organization & Policy Configuration
      </Button>
    </form>
  );
}

