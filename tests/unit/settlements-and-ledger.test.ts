import { describe, expect, it } from "vitest";
import {
  filterSettlementEligibleItems,
  computeSettlementStatementTotals,
} from "@/modules/settlements/eligibility";
import { validateBalancedJournalLines } from "@/modules/accounting/ledger-math";
import { aggregateConsultancyCollections } from "@/modules/analytics/collection-aggregator";

describe("Settlement Eligibility, Duplicate Lock, Commission Separation & Balanced Journal", () => {
  it("selects strictly COMPLETED, unlocked items and enforces optional consultancy completion approval", () => {
    const candidateItems = [
      {
        id: "item-completed-ok",
        status: "COMPLETED" as const,
        settlementLockStatus: "UNSETTLED" as const,
        completionApprovedAt: new Date("2026-11-24T09:00:00Z"),
        partnerNetPayableSnapshot: "1400.00",
        commissionAmountSnapshot: null,
      },
      {
        id: "item-completed-unapproved",
        status: "COMPLETED" as const,
        settlementLockStatus: "UNSETTLED" as const,
        completionApprovedAt: null,
        partnerNetPayableSnapshot: "800.00",
        commissionAmountSnapshot: null,
      },
      {
        id: "item-already-settled",
        status: "COMPLETED" as const,
        settlementLockStatus: "SETTLED" as const,
        completionApprovedAt: new Date("2026-11-24T09:00:00Z"),
        partnerNetPayableSnapshot: "1400.00",
        commissionAmountSnapshot: null,
      },
      {
        id: "item-in-progress",
        status: "IN_PROGRESS" as const,
        settlementLockStatus: "UNSETTLED" as const,
        completionApprovedAt: null,
        partnerNetPayableSnapshot: "900.00",
        commissionAmountSnapshot: null,
      },
      {
        id: "item-cancelled",
        status: "CANCELLED" as const,
        settlementLockStatus: "UNSETTLED" as const,
        completionApprovedAt: null,
        partnerNetPayableSnapshot: "500.00",
        commissionAmountSnapshot: null,
      },
    ];

    const withoutApprovalPolicy = filterSettlementEligibleItems(candidateItems, {
      requireConsultancyApproval: false,
    });
    expect(withoutApprovalPolicy.map((i) => i.id)).toEqual([
      "item-completed-ok",
      "item-completed-unapproved",
    ]);

    const withApprovalPolicy = filterSettlementEligibleItems(candidateItems, {
      requireConsultancyApproval: true,
    });
    expect(withApprovalPolicy.map((i) => i.id)).toEqual(["item-completed-ok"]);
  });

  it("computes Model A payable and Model B commission statements with adjustments and partial allocations", () => {
    const totals = computeSettlementStatementTotals({
      itemAmounts: ["1400.00", "600.00"],
      creditAdjustments: ["100.00"],
      debitAdjustments: ["250.00"],
      taxAmount: "0.00",
      allocatedPayments: ["1000.00"],
    });

    expect(totals).toEqual({
      grossEligibleAmount: "2000.00",
      adjustmentsAmount: "-150.00",
      netAmount: "1850.00",
      settledAmount: "1000.00",
      balanceAmount: "850.00",
    });
  });

  it("excludes Model B direct partner collections from consultancy cash and bank collection totals", () => {
    const summary = aggregateConsultancyCollections({
      patientPayments: [
        { method: "CASH", status: "SUCCESS", amount: "2000.00" },
        { method: "UPI_QR", status: "SUCCESS", amount: "2000.00" },
        { method: "CARD", status: "SUCCESS", amount: "1000.00" },
        { method: "CARD", status: "PENDING", amount: "999.00" },
      ],
      modelBDirectCollections: [
        { amount: "4500.00" }, // Paid directly to partner — MUST NOT inflate consultancy cash/bank
      ],
    });

    expect(summary.cashCollected).toBe("2000.00");
    expect(summary.razorpayCollected).toBe("3000.00");
    expect(summary.totalConsultancyCollections).toBe("5000.00");
    expect(summary.partnerDirectCollectionsTrackedSeparately).toBe("4500.00");
  });

  it("enforces balanced double-entry journal lines (SUM(debit) === SUM(credit) > 0)", () => {
    expect(() =>
      validateBalancedJournalLines([
        { accountCode: "1100", debitAmount: "2000.00", creditAmount: "0.00" },
        { accountCode: "1200", debitAmount: "0.00", creditAmount: "2000.00" },
      ]),
    ).not.toThrow();

    expect(() =>
      validateBalancedJournalLines([
        { accountCode: "1100", debitAmount: "2000.00", creditAmount: "0.00" },
        { accountCode: "1200", debitAmount: "0.00", creditAmount: "1999.99" },
      ]),
    ).toThrow(/UNBALANCED_JOURNAL/);
  });
});

