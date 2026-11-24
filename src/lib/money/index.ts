import Decimal from "decimal.js";

Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

export type MoneyInput = string | number | Decimal | { toString(): string };

export function toDecimal(value: MoneyInput): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  return new Decimal(value.toString());
}

/** Normalizes any monetary input to a fixed 2-decimal string (e.g. "2000.00"). */
export function money(value: MoneyInput): string {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

/** Normalizes a percentage rate to a fixed 4-decimal string (e.g. "15.0000"). */
export function rate(value: MoneyInput): string {
  return toDecimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
}

export function addMoney(a: MoneyInput, b: MoneyInput): string {
  return toDecimal(a).plus(toDecimal(b)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function sumMoney(values: readonly MoneyInput[]): string {
  return values
    .reduce<Decimal>((acc, item) => acc.plus(toDecimal(item)), new Decimal(0))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2);
}

export function subMoney(a: MoneyInput, b: MoneyInput): string {
  return toDecimal(a).minus(toDecimal(b)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function mulMoney(amount: MoneyInput, factor: MoneyInput): string {
  return toDecimal(amount)
    .times(toDecimal(factor))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2);
}

export function percentageOf(baseAmount: MoneyInput, percent: MoneyInput): string {
  return toDecimal(baseAmount)
    .times(toDecimal(percent))
    .dividedBy(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2);
}

export function compareMoney(a: MoneyInput, b: MoneyInput): -1 | 0 | 1 {
  return toDecimal(money(a)).comparedTo(toDecimal(money(b))) as -1 | 0 | 1;
}

export function isPositiveMoney(value: MoneyInput): boolean {
  return compareMoney(value, "0.00") > 0;
}

export function isNonNegativeMoney(value: MoneyInput): boolean {
  return compareMoney(value, "0.00") >= 0;
}

/** Converts INR rupees to exact integer Razorpay paise (₹2,000.00 -> 200000). */
export function toPaise(inrAmount: MoneyInput): number {
  const paiseDecimal = toDecimal(money(inrAmount)).times(100);
  if (!paiseDecimal.isInteger()) {
    throw new Error(`Invalid sub-paisa precision for amount: ${inrAmount.toString()}`);
  }
  return paiseDecimal.toNumber();
}

/** Converts integer Razorpay paise to fixed 2-decimal INR string (149975 -> "1499.75"). */
export function fromPaise(paise: number | string): string {
  return toDecimal(paise).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

/** Formats INR using Indian lakh/crore grouping (₹1,25,000.50). */
export function formatInr(amount: MoneyInput): string {
  const normalized = money(amount);
  const isNeg = normalized.startsWith("-");
  const unsigned = isNeg ? normalized.slice(1) : normalized;
  const [intPart = "0", decPart = "00"] = unsigned.split(".");
  const lastThree = intPart.slice(-3);
  const otherNumbers = intPart.slice(0, -3);
  const grouped =
    otherNumbers !== ""
      ? `${otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${lastThree}`
      : lastThree;
  return `${isNeg ? "-" : ""}₹${grouped}.${decPart}`;
}

/**
 * Allocates a total amount proportionally across item weights, reconciling any
 * rounding remainder on the final element so SUM(allocations) === totalAmount.
 */
export function allocateProportional(
  totalAmount: MoneyInput,
  weights: readonly MoneyInput[],
): string[] {
  if (weights.length === 0) {
    return [];
  }
  const total = toDecimal(money(totalAmount));
  const decimalWeights = weights.map((w) => toDecimal(w));
  const weightSum = decimalWeights.reduce((acc, w) => acc.plus(w), new Decimal(0));
  if (weightSum.lte(0)) {
    throw new Error("Total allocation weight must be positive");
  }

  const shares: Decimal[] = [];
  let running = new Decimal(0);
  for (let i = 0; i < decimalWeights.length; i++) {
    if (i === decimalWeights.length - 1) {
      shares.push(total.minus(running).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
    } else {
      const weight = decimalWeights[i]!;
      const share = total
        .times(weight)
        .dividedBy(weightSum)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      shares.push(share);
      running = running.plus(share);
    }
  }
  return shares.map((s) => s.toFixed(2));
}

export interface GstCalculationInput {
  taxableAmount: MoneyInput;
  cgstRate: MoneyInput;
  sgstRate: MoneyInput;
  igstRate: MoneyInput;
  isExempt: boolean;
  issuerStateCode: string;
  placeOfSupplyStateCode?: string | null;
}

export interface GstBreakdown {
  cgstRate: string;
  cgstAmount: string;
  sgstRate: string;
  sgstAmount: string;
  igstRate: string;
  igstAmount: string;
  totalTax: string;
  lineTotal: string;
}

export function computeGstBreakdown(input: GstCalculationInput): GstBreakdown {
  const taxable = money(input.taxableAmount);
  if (input.isExempt) {
    return {
      cgstRate: "0.0000",
      cgstAmount: "0.00",
      sgstRate: "0.0000",
      sgstAmount: "0.00",
      igstRate: "0.0000",
      igstAmount: "0.00",
      totalTax: "0.00",
      lineTotal: taxable,
    };
  }

  const posState = (input.placeOfSupplyStateCode || input.issuerStateCode).trim();
  const isIntraState = posState === input.issuerStateCode.trim();

  if (isIntraState) {
    const cgstRateStr = rate(input.cgstRate);
    const sgstRateStr = rate(input.sgstRate);
    const cgstAmount = percentageOf(taxable, cgstRateStr);
    const sgstAmount = percentageOf(taxable, sgstRateStr);
    const totalTax = addMoney(cgstAmount, sgstAmount);
    return {
      cgstRate: cgstRateStr,
      cgstAmount,
      sgstRate: sgstRateStr,
      sgstAmount,
      igstRate: "0.0000",
      igstAmount: "0.00",
      totalTax,
      lineTotal: addMoney(taxable, totalTax),
    };
  }

  const igstRateStr = rate(input.igstRate);
  const igstAmount = percentageOf(taxable, igstRateStr);
  return {
    cgstRate: "0.0000",
    cgstAmount: "0.00",
    sgstRate: "0.0000",
    sgstAmount: "0.00",
    igstRate: igstRateStr,
    igstAmount,
    totalTax: igstAmount,
    lineTotal: addMoney(taxable, igstAmount),
  };
}
