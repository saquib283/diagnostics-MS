import type { OrderItemStatus, SettlementLockStatus } from "@prisma/client";
import {
  addMoney,
  subMoney,
  sumMoney,
  type MoneyInput,
} from "@/lib/money";

export interface SettlementCandidateItem {
  id: string;
  status: OrderItemStatus;
  settlementLockStatus: SettlementLockStatus;
  completionApprovedAt: Date | null;
  partnerNetPayableSnapshot: MoneyInput;
  commissionAmountSnapshot: MoneyInput | null;
}

/**
 * Enforces mandatory DCMS settlement eligibility rule:
 * 1. Item status MUST be strictly COMPLETED (never PENDING, CONFIRMED, IN_PROGRESS, CANCELLED, UNABLE_TO_PERFORM).
 * 2. Item MUST be UNSETTLED (never IN_SETTLEMENT or SETTLED).
 * 3. If requireConsultancyApproval policy is enabled, completionApprovedAt MUST be present.
 */
export function filterSettlementEligibleItems<T extends SettlementCandidateItem>(
  items: readonly T[],
  policy: { requireConsultancyApproval: boolean },
): T[] {
  return items.filter((item) => {
    if (item.status !== "COMPLETED") {
      return false;
    }
    if (item.settlementLockStatus !== "UNSETTLED") {
      return false;
    }
    if (policy.requireConsultancyApproval && !item.completionApprovedAt) {
      return false;
    }
    return true;
  });
}

export function computeSettlementStatementTotals(params: {
  itemAmounts: readonly MoneyInput[];
  creditAdjustments: readonly MoneyInput[];
  debitAdjustments: readonly MoneyInput[];
  taxAmount?: MoneyInput;
  allocatedPayments: readonly MoneyInput[];
}) {
  const grossEligibleAmount = sumMoney(params.itemAmounts);
  const credits = sumMoney(params.creditAdjustments);
  const debits = sumMoney(params.debitAdjustments);
  const adjustmentsAmount = subMoney(credits, debits);
  const tax = params.taxAmount ?? "0.00";
  const netAmount = addMoney(
    addMoney(grossEligibleAmount, adjustmentsAmount),
    tax,
  );
  const settledAmount = sumMoney(params.allocatedPayments);
  const balanceAmount = subMoney(netAmount, settledAmount);

  return {
    grossEligibleAmount,
    adjustmentsAmount,
    netAmount,
    settledAmount,
    balanceAmount,
  };
}

