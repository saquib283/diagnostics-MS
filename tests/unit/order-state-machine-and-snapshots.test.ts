import { describe, expect, it } from "vitest";
import {
  assertValidOrderItemTransition,
  deriveOrderStatus,
  buildOrderItemsSnapshot,
} from "@/modules/orders/state-machine";

describe("Order Item State Machine, Derived Order Status & Snapshots", () => {
  it("allows valid forward clinical status transitions and blocks illegal backward/terminal transitions", () => {
    expect(() =>
      assertValidOrderItemTransition("PENDING", "CONFIRMED"),
    ).not.toThrow();
    expect(() =>
      assertValidOrderItemTransition("CONFIRMED", "IN_PROGRESS"),
    ).not.toThrow();
    expect(() =>
      assertValidOrderItemTransition("IN_PROGRESS", "COMPLETED"),
    ).not.toThrow();
    expect(() =>
      assertValidOrderItemTransition("COMPLETED", "PENDING"),
    ).toThrow(/BAD_REQUEST/);
    expect(() =>
      assertValidOrderItemTransition("CANCELLED", "COMPLETED"),
    ).toThrow(/BAD_REQUEST/);
  });

  it("derives overall DiagnosticOrder status including PARTIALLY_COMPLETED", () => {
    expect(deriveOrderStatus(["PENDING", "PENDING"])).toBe("PENDING");
    expect(deriveOrderStatus(["CONFIRMED", "PENDING"])).toBe("CONFIRMED");
    expect(deriveOrderStatus(["IN_PROGRESS", "CONFIRMED"])).toBe("IN_PROGRESS");
    expect(deriveOrderStatus(["COMPLETED", "IN_PROGRESS"])).toBe(
      "PARTIALLY_COMPLETED",
    );
    expect(deriveOrderStatus(["COMPLETED", "COMPLETED"])).toBe("COMPLETED");
    expect(deriveOrderStatus(["COMPLETED", "CANCELLED"])).toBe("COMPLETED");
    expect(deriveOrderStatus(["CANCELLED", "CANCELLED"])).toBe("CANCELLED");
  });

  it("freezes commercial, tax, and commission snapshots at order creation so catalogue mutations cannot rewrite history", () => {
    const catalogueTest = {
      id: "test-1",
      code: "MRI-BRAIN",
      name: "MRI Brain Plain",
      defaultSellingPrice: "3500.00",
      hsnSacCode: "999316",
      taxCode: "EXEMPT-DIAG",
      cgstRate: "0.0000",
      sgstRate: "0.0000",
      igstRate: "0.0000",
      isExempt: true,
    };

    const snapshot = buildOrderItemsSnapshot({
      paymentModel: "MODEL_A_CONSULTANCY_COLLECTS",
      issuerStateCode: "27",
      placeOfSupplyStateCode: "27",
      lines: [
        {
          test: catalogueTest,
          quantity: 1,
          discountAmount: "200.00",
          partnerUnitPrice: "2400.00",
          commissionPercentage: null,
          commissionBasis: null,
        },
      ],
    });

    // Mutate original catalogue object in memory to prove snapshot independence
    catalogueTest.defaultSellingPrice = "4999.00";
    catalogueTest.name = "Renamed MRI";

    expect(snapshot.items[0]?.testNameSnapshot).toBe("MRI Brain Plain");
    expect(snapshot.items[0]?.unitSellingPriceSnapshot).toBe("3500.00");
    expect(snapshot.items[0]?.discountAmountSnapshot).toBe("200.00");
    expect(snapshot.items[0]?.netSellingAmountSnapshot).toBe("3300.00");
    expect(snapshot.items[0]?.partnerNetPayableSnapshot).toBe("2400.00");
    expect(snapshot.netSellingTotal).toBe("3300.00");
  });
});

