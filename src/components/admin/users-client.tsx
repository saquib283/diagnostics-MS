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

export function CreateUserClientForm({
  csrfToken,
  partners,
}: {
  csrfToken?: string;
  partners: Array<{ id: string; displayName: string; partnerCode: string }>;
}) {
  const router = useRouter();
  const [portalType, setPortalType] = useState<"CONSULTANCY" | "PARTNER">("CONSULTANCY");
  const [roleCode, setRoleCode] = useState("RECEPTIONIST");
  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? "");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiRequest("/api/v1/users", {
        method: "POST",
        csrfToken,
        body: {
          email,
          fullName,
          password,
          portalType,
          roleCodes: [roleCode],
          partnerId: portalType === "PARTNER" ? partnerId : null,
          partnerRole: portalType === "PARTNER" ? roleCode : null,
        },
      });
      setFullName("");
      setEmail("");
      setPassword("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Provision Staff or Partner User Account">
      <form method="post" onSubmit={handleSubmit} className="space-y-3">
        {error ? (
          <div role="alert" className="rounded-[4px] bg-[#FEE2E2] p-2 text-xs text-[#991B1B]">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <FormField id="usr-portal" label="Portal Scope" required>
            <Select
              id="usr-portal"
              value={portalType}
              onChange={(e) => {
                const next = e.target.value as "CONSULTANCY" | "PARTNER";
                setPortalType(next);
                setRoleCode(
                  next === "PARTNER" ? "PARTNER_ADMIN" : "RECEPTIONIST",
                );
              }}
            >
              <option value="CONSULTANCY">Consultancy Staff</option>
              <option value="PARTNER">Partner Diagnostic Centre</option>
            </Select>
          </FormField>

          <FormField id="usr-role" label="Assigned Role" required>
            <Select
              id="usr-role"
              value={roleCode}
              onChange={(e) => setRoleCode(e.target.value)}
            >
              {portalType === "CONSULTANCY" ? (
                <>
                  <option value="RECEPTIONIST">Receptionist</option>
                  <option value="ACCOUNTANT">Accountant</option>
                  <option value="REPORT_MANAGER">Report Manager</option>
                  <option value="ADMIN">Admin</option>
                  <option value="VIEWER_AUDITOR">Viewer / Auditor</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </>
              ) : (
                <>
                  <option value="PARTNER_ADMIN">Partner Admin</option>
                  <option value="PARTNER_STAFF">Partner Staff</option>
                  <option value="PARTNER_REPORT_MANAGER">
                    Partner Report Manager
                  </option>
                </>
              )}
            </Select>
          </FormField>

          {portalType === "PARTNER" ? (
            <FormField id="usr-prt" label="Partner Centre" required>
              <Select
                id="usr-prt"
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName} ({p.partnerCode})
                  </option>
                ))}
              </Select>
            </FormField>
          ) : (
            <div className="hidden md:block" />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <FormField id="usr-name" label="Full Name" required>
            <Input
              id="usr-name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </FormField>
          <FormField id="usr-email" label="Work Email" required>
            <Input
              id="usr-email"
              type="email"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
          <FormField id="usr-pwd" label="Initial Password (min 10 chars)" required>
            <Input
              id="usr-pwd"
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
          Create User Account
        </Button>
      </form>
    </Panel>
  );
}

export function UserRowStatusToggle({
  userId,
  currentUserId,
  isActive,
  csrfToken,
}: {
  userId: string;
  currentUserId: string;
  isActive: boolean;
  csrfToken?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (userId === currentUserId) {
    return <span className="text-xs text-[#475569]">Current Session</span>;
  }

  async function handleToggle() {
    setBusy(true);
    try {
      await apiRequest(`/api/v1/users/${userId}`, {
        method: "PATCH",
        csrfToken,
        body: { isActive: !isActive },
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      variant={isActive ? "destructive" : "secondary"}
      isLoading={busy}
      onClick={handleToggle}
    >
      {isActive ? "Deactivate & Revoke" : "Activate"}
    </Button>
  );
}

