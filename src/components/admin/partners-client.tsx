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

export function CreatePartnerForm({ csrfToken }: { csrfToken?: string }) {
  const router = useRouter();
  const [partnerCode, setPartnerCode] = useState("");
  const [legalName, setLegalName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("+91");
  const [email, setEmail] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("Pune");
  const [stateCode, setStateCode] = useState("27");
  const [stateName, setStateName] = useState("Maharashtra");
  const [pincode, setPincode] = useState("411001");
  const [gstin, setGstin] = useState("");
  const [defaultPaymentModel, setDefaultPaymentModel] = useState<
    "MODEL_A_CONSULTANCY_COLLECTS" | "MODEL_B_PATIENT_PAYS_PARTNER"
  >("MODEL_A_CONSULTANCY_COLLECTS");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const created = await apiRequest<{ id: string }>("/api/v1/partners", {
        method: "POST",
        csrfToken,
        body: {
          partnerCode,
          legalName,
          displayName,
          contactPerson,
          phone,
          email: email || null,
          addressLine,
          city,
          stateCode,
          stateName,
          pincode,
          gstin: gstin || null,
          defaultPaymentModel,
        },
      });
      router.push(`/admin/partners/${created.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to onboard partner.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Onboard Partner Diagnostic Centre">
      <form method="post" onSubmit={handleSubmit} className="space-y-3.5">
        {error ? (
          <div role="alert" className="rounded-[4px] bg-[#FEE2E2] p-2 text-xs text-[#991B1B]">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FormField id="prt-code" label="Partner Code" required>
            <Input
              id="prt-code"
              required
              spellCheck={false}
              value={partnerCode}
              onChange={(e) => setPartnerCode(e.target.value)}
              placeholder="PRT-APEXLAB"
            />
          </FormField>
          <FormField id="prt-display" label="Display Name" required>
            <Input
              id="prt-display"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="City MRI & Diagnostics"
            />
          </FormField>
          <FormField id="prt-legal" label="Registered Legal Name" required>
            <Input
              id="prt-legal"
              required
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="City MRI Diagnostics Pvt. Ltd."
            />
          </FormField>
          <FormField id="prt-model" label="Default Commercial Model" required>
            <Select
              id="prt-model"
              value={defaultPaymentModel}
              onChange={(e) =>
                setDefaultPaymentModel(
                  e.target.value as
                    | "MODEL_A_CONSULTANCY_COLLECTS"
                    | "MODEL_B_PATIENT_PAYS_PARTNER",
                )
              }
            >
              <option value="MODEL_A_CONSULTANCY_COLLECTS">
                Model A — Consultancy Collects
              </option>
              <option value="MODEL_B_PATIENT_PAYS_PARTNER">
                Model B — Patient Pays Partner
              </option>
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FormField id="prt-contact" label="Contact Person" required>
            <Input
              id="prt-contact"
              required
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
            />
          </FormField>
          <FormField id="prt-phone" label="Phone" required>
            <Input
              id="prt-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </FormField>
          <FormField id="prt-email" label="Email">
            <Input
              id="prt-email"
              type="email"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
          <FormField id="prt-gstin" label="GSTIN (Optional)">
            <Input
              id="prt-gstin"
              spellCheck={false}
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2">
            <FormField id="prt-addr" label="Address" required>
              <Input
                id="prt-addr"
                required
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
              />
            </FormField>
          </div>
          <FormField id="prt-city" label="City" required>
            <Input
              id="prt-city"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </FormField>
          <FormField id="prt-state" label="State Code / Name" required>
            <div className="flex gap-1.5">
              <Input
                id="prt-state"
                required
                maxLength={2}
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                className="w-14"
              />
              <Input
                aria-label="State name"
                required
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
              />
            </div>
          </FormField>
          <FormField id="prt-pin" label="PIN Code" required>
            <Input
              id="prt-pin"
              required
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
            />
          </FormField>
        </div>

        <Button type="submit" isLoading={busy}>
          Create Partner & Configure Pricing
        </Button>
      </form>
    </Panel>
  );
}

