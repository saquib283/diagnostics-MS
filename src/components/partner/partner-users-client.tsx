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

export function PartnerStaffFormClient({ csrfToken }: { csrfToken?: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [partnerRole, setPartnerRole] = useState("PARTNER_REPORT_MANAGER");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiRequest("/api/v1/partner/users", {
        method: "POST",
        csrfToken,
        body: { fullName, email, password, partnerRole },
      });
      setFullName("");
      setEmail("");
      setPassword("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add staff user.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Add Centre Staff Account">
      <form method="post" onSubmit={handleSubmit} className="space-y-3">
        {error ? (
          <div role="alert" className="rounded-[4px] bg-[#FEE2E2] p-2 text-xs text-[#991B1B]">
            {error}
          </div>
        ) : null}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <FormField id="pusr-name" label="Full Name" required>
            <Input
              id="pusr-name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </FormField>
          <FormField id="pusr-email" label="Work Email" required>
            <Input
              id="pusr-email"
              type="email"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
          <FormField id="pusr-role" label="Centre Role" required>
            <Select
              id="pusr-role"
              value={partnerRole}
              onChange={(e) => setPartnerRole(e.target.value)}
            >
              <option value="PARTNER_REPORT_MANAGER">Report Manager</option>
              <option value="PARTNER_STAFF">Lab Staff</option>
              <option value="PARTNER_ADMIN">Partner Admin</option>
            </Select>
          </FormField>
          <FormField id="pusr-pwd" label="Password (min 10 chars)" required>
            <Input
              id="pusr-pwd"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
        </div>
        <Button type="submit" isLoading={busy}>
          Create Centre Staff User
        </Button>
      </form>
    </Panel>
  );
}

