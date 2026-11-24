"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock } from "lucide-react";
import { apiRequest } from "@/lib/client/api";
import { Button, FormField, Input } from "@/components/ui/primitives";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await apiRequest<{ redirectTo: string }>(
        "/api/v1/auth/login",
        {
          method: "POST",
          body: { email, password },
        },
      );
      router.push(res.redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col justify-start sm:justify-center items-center bg-[#F8FAFC] px-4 py-8">
      <div className="w-full max-w-md rounded-[6px] border border-[#CBD5E1] bg-white">
        <div className="border-b border-[#E2E8F0] bg-[#F1F5F9] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 items-center rounded-[4px] bg-[#1B365D] px-2 text-xs font-semibold text-white">
              DCMS
            </span>
            <h1
              id="main-content"
              tabIndex={-1}
              className="text-lg font-semibold text-[#0F172A] m-0"
            >
              Sign in to DCMS
            </h1>
          </div>
          <p className="mt-1 text-xs text-[#475569] m-0">
            Consultancy Operations & Partner Diagnostic Centre Portal
          </p>
        </div>

        <form method="post" onSubmit={handleSubmit} className="p-5 space-y-4">
          {error ? (
            <div
              role="alert"
              className="rounded-[4px] border border-[#FCA5A5] bg-[#FEE2E2] px-3 py-2 text-xs font-medium text-[#991B1B]"
            >
              {error}
            </div>
          ) : null}

          <FormField id="email" label="Work email" required>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              spellCheck={false}
              required
              enterKeyHint="next"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder="name@consultancy.in"
            />
          </FormField>

          <FormField id="current-password" label="Password" required>
            <div className="relative flex items-center">
              <Input
                id="current-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                enterKeyHint="done"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                className="pr-10"
              />
              <button
                type="button"
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-1.5 inline-flex h-7 w-7 items-center justify-center rounded-[4px] text-[#475569] hover:bg-[#F1F5F9] cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </FormField>

          <div className="flex items-center justify-between pt-1">
            <Link
              href="/reset-password"
              className="text-xs font-medium text-[#1B365D] hover:underline"
            >
              Forgot password?
            </Link>
            <Button type="submit" isLoading={isSubmitting}>
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isSubmitting ? "Signing in..." : "Sign in"}</span>
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}

