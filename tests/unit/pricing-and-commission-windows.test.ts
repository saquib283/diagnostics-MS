import { describe, expect, it } from "vitest";
import {
  hasEffectiveWindowOverlap,
  selectEffectiveRecord,
  calculateModelBCommission,
} from "@/modules/partners/pricing-engine";

describe("Partner Pricing & Commission Effective Date Engine", () => {
  it("detects overlapping effective date ranges including open-ended intervals", () => {
    // Existing: 2026-01-01 .. 2026-06-30
    expect(
      hasEffectiveWindowOverlap(
        { effectiveFrom: new Date("2026-01-01"), effectiveTo: new Date("2026-06-30") },
        { effectiveFrom: new Date("2026-06-15"), effectiveTo: new Date("2026-12-31") },
      ),
    ).toBe(true);

    // Adjacent non-overlapping: 2026-07-01 .. null
    expect(
      hasEffectiveWindowOverlap(
        { effectiveFrom: new Date("2026-01-01"), effectiveTo: new Date("2026-06-30") },
        { effectiveFrom: new Date("2026-07-01"), effectiveTo: null },
      ),
    ).toBe(false);

    // Two open-ended intervals always overlap
    expect(
      hasEffectiveWindowOverlap(
        { effectiveFrom: new Date("2026-01-01"), effectiveTo: null },
        { effectiveFrom: new Date("2026-09-01"), effectiveTo: null },
      ),
    ).toBe(true);
  });

  it("selects the active effective price for a given order date", () => {
    const prices = [
      {
        id: "p1",
        agreedPurchasePrice: "1200.00",
        effectiveFrom: new Date("2026-01-01"),
        effectiveTo: new Date("2026-05-31"),
        isActive: true,
      },
      {
        id: "p2",
        agreedPurchasePrice: "1400.00",
        effectiveFrom: new Date("2026-06-01"),
        effectiveTo: null,
        isActive: true,
      },
    ];

    expect(selectEffectiveRecord(prices, new Date("2026-03-15"))?.id).toBe("p1");
    expect(selectEffectiveRecord(prices, new Date("2026-11-24"))?.id).toBe("p2");
    expect(selectEffectiveRecord(prices, new Date("2025-12-01"))).toBeNull();
  });

  it("computes Model B commission strictly according to configured basis and blocks UNCONFIGURED", () => {
    expect(() =>
      calculateModelBCommission({
        grossBeforeDiscountExclTax: "2000.00",
        netAfterDiscountExclTax: "1800.00",
        netInclTax: "2124.00",
        commissionPercentage: "15.0000",
        basis: "UNCONFIGURED",
      }),
    ).toThrow(/POLICY_UNCONFIGURED/);

    expect(
      calculateModelBCommission({
        grossBeforeDiscountExclTax: "2000.00",
        netAfterDiscountExclTax: "1800.00",
        netInclTax: "2124.00",
        commissionPercentage: "15.0000",
        basis: "NET_AFTER_DISCOUNT_EXCL_TAX",
      }),
    ).toBe("270.00");

    expect(
      calculateModelBCommission({
        grossBeforeDiscountExclTax: "2000.00",
        netAfterDiscountExclTax: "1800.00",
        netInclTax: "2124.00",
        commissionPercentage: "15.0000",
        basis: "GROSS_BEFORE_DISCOUNT_EXCL_TAX",
      }),
    ).toBe("300.00");
  });
});

