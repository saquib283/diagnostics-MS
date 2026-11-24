import type { CommissionCalculationBasis } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { percentageOf, type MoneyInput } from "@/lib/money";

export interface EffectiveWindow {
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

function toDayTimestamp(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function hasEffectiveWindowOverlap(
  a: EffectiveWindow,
  b: EffectiveWindow,
): boolean {
  const aStart = toDayTimestamp(a.effectiveFrom);
  const aEnd = a.effectiveTo ? toDayTimestamp(a.effectiveTo) : Number.POSITIVE_INFINITY;
  const bStart = toDayTimestamp(b.effectiveFrom);
  const bEnd = b.effectiveTo ? toDayTimestamp(b.effectiveTo) : Number.POSITIVE_INFINITY;

  if (aEnd < aStart || bEnd < bStart) {
    throw new AppError(
      "BAD_REQUEST",
      "effectiveTo cannot be earlier than effectiveFrom.",
      400,
    );
  }

  return aStart <= bEnd && bStart <= aEnd;
}

export function selectEffectiveRecord<
  T extends EffectiveWindow & { isActive: boolean },
>(records: readonly T[], onDate: Date): T | null {
  const target = toDayTimestamp(onDate);
  const matching = records.filter((rec) => {
    if (!rec.isActive) return false;
    const start = toDayTimestamp(rec.effectiveFrom);
    const end = rec.effectiveTo
      ? toDayTimestamp(rec.effectiveTo)
      : Number.POSITIVE_INFINITY;
    return target >= start && target <= end;
  });

  if (matching.length === 0) {
    return null;
  }

  matching.sort(
    (x, y) => toDayTimestamp(y.effectiveFrom) - toDayTimestamp(x.effectiveFrom),
  );
  return matching[0] ?? null;
}

export function calculateModelBCommission(params: {
  grossBeforeDiscountExclTax: MoneyInput;
  netAfterDiscountExclTax: MoneyInput;
  netInclTax: MoneyInput;
  commissionPercentage: MoneyInput;
  basis: CommissionCalculationBasis;
}): string {
  switch (params.basis) {
    case "UNCONFIGURED":
      throw new AppError(
        "POLICY_UNCONFIGURED",
        "Model B commission calculation basis is UNCONFIGURED. Product Owner/CA must configure the contractual commission basis in Organization Settings or Partner Contract before computing live commissions.",
        422,
      );
    case "NET_AFTER_DISCOUNT_EXCL_TAX":
      return percentageOf(
        params.netAfterDiscountExclTax,
        params.commissionPercentage,
      );
    case "GROSS_BEFORE_DISCOUNT_EXCL_TAX":
      return percentageOf(
        params.grossBeforeDiscountExclTax,
        params.commissionPercentage,
      );
    case "NET_INCL_TAX":
      return percentageOf(params.netInclTax, params.commissionPercentage);
  }
}

