import type {
  CommercialModel,
  CommissionCalculationBasis,
  OrderItemStatus,
  OrderStatus,
} from "@prisma/client";
import { AppError } from "@/lib/errors";
import {
  addMoney,
  compareMoney,
  computeGstBreakdown,
  money,
  mulMoney,
  rate,
  subMoney,
  sumMoney,
  type MoneyInput,
} from "@/lib/money";
import { calculateModelBCommission } from "@/modules/partners/pricing-engine";

const ALLOWED_ITEM_TRANSITIONS: Record<
  OrderItemStatus,
  readonly OrderItemStatus[]
> = {
  PENDING: ["CONFIRMED", "IN_PROGRESS", "CANCELLED", "UNABLE_TO_PERFORM"],
  CONFIRMED: ["IN_PROGRESS", "COMPLETED", "CANCELLED", "UNABLE_TO_PERFORM"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED", "UNABLE_TO_PERFORM"],
  COMPLETED: [],
  CANCELLED: [],
  UNABLE_TO_PERFORM: [],
};

export function assertValidOrderItemTransition(
  currentStatus: OrderItemStatus,
  nextStatus: OrderItemStatus,
): void {
  if (currentStatus === nextStatus) {
    throw new AppError(
      "BAD_REQUEST",
      `Order item is already in status ${currentStatus}.`,
      400,
    );
  }
  const permitted = ALLOWED_ITEM_TRANSITIONS[currentStatus] ?? [];
  if (!permitted.includes(nextStatus)) {
    throw new AppError(
      "BAD_REQUEST",
      `Invalid order item status transition from ${currentStatus} to ${nextStatus}.`,
      400,
    );
  }
}

export function deriveOrderStatus(
  itemStatuses: readonly OrderItemStatus[],
): OrderStatus {
  if (itemStatuses.length === 0) {
    return "PENDING";
  }

  const active = itemStatuses.filter(
    (s) => s !== "CANCELLED" && s !== "UNABLE_TO_PERFORM",
  );

  if (active.length === 0) {
    return "CANCELLED";
  }

  const completedCount = active.filter((s) => s === "COMPLETED").length;
  if (completedCount === active.length) {
    return "COMPLETED";
  }
  if (completedCount > 0) {
    return "PARTIALLY_COMPLETED";
  }
  if (active.some((s) => s === "IN_PROGRESS")) {
    return "IN_PROGRESS";
  }
  if (active.some((s) => s === "CONFIRMED")) {
    return "CONFIRMED";
  }
  return "PENDING";
}

export interface OrderSnapshotLineInput {
  test: {
    id: string;
    code: string;
    name: string;
    defaultSellingPrice: MoneyInput;
    hsnSacCode?: string | null;
    taxCode?: string | null;
    cgstRate: MoneyInput;
    sgstRate: MoneyInput;
    igstRate: MoneyInput;
    isExempt: boolean;
  };
  sourcePackageId?: string | null;
  unitSellingPriceOverride?: MoneyInput;
  quantity: number;
  discountAmount?: MoneyInput;
  partnerUnitPrice: MoneyInput;
  commissionPercentage?: MoneyInput | null;
  commissionBasis?: CommissionCalculationBasis | null;
}

export interface BuiltOrderItemSnapshot {
  testId: string;
  sourcePackageId: string | null;
  testCodeSnapshot: string;
  testNameSnapshot: string;
  hsnSacSnapshot: string | null;
  quantity: number;
  unitSellingPriceSnapshot: string;
  discountAmountSnapshot: string;
  taxableAmountSnapshot: string;
  taxCodeSnapshot: string | null;
  cgstRateSnapshot: string;
  sgstRateSnapshot: string;
  igstRateSnapshot: string;
  taxAmountSnapshot: string;
  netSellingAmountSnapshot: string;
  partnerUnitPriceSnapshot: string;
  partnerNetPayableSnapshot: string;
  commissionPercentageSnapshot: string | null;
  commissionBasisSnapshot: CommissionCalculationBasis | null;
  commissionAmountSnapshot: string | null;
}

export function buildOrderItemsSnapshot(params: {
  paymentModel: CommercialModel;
  issuerStateCode: string;
  placeOfSupplyStateCode?: string | null;
  lines: readonly OrderSnapshotLineInput[];
}) {
  if (params.lines.length === 0) {
    throw new AppError(
      "BAD_REQUEST",
      "Diagnostic order must contain at least one test item.",
      400,
    );
  }

  const items: BuiltOrderItemSnapshot[] = params.lines.map((line) => {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new AppError("BAD_REQUEST", "Quantity must be a positive integer.", 400);
    }

    const unitSelling = money(
      line.unitSellingPriceOverride ?? line.test.defaultSellingPrice,
    );
    const grossSelling = mulMoney(unitSelling, line.quantity);
    const discount = money(line.discountAmount ?? "0.00");

    if (compareMoney(discount, grossSelling) > 0) {
      throw new AppError(
        "BAD_REQUEST",
        `Discount (${discount}) cannot exceed line gross amount (${grossSelling}).`,
        400,
      );
    }

    const taxable = subMoney(grossSelling, discount);
    const gst = computeGstBreakdown({
      taxableAmount: taxable,
      cgstRate: line.test.cgstRate,
      sgstRate: line.test.sgstRate,
      igstRate: line.test.igstRate,
      isExempt: line.test.isExempt,
      issuerStateCode: params.issuerStateCode,
      placeOfSupplyStateCode: params.placeOfSupplyStateCode,
    });

    const partnerUnit = money(line.partnerUnitPrice);
    const partnerPayable =
      params.paymentModel === "MODEL_A_CONSULTANCY_COLLECTS"
        ? mulMoney(partnerUnit, line.quantity)
        : "0.00";

    let commPct: string | null = null;
    let commBasis: CommissionCalculationBasis | null = null;
    let commAmount: string | null = null;

    if (params.paymentModel === "MODEL_B_PATIENT_PAYS_PARTNER") {
      commPct = rate(line.commissionPercentage ?? "0.0000");
      commBasis = line.commissionBasis ?? "UNCONFIGURED";
      if (commBasis !== "UNCONFIGURED") {
        commAmount = calculateModelBCommission({
          grossBeforeDiscountExclTax: grossSelling,
          netAfterDiscountExclTax: taxable,
          netInclTax: gst.lineTotal,
          commissionPercentage: commPct,
          basis: commBasis,
        });
      }
    }

    return {
      testId: line.test.id,
      sourcePackageId: line.sourcePackageId ?? null,
      testCodeSnapshot: String(line.test.code),
      testNameSnapshot: String(line.test.name),
      hsnSacSnapshot: line.test.hsnSacCode ? String(line.test.hsnSacCode) : null,
      quantity: line.quantity,
      unitSellingPriceSnapshot: unitSelling,
      discountAmountSnapshot: discount,
      taxableAmountSnapshot: taxable,
      taxCodeSnapshot: line.test.taxCode ? String(line.test.taxCode) : null,
      cgstRateSnapshot: gst.cgstRate,
      sgstRateSnapshot: gst.sgstRate,
      igstRateSnapshot: gst.igstRate,
      taxAmountSnapshot: gst.totalTax,
      netSellingAmountSnapshot: gst.lineTotal,
      partnerUnitPriceSnapshot: partnerUnit,
      partnerNetPayableSnapshot: partnerPayable,
      commissionPercentageSnapshot: commPct,
      commissionBasisSnapshot: commBasis,
      commissionAmountSnapshot: commAmount,
    };
  });

  const subtotalSelling = sumMoney(
    items.map((i) => mulMoney(i.unitSellingPriceSnapshot, i.quantity)),
  );
  const discountTotal = sumMoney(items.map((i) => i.discountAmountSnapshot));
  const taxTotal = sumMoney(items.map((i) => i.taxAmountSnapshot));
  const netSellingTotal = sumMoney(items.map((i) => i.netSellingAmountSnapshot));
  const partnerPayableEstimate = sumMoney(
    items.map((i) => i.partnerNetPayableSnapshot),
  );
  const commissionEstimate = sumMoney(
    items.map((i) => i.commissionAmountSnapshot ?? "0.00"),
  );

  return {
    items,
    subtotalSelling,
    discountTotal,
    taxTotal,
    netSellingTotal: addMoney("0.00", netSellingTotal),
    partnerPayableEstimate,
    commissionEstimate,
  };
}

