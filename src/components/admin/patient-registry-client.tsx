"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client/api";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { Button, FormField, Input, Panel } from "@/components/ui/primitives";

export function QuickRegisterPatientForm({ csrfToken }: { csrfToken?: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("+91");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER">("MALE");
  const [ageYearsSnapshot, setAgeYearsSnapshot] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [whatsappConsent, setWhatsappConsent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const created = await apiRequest<{ id: string }>("/api/v1/patients", {
        method: "POST",
        csrfToken,
        body: {
          fullName,
          mobile,
          gender,
          ageYearsSnapshot: ageYearsSnapshot ? Number(ageYearsSnapshot) : null,
          email: email || null,
          city: city || null,
          consents: [
            { consentType: "DATA_PROCESSING", granted: true },
            { consentType: "PARTNER_SHARING", granted: true },
            { consentType: "WHATSAPP_COMMUNICATION", granted: whatsappConsent },
          ],
        },
      });
      setFullName("");
      setMobile("+91");
      setAgeYearsSnapshot("");
      setEmail("");
      router.push(`/admin/patients/${created.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register patient.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Register New Patient">
      <form method="post" onSubmit={handleSubmit} className="space-y-3.5">
        {error ? (
          <div
            role="alert"
            className="rounded-[4px] border border-[#FCA5A5] bg-[#FEE2E2] p-2.5 text-xs text-[#991B1B]"
          >
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-start">
          <FormField id="pat-fullname" label="Patient full name" required>
            <Input
              id="pat-fullname"
              name="fullName"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Rajesh Sharma"
            />
          </FormField>

          <FormField
            id="pat-mobile"
            label="Mobile number"
            required
            hint="Stored as string (+91 / leading 0 preserved)"
          >
            <Input
              id="pat-mobile"
              name="mobile"
              type="tel"
              autoComplete="tel"
              required
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
          </FormField>

          <FormField id="pat-age" label="Age (Years)">
            <Input
              id="pat-age"
              name="ageYears"
              type="text"
              inputMode="numeric"
              pattern="\d{1,3}"
              value={ageYearsSnapshot}
              onChange={(e) => setAgeYearsSnapshot(e.target.value)}
              placeholder="e.g. 42"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-end">
          <fieldset className="border-0 p-0 m-0 flex flex-col">
            <legend className="p-0 mb-1 text-[13px] font-medium text-[#0F172A] leading-snug">
              Gender
              <span aria-hidden="true" className="text-[#991B1B] ml-0.5">
                *
              </span>
            </legend>
            <div className="flex h-9 items-center gap-4 rounded-[4px] border border-[#64748B] bg-white px-3 text-xs">
              {(["MALE", "FEMALE", "OTHER"] as const).map((g) => (
                <span key={g} className="inline-flex items-center gap-1.5">
                  <input
                    id={`gender-${g}`}
                    type="radio"
                    name="gender"
                    value={g}
                    checked={gender === g}
                    onChange={() => setGender(g)}
                    className="accent-[#1B365D]"
                  />
                  <label htmlFor={`gender-${g}`} className="cursor-pointer">
                    {g}
                  </label>
                </span>
              ))}
            </div>
          </fieldset>

          <FormField id="pat-email" label="Email (Optional)">
            <Input
              id="pat-email"
              name="email"
              type="email"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>

          <FormField id="pat-city" label="City">
            <Input
              id="pat-city"
              name="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Pune"
            />
          </FormField>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="inline-flex items-center gap-2 text-xs text-[#334155]">
            <input
              id="pat-wa-consent"
              type="checkbox"
              checked={whatsappConsent}
              onChange={(e) => setWhatsappConsent(e.target.checked)}
              className="accent-[#1B365D]"
            />
            <label htmlFor="pat-wa-consent">
              Patient consents to receive billing & report-ready links via WhatsApp/Email
            </label>
          </div>

          <Button type="submit" isLoading={busy}>
            Save & Open Patient Record
          </Button>
        </div>
      </form>
    </Panel>
  );
}

export function EditPatientProfileForm({
  patient,
  csrfToken,
}: {
  patient: {
    id: string;
    fullName: string;
    mobile: string;
    alternateMobile: string | null;
    email: string | null;
    addressLine: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
  };
  csrfToken?: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [fullName, setFullName] = useState(patient.fullName);
  const [mobile, setMobile] = useState(patient.mobile);
  const [alternateMobile, setAlternateMobile] = useState(
    patient.alternateMobile ?? "",
  );
  const [email, setEmail] = useState(patient.email ?? "");
  const [addressLine, setAddressLine] = useState(patient.addressLine ?? "");
  const [city, setCity] = useState(patient.city ?? "");
  const [state, setState] = useState(patient.state ?? "");
  const [pincode, setPincode] = useState(patient.pincode ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiRequest(`/api/v1/patients/${patient.id}`, {
        method: "PATCH",
        csrfToken,
        body: {
          fullName,
          mobile,
          alternateMobile: alternateMobile || null,
          email: email || null,
          addressLine: addressLine || null,
          city: city || null,
          state: state || null,
          pincode: pincode || null,
        },
      });
      setExpanded(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setExpanded(true)}>
        Edit Patient Demographics
      </Button>

      <ModalDialog
        open={expanded}
        onClose={() => setExpanded(false)}
        title="Edit Patient Demographics"
        maxWidthClass="max-w-2xl"
      >
        <form method="post" onSubmit={handleSave} className="space-y-3.5">
          {error ? (
            <div role="alert" className="rounded-[4px] bg-[#FEE2E2] p-2 text-xs text-[#991B1B]">
              {error}
            </div>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField id="ep-name" label="Full Name" required>
              <Input
                id="ep-name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </FormField>
            <FormField id="ep-mob" label="Primary Mobile" required>
              <Input
                id="ep-mob"
                type="tel"
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
              />
            </FormField>
            <FormField id="ep-alt" label="Alternate Mobile">
              <Input
                id="ep-alt"
                type="tel"
                value={alternateMobile}
                onChange={(e) => setAlternateMobile(e.target.value)}
              />
            </FormField>
            <FormField id="ep-email" label="Email">
              <Input
                id="ep-email"
                type="email"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>
          </div>
          <FormField id="ep-addr" label="Address">
            <Input
              id="ep-addr"
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
            />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField id="ep-city" label="City">
              <Input
                id="ep-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </FormField>
            <FormField id="ep-state" label="State">
              <Input
                id="ep-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="Maharashtra"
              />
            </FormField>
            <FormField id="ep-pin" label="PIN Code">
              <Input
                id="ep-pin"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="411001"
              />
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setExpanded(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={busy}>
              Save Changes
            </Button>
          </div>
        </form>
      </ModalDialog>
    </>
  );
}

