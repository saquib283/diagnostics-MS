"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/client/api";
import { Button, FormField, Input } from "@/components/ui/primitives";

function ResetPasswordContent() {
  const sp = useSearchParams();
  const urlToken = sp.get("token") ?? "";
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleRequestLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await apiRequest<{ message: string }>(
        "/api/v1/auth/password/forgot",
        { method: "POST", body: { email } },
      );
      setStatusMsg(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCompleteReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiRequest("/api/v1/auth/password/reset", {
        method: "POST",
        body: { token: urlToken, newPassword },
      });
      setStatusMsg("Password updated. All previous sessions were revoked. You may now sign in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4">
      <div className="w-full max-w-md rounded-[6px] border border-[#CBD5E1] bg-white p-5 space-y-4">
        <h1 className="text-lg font-semibold text-[#0F172A] m-0">
          {urlToken ? "Set a new password" : "Reset account password"}
        </h1>

        {statusMsg ? (
          <div
            role="status"
            className="rounded-[4px] border border-[#86EFAC] bg-[#DCFCE7] p-3 text-xs text-[#166534]"
          >
            {statusMsg}
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="rounded-[4px] border border-[#FCA5A5] bg-[#FEE2E2] p-3 text-xs text-[#991B1B]"
          >
            {error}
          </div>
        ) : null}

        {urlToken ? (
          <form method="post" onSubmit={handleCompleteReset} className="space-y-4">
            <FormField
              id="new-password"
              label="New password"
              required
              hint="Minimum 10 characters."
            >
              <Input
                id="new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </FormField>
            <Button type="submit" isLoading={busy}>
              Save new password
            </Button>
          </form>
        ) : (
          <form method="post" onSubmit={handleRequestLink} className="space-y-4">
            <FormField id="reset-email" label="Registered work email" required>
              <Input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="username"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>
            <Button type="submit" isLoading={busy}>
              Send reset link
            </Button>
          </form>
        )}

        <div>
          <Link href="/login" className="text-xs font-medium text-[#1B365D] hover:underline">
            Return to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[#475569]">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}

