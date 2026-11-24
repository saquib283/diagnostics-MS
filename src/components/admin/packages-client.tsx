"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client/api";
import { Button, FormField, Input, Panel } from "@/components/ui/primitives";

export function CreatePackageComposer({
  csrfToken,
  tests,
}: {
  csrfToken?: string;
  tests: Array<{ id: string; code: string; name: string; defaultSellingPrice: string }>;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [defaultSellingPrice, setDefaultSellingPrice] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleTest(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiRequest("/api/v1/packages", {
        method: "POST",
        csrfToken,
        body: {
          code,
          name,
          defaultSellingPrice,
          items: selectedIds.map((testId) => ({
            testId,
            quantity: 1,
            allocationWeight: "1.0000",
          })),
        },
      });
      setCode("");
      setName("");
      setDefaultSellingPrice("");
      setSelectedIds([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create package.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Create Multi-Test Diagnostic Package">
      <form method="post" onSubmit={handleSubmit} className="space-y-3.5">
        {error ? (
          <div role="alert" className="rounded-[4px] bg-[#FEE2E2] p-2 text-xs text-[#991B1B]">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <FormField id="pkg-code" label="Package Code" required>
            <Input
              id="pkg-code"
              required
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="PKG-CARDIAC-PLUS"
            />
          </FormField>
          <FormField id="pkg-name" label="Package Name" required>
            <Input
              id="pkg-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Comprehensive Cardiac Screening"
            />
          </FormField>
          <FormField id="pkg-price" label="Package Selling Price (₹)" required>
            <Input
              id="pkg-price"
              required
              inputMode="decimal"
              value={defaultSellingPrice}
              onChange={(e) => setDefaultSellingPrice(e.target.value)}
              placeholder="2200.00"
            />
          </FormField>
        </div>

        <fieldset className="rounded-[4px] border border-[#CBD5E1] p-3 m-0">
          <legend className="px-1 text-xs font-semibold text-[#0F172A]">
            Included Tests (Expands into individual trackable order items) *
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-44 overflow-auto">
            {tests.map((t) => (
              <div key={t.id} className="inline-flex items-center gap-2 text-xs">
                <input
                  id={`pkg-test-${t.id}`}
                  type="checkbox"
                  checked={selectedIds.includes(t.id)}
                  onChange={() => toggleTest(t.id)}
                  className="accent-[#1B365D]"
                />
                <label htmlFor={`pkg-test-${t.id}`}>
                  <span className="font-mono-code">{t.code}</span> — {t.name}
                </label>
              </div>
            ))}
          </div>
        </fieldset>

        <Button type="submit" isLoading={busy}>
          Create Package
        </Button>
      </form>
    </Panel>
  );
}

export function PackageRowLifecycleActions({
  packageId,
  currentPrice,
  isActive,
  csrfToken,
}: {
  packageId: string;
  currentPrice: string;
  isActive: boolean;
  csrfToken?: string;
}) {
  const router = useRouter();
  const [price, setPrice] = useState(currentPrice);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSavePrice() {
    setBusy(true);
    try {
      await apiRequest(`/api/v1/packages/${packageId}`, {
        method: "PATCH",
        csrfToken,
        body: { defaultSellingPrice: price },
      });
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive() {
    setBusy(true);
    try {
      await apiRequest(`/api/v1/packages/${packageId}`, {
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
    <div className="flex items-center justify-end gap-1.5">
      {editing ? (
        <>
          <Input
            aria-label="Updated package selling price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="h-8 w-24 text-xs tabular-nums"
          />
          <Button size="sm" onClick={handleSavePrice} isLoading={busy}>
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setPrice(currentPrice);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Edit Price
        </Button>
      )}
      <Button
        size="sm"
        variant="secondary"
        isLoading={busy}
        onClick={handleToggleActive}
      >
        {isActive ? "Deactivate" : "Activate"}
      </Button>
    </div>
  );
}

