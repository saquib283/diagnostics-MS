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

export function CreateTestAndCategoryForms({
  csrfToken,
  categories,
  taxCodes,
}: {
  csrfToken?: string;
  categories: Array<{ id: string; name: string; code: string }>;
  taxCodes: Array<{ id: string; code: string; name: string }>;
}) {
  const router = useRouter();
  const [catCode, setCatCode] = useState("");
  const [catName, setCatName] = useState("");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [defaultSellingPrice, setDefaultSellingPrice] = useState("");
  const [sampleType, setSampleType] = useState("");
  const [taxCodeId, setTaxCodeId] = useState(taxCodes[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiRequest("/api/v1/test-categories", {
        method: "POST",
        csrfToken,
        body: { code: catCode, name: catName },
      });
      setCatCode("");
      setCatName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add category.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateTest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiRequest("/api/v1/tests", {
        method: "POST",
        csrfToken,
        body: {
          code,
          name,
          categoryId,
          defaultSellingPrice,
          sampleType: sampleType || null,
          taxCodeId: taxCodeId || null,
        },
      });
      setCode("");
      setName("");
      setDefaultSellingPrice("");
      setSampleType("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add test.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
      <Panel title="Add Test Category">
        <form method="post" onSubmit={handleCreateCategory} className="space-y-3">
          <FormField id="cat-code" label="Category Code" required>
            <Input
              id="cat-code"
              required
              spellCheck={false}
              value={catCode}
              onChange={(e) => setCatCode(e.target.value)}
              placeholder="CARDIOLOGY"
            />
          </FormField>
          <FormField id="cat-name" label="Category Name" required>
            <Input
              id="cat-name"
              required
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Cardiology & ECG"
            />
          </FormField>
          <Button type="submit" variant="secondary" isLoading={busy}>
            Create Category
          </Button>
        </form>
      </Panel>

      <Panel title="Add Diagnostic Test to Catalogue" className="lg:col-span-2">
        <form method="post" onSubmit={handleCreateTest} className="space-y-3">
          {error ? (
            <div role="alert" className="rounded-[4px] bg-[#FEE2E2] p-2 text-xs text-[#991B1B]">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <FormField id="test-code" label="Test Code" required>
              <Input
                id="test-code"
                required
                spellCheck={false}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="CT-CHEST"
              />
            </FormField>
            <FormField id="test-name" label="Test Name" required>
              <Input
                id="test-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="HRCT Chest Plain"
              />
            </FormField>
            <FormField id="test-cat" label="Category" required>
              <Select
                id="test-cat"
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <FormField id="test-price" label="Default Selling Price (₹)" required>
              <Input
                id="test-price"
                required
                inputMode="decimal"
                value={defaultSellingPrice}
                onChange={(e) => setDefaultSellingPrice(e.target.value)}
                placeholder="2800.00"
              />
            </FormField>
            <FormField id="test-sample" label="Sample / Modality">
              <Input
                id="test-sample"
                value={sampleType}
                onChange={(e) => setSampleType(e.target.value)}
                placeholder="CT / Fasting Serum"
              />
            </FormField>
            <FormField id="test-tax" label="Tax Code">
              <Select
                id="test-tax"
                value={taxCodeId}
                onChange={(e) => setTaxCodeId(e.target.value)}
              >
                <option value="">Exempt / None</option>
                {taxCodes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} — {t.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <Button type="submit" isLoading={busy}>
            Add Test to Catalogue
          </Button>
        </form>
      </Panel>
    </div>
  );
}

export function TestRowLifecycleActions({
  testId,
  currentPrice,
  isActive,
  csrfToken,
}: {
  testId: string;
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
      await apiRequest(`/api/v1/tests/${testId}`, {
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
      await apiRequest(`/api/v1/tests/${testId}`, {
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
            aria-label="Updated default selling price"
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

