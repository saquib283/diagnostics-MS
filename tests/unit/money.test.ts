import { describe, expect, it } from "vitest";
import {
  money,
  addMoney,
  subMoney,
  mulMoney,
  percentageOf,
  toPaise,
  fromPaise,
  formatInr,
  allocateProportional,
  computeGstBreakdown,
} from "@/lib/money";

describe("Fixed-precision Money & Tax Arithmetic (Decimal.js)", () => {
  it("eliminates IEEE-754 floating point drift (0.1 + 0.2 === 0.30)", () => {
    expect(addMoney("0.10", "0.20")).toBe("0.30");
    expect(subMoney("5000.00", "1999.99")).toBe("3000.01");
  });

  it("computes multi-part split payment balances accurately (₹5,000 = ₹2,000 + ₹2,000 + ₹1,000)", () => {
    const invoiceTotal = money("5000.00");
    const afterCash = subMoney(invoiceTotal, "2000.00");
    expect(afterCash).toBe("3000.00");

    const afterQr = subMoney(afterCash, "2000.00");
    expect(afterQr).toBe("1000.00");

    const afterCard = subMoney(afterQr, "1000.00");
    expect(afterCard).toBe("0.00");
  });

  it("converts between INR rupees and integer Razorpay paise without precision loss", () => {
    expect(toPaise("2000.00")).toBe(200000);
    expect(toPaise("1499.75")).toBe(149975);
    expect(fromPaise(149975)).toBe("1499.75");
  });

  it("calculates percentage commissions using ROUND_HALF_UP to 2 decimals", () => {
    expect(percentageOf("2000.00", "15.0000")).toBe("300.00");
    expect(percentageOf("1333.33", "12.5000")).toBe("166.67");
  });

  it("allocates package selling price across test weights with exact penny reconciliation", () => {
    const allocated = allocateProportional("1000.00", ["1", "1", "1"]);
    expect(allocated).toEqual(["333.33", "333.33", "333.34"]);
    const sum = allocated.reduce((acc, v) => addMoney(acc, v), "0.00");
    expect(sum).toBe("1000.00");
  });

  it("computes intra-state CGST+SGST vs inter-state IGST vs exempt 0% accurately", () => {
    const intraState = computeGstBreakdown({
      taxableAmount: "1000.00",
      cgstRate: "9.0000",
      sgstRate: "9.0000",
      igstRate: "18.0000",
      isExempt: false,
      issuerStateCode: "27",
      placeOfSupplyStateCode: "27",
    });
    expect(intraState).toEqual({
      cgstRate: "9.0000",
      cgstAmount: "90.00",
      sgstRate: "9.0000",
      sgstAmount: "90.00",
      igstRate: "0.0000",
      igstAmount: "0.00",
      totalTax: "180.00",
      lineTotal: "1180.00",
    });

    const interState = computeGstBreakdown({
      taxableAmount: "1000.00",
      cgstRate: "9.0000",
      sgstRate: "9.0000",
      igstRate: "18.0000",
      isExempt: false,
      issuerStateCode: "27",
      placeOfSupplyStateCode: "29",
    });
    expect(interState).toEqual({
      cgstRate: "0.0000",
      cgstAmount: "0.00",
      sgstRate: "0.0000",
      sgstAmount: "0.00",
      igstRate: "18.0000",
      igstAmount: "180.00",
      totalTax: "180.00",
      lineTotal: "1180.00",
    });

    const exempt = computeGstBreakdown({
      taxableAmount: "1500.00",
      cgstRate: "9.0000",
      sgstRate: "9.0000",
      igstRate: "18.0000",
      isExempt: true,
      issuerStateCode: "27",
      placeOfSupplyStateCode: "27",
    });
    expect(exempt.totalTax).toBe("0.00");
    expect(exempt.lineTotal).toBe("1500.00");
  });

  it("formats Indian currency with en-IN grouping and multiplies quantities accurately", () => {
    expect(mulMoney("1250.50", 2)).toBe("2501.00");
    expect(formatInr("125000.50")).toBe("₹1,25,000.50");
  });
});

