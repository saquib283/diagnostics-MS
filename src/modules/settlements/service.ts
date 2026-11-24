import { z } from "zod";
import {
  CommercialModel,
  PartnerAdjustmentType,
  PartnerPaymentDirection,
  PartnerPayoutMethod,
  SettlementDirection,
} from "@prisma/client";
import { db } from "@/lib/db";
import { nextDocumentNumber } from "@/lib/db/sequences";
import { AppError } from "@/lib/errors";
import { compareMoney, isPositiveMoney, money } from "@/lib/money";
import { generateSettlementStatementPdf } from "@/lib/pdf/documents";
import {
  requireConsultancyPortal,
  requirePermission,
} from "@/lib/permissions/rbac";
import {
  assertPartnerOwnsRecord,
  requirePartnerScope,
} from "@/lib/permissions/scope";
import type { ActorContext } from "@/lib/permissions/types";
import { postJournalEntry } from "@/modules/accounting/service";
import { writeAuditLog } from "@/modules/audit/service";
import { toPartnerSettlementDTO } from "@/modules/partners/dto";
import {
  computeSettlementStatementTotals,
  filterSettlementEligibleItems,
} from "./eligibility";

export const createSettlementSchema = z.object({
  partnerId: z.string().uuid(),
  commercialModel: z.nativeEnum(CommercialModel),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  notes: z.string().max(1000).optional().nullable(),
});

export const allocateSettlementPaymentSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  paymentMethod: z.nativeEnum(PartnerPayoutMethod),
  utrOrReference: z.string().trim().min(3).max(120),
  paymentDate: z.coerce.date().optional(),
  notes: z.string().max(500).optional().nullable(),
});

export const addSettlementAdjustmentSchema = z.object({
  adjustmentType: z.nativeEnum(PartnerAdjustmentType),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  reason: z.string().trim().min(5).max(500),
});

export async function previewEligibleSettlementItems(
  actor: ActorContext,
  params: {
    partnerId: string;
    commercialModel: CommercialModel;
    periodStart: Date;
    periodEnd: Date;
  },
) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "settlements:prepare");

  const orgSettings = await db.organizationSettings.findFirst();
  const requireApproval =
    orgSettings?.requireConsultancyCompletionApproval ?? false;

  const endExclusive = new Date(params.periodEnd);
  endExclusive.setUTCHours(23, 59, 59, 999);

  const rawItems = await db.orderItem.findMany({
    where: {
      order: {
        partnerId: params.partnerId,
        paymentModel: params.commercialModel,
      },
      completedAt: {
        gte: params.periodStart,
        lte: endExclusive,
      },
    },
    include: {
      order: {
        select: {
          orderNumber: true,
          patient: { select: { fullName: true, patientCode: true } },
        },
      },
    },
    orderBy: { completedAt: "asc" },
  });

  const eligible = filterSettlementEligibleItems(
    rawItems.map((item) => ({
      ...item,
      partnerNetPayableSnapshot: item.partnerNetPayableSnapshot.toString(),
      commissionAmountSnapshot: item.commissionAmountSnapshot
        ? item.commissionAmountSnapshot.toString()
        : null,
    })),
    { requireConsultancyApproval: requireApproval },
  );

  return eligible;
}

export async function createPartnerSettlement(
  actor: ActorContext,
  rawInput: unknown,
) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "settlements:prepare");
  const input = createSettlementSchema.parse(rawInput);

  if (input.periodEnd < input.periodStart) {
    throw new AppError("BAD_REQUEST", "periodEnd must be on or after periodStart.", 400);
  }

  return db.$transaction(async (tx) => {
    const orgSettings = await tx.organizationSettings.findFirst();
    const requireCompletionApproval =
      orgSettings?.requireConsultancyCompletionApproval ?? false;
    const requireSettlementApproval =
      orgSettings?.requireSettlementApproval ?? true;

    const endExclusive = new Date(input.periodEnd);
    endExclusive.setUTCHours(23, 59, 59, 999);

    const candidateRows = await tx.orderItem.findMany({
      where: {
        order: {
          partnerId: input.partnerId,
          paymentModel: input.commercialModel,
        },
        status: "COMPLETED",
        settlementLockStatus: "UNSETTLED",
        completedAt: {
          gte: input.periodStart,
          lte: endExclusive,
        },
      },
      include: { order: true },
    });

    const eligible = filterSettlementEligibleItems(
      candidateRows.map((row) => ({
        ...row,
        partnerNetPayableSnapshot: row.partnerNetPayableSnapshot.toString(),
        commissionAmountSnapshot: row.commissionAmountSnapshot
          ? row.commissionAmountSnapshot.toString()
          : null,
      })),
      { requireConsultancyApproval: requireCompletionApproval },
    );

    if (eligible.length === 0) {
      throw new AppError(
        "BAD_REQUEST",
        "No unsettled COMPLETED test items found for this partner and period.",
        422,
      );
    }

    if (input.commercialModel === "MODEL_B_PATIENT_PAYS_PARTNER") {
      const missingCommission = eligible.find(
        (i) => i.commissionAmountSnapshot === null,
      );
      if (missingCommission) {
        throw new AppError(
          "POLICY_UNCONFIGURED",
          `Order item ${missingCommission.testCodeSnapshot} has UNCONFIGURED commission basis; confirm commission policy before generating Model B statement.`,
          422,
        );
      }
    }

    const direction: SettlementDirection =
      input.commercialModel === "MODEL_A_CONSULTANCY_COLLECTS"
        ? "PAYABLE_TO_PARTNER"
        : "RECEIVABLE_FROM_PARTNER";

    const itemAmounts = eligible.map((i) =>
      direction === "PAYABLE_TO_PARTNER"
        ? i.partnerNetPayableSnapshot
        : (i.commissionAmountSnapshot ?? "0.00"),
    );

    const totals = computeSettlementStatementTotals({
      itemAmounts,
      creditAdjustments: [],
      debitAdjustments: [],
      allocatedPayments: [],
    });

    const settlementNumber = await nextDocumentNumber(tx, "SETTLEMENT");
    const initialStatus = requireSettlementApproval
      ? "PENDING_APPROVAL"
      : "APPROVED";

    // Lock all selected order items so concurrent runs can never double-settle
    const lockedUpdate = await tx.orderItem.updateMany({
      where: {
        id: { in: eligible.map((i) => i.id) },
        settlementLockStatus: "UNSETTLED",
      },
      data: {
        settlementLockStatus:
          initialStatus === "APPROVED" ? "SETTLED" : "IN_SETTLEMENT",
      },
    });

    if (lockedUpdate.count !== eligible.length) {
      throw new AppError(
        "SETTLEMENT_LOCKED",
        "One or more order items were concurrently locked by another settlement statement.",
        409,
      );
    }

    const created = await tx.settlement.create({
      data: {
        settlementNumber,
        partnerId: input.partnerId,
        direction,
        commercialModel: input.commercialModel,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        status: initialStatus,
        grossEligibleAmount: totals.grossEligibleAmount,
        adjustmentsAmount: "0.00",
        taxAmount: "0.00",
        netAmount: totals.netAmount,
        settledAmount: "0.00",
        balanceAmount: totals.balanceAmount,
        preparedById: actor.userId,
        approvedById: initialStatus === "APPROVED" ? actor.userId : null,
        approvedAt: initialStatus === "APPROVED" ? new Date() : null,
        notes: input.notes || null,
        items: {
          create: eligible.map((item) => ({
            orderItemId: item.id,
            orderId: item.orderId,
            isActiveLock: true,
            testNameSnapshot: item.testNameSnapshot,
            completedAtSnapshot: item.completedAt ?? new Date(),
            baseAmount:
              direction === "PAYABLE_TO_PARTNER"
                ? item.partnerNetPayableSnapshot
                : item.taxableAmountSnapshot.toString(),
            commissionRateSnapshot: item.commissionPercentageSnapshot
              ? item.commissionPercentageSnapshot.toString()
              : null,
            settlementAmount:
              direction === "PAYABLE_TO_PARTNER"
                ? item.partnerNetPayableSnapshot
                : (item.commissionAmountSnapshot ?? "0.00"),
          })),
        },
      },
      include: { items: true, partner: true },
    });

    await writeAuditLog(tx, {
      actor,
      action: "SETTLEMENT_CREATED",
      entityType: "Settlement",
      entityId: created.id,
      after: {
        settlementNumber,
        direction,
        itemCount: eligible.length,
        netAmount: totals.netAmount,
      },
    });

    return created;
  });
}

export async function approvePartnerSettlement(
  actor: ActorContext,
  settlementId: string,
) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "settlements:approve");

  return db.$transaction(async (tx) => {
    const settlement = await tx.settlement.findUnique({
      where: { id: settlementId },
      include: { items: true },
    });
    if (!settlement) {
      throw new AppError("NOT_FOUND", "Settlement statement not found.", 404);
    }
    if (settlement.status !== "PENDING_APPROVAL" && settlement.status !== "DRAFT") {
      throw new AppError(
        "BAD_REQUEST",
        `Settlement in ${settlement.status} status cannot be approved.`,
        422,
      );
    }

    const updated = await tx.settlement.update({
      where: { id: settlementId },
      data: {
        status: "APPROVED",
        approvedById: actor.userId,
        approvedAt: new Date(),
      },
    });

    await tx.orderItem.updateMany({
      where: { id: { in: settlement.items.map((i) => i.orderItemId) } },
      data: { settlementLockStatus: "SETTLED" },
    });

    await writeAuditLog(tx, {
      actor,
      action: "SETTLEMENT_APPROVED",
      entityType: "Settlement",
      entityId: settlementId,
      after: { status: "APPROVED" },
    });

    return updated;
  });
}

export async function recordAndAllocateSettlementPayment(
  actor: ActorContext,
  settlementId: string,
  rawInput: unknown,
) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "settlements:pay");
  const input = allocateSettlementPaymentSchema.parse(rawInput);
  const amount = money(input.amount);

  if (!isPositiveMoney(amount)) {
    throw new AppError("BAD_REQUEST", "Allocation amount must exceed ₹0.00.", 400);
  }

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM settlements WHERE id = ${settlementId}::uuid FOR UPDATE`;

    const settlement = await tx.settlement.findUnique({
      where: { id: settlementId },
      include: {
        items: true,
        adjustments: true,
        paymentAllocations: true,
      },
    });

    if (!settlement) {
      throw new AppError("NOT_FOUND", "Settlement not found.", 404);
    }
    if (
      settlement.status !== "APPROVED" &&
      settlement.status !== "PARTIALLY_SETTLED"
    ) {
      throw new AppError(
        "BAD_REQUEST",
        `Settlement must be APPROVED before recording payments (current: ${settlement.status}).`,
        422,
      );
    }

    if (compareMoney(amount, settlement.balanceAmount.toString()) > 0) {
      throw new AppError(
        "OVERPAYMENT_NOT_ALLOWED",
        `Payment allocation (₹${amount}) exceeds settlement outstanding balance (₹${settlement.balanceAmount.toString()}).`,
        422,
      );
    }

    const paymentDirection: PartnerPaymentDirection =
      settlement.direction === "PAYABLE_TO_PARTNER"
        ? "OUTFLOW_TO_PARTNER"
        : "INFLOW_FROM_PARTNER";

    const partnerPayment = await tx.partnerPayment.create({
      data: {
        partnerId: settlement.partnerId,
        direction: paymentDirection,
        amount,
        unallocatedAmount: "0.00",
        paymentMethod: input.paymentMethod,
        utrOrReference: input.utrOrReference,
        paymentDate: input.paymentDate ?? new Date(),
        recordedById: actor.userId,
        notes: input.notes || null,
      },
    });

    await tx.paymentAllocation.create({
      data: {
        settlementId: settlement.id,
        partnerPaymentId: partnerPayment.id,
        allocatedAmount: amount,
        allocatedById: actor.userId,
      },
    });

    const totals = computeSettlementStatementTotals({
      itemAmounts: settlement.items.map((i) => i.settlementAmount.toString()),
      creditAdjustments: settlement.adjustments
        .filter((a) => a.adjustmentType === "CREDIT")
        .map((a) => a.amount.toString()),
      debitAdjustments: settlement.adjustments
        .filter((a) => a.adjustmentType === "DEBIT")
        .map((a) => a.amount.toString()),
      taxAmount: settlement.taxAmount.toString(),
      allocatedPayments: [
        ...settlement.paymentAllocations.map((pa) =>
          pa.allocatedAmount.toString(),
        ),
        amount,
      ],
    });

    const nextStatus =
      compareMoney(totals.balanceAmount, "0.00") === 0
        ? "SETTLED"
        : "PARTIALLY_SETTLED";

    const updatedSettlement = await tx.settlement.update({
      where: { id: settlement.id },
      data: {
        settledAmount: totals.settledAmount,
        balanceAmount: totals.balanceAmount,
        status: nextStatus,
      },
    });

    const bankOrCashAccount = input.paymentMethod === "CASH" ? "1100" : "1110";
    if (settlement.direction === "PAYABLE_TO_PARTNER") {
      // Model A payout: Debit Partner Payable (2100), Credit Bank/Cash
      await postJournalEntry(tx, {
        referenceType: "PartnerPayment",
        referenceId: partnerPayment.id,
        narration: `Partner payout allocated to ${settlement.settlementNumber} (UTR: ${input.utrOrReference})`,
        postedById: actor.userId,
        lines: [
          {
            accountCode: "2100",
            debitAmount: amount,
            creditAmount: "0.00",
            partnerId: settlement.partnerId,
          },
          {
            accountCode: bankOrCashAccount,
            debitAmount: "0.00",
            creditAmount: amount,
            partnerId: settlement.partnerId,
          },
        ],
      });
    } else {
      // Model B remittance received: Debit Bank/Cash, Credit Partner Commission Receivable (1210)
      await postJournalEntry(tx, {
        referenceType: "PartnerPayment",
        referenceId: partnerPayment.id,
        narration: `Partner commission remittance received for ${settlement.settlementNumber} (UTR: ${input.utrOrReference})`,
        postedById: actor.userId,
        lines: [
          {
            accountCode: bankOrCashAccount,
            debitAmount: amount,
            creditAmount: "0.00",
            partnerId: settlement.partnerId,
          },
          {
            accountCode: "1210",
            debitAmount: "0.00",
            creditAmount: amount,
            partnerId: settlement.partnerId,
          },
        ],
      });
    }

    await writeAuditLog(tx, {
      actor,
      action: "SETTLEMENT_PAYMENT_ALLOCATED",
      entityType: "Settlement",
      entityId: settlement.id,
      after: {
        settlementNumber: settlement.settlementNumber,
        allocatedAmount: amount,
        balanceAmount: totals.balanceAmount,
        status: nextStatus,
      },
    });

    return updatedSettlement;
  });
}

export async function reversePartnerSettlement(
  actor: ActorContext,
  settlementId: string,
  reason: string,
) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "settlements:reverse");
  if (!reason || reason.trim().length < 5) {
    throw new AppError("BAD_REQUEST", "Reversal reason must be at least 5 characters.", 400);
  }

  return db.$transaction(async (tx) => {
    const settlement = await tx.settlement.findUnique({
      where: { id: settlementId },
      include: { items: true, paymentAllocations: true },
    });
    if (!settlement) {
      throw new AppError("NOT_FOUND", "Settlement not found.", 404);
    }
    if (settlement.paymentAllocations.length > 0) {
      throw new AppError(
        "BAD_REQUEST",
        "Cannot reverse a settlement that already has allocated payments without reversing allocations first.",
        422,
      );
    }

    await tx.settlementItem.updateMany({
      where: { settlementId },
      data: { isActiveLock: false },
    });

    await tx.orderItem.updateMany({
      where: { id: { in: settlement.items.map((i) => i.orderItemId) } },
      data: { settlementLockStatus: "UNSETTLED" },
    });

    const reversed = await tx.settlement.update({
      where: { id: settlementId },
      data: {
        status: "REVERSED",
        reversalReason: reason.trim(),
        reversedAt: new Date(),
      },
    });

    await writeAuditLog(tx, {
      actor,
      action: "SETTLEMENT_REVERSED",
      entityType: "Settlement",
      entityId: settlementId,
      after: { status: "REVERSED", reason: reason.trim() },
    });

    return reversed;
  });
}

export async function listSettlements(actor: ActorContext) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "settlements:read");

  return db.settlement.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      partner: { select: { id: true, displayName: true, partnerCode: true } },
      _count: { select: { items: true, paymentAllocations: true } },
    },
  });
}

export async function getSettlementDetail(
  actor: ActorContext,
  settlementId: string,
) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "settlements:read");

  const row = await db.settlement.findUnique({
    where: { id: settlementId },
    include: {
      partner: true,
      items: {
        include: {
          order: { select: { orderNumber: true } },
        },
      },
      paymentAllocations: {
        include: { partnerPayment: true },
        orderBy: { createdAt: "desc" },
      },
      adjustments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!row) {
    throw new AppError("NOT_FOUND", "Settlement not found.", 404);
  }
  return row;
}

export async function listPartnerPortalSettlements(actor: ActorContext) {
  const scope = requirePartnerScope(actor);
  requirePermission(actor, "partner:settlements:read");

  const rows = await db.settlement.findMany({
    where: { partnerId: { in: [...scope.partnerIds] } },
    orderBy: { periodEnd: "desc" },
  });

  return rows.map(toPartnerSettlementDTO);
}

export async function addPartnerSettlementAdjustment(
  actor: ActorContext,
  settlementId: string,
  rawInput: unknown,
) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "settlements:approve");
  const input = addSettlementAdjustmentSchema.parse(rawInput);
  const amount = money(input.amount);

  if (!isPositiveMoney(amount)) {
    throw new AppError("BAD_REQUEST", "Adjustment amount must exceed ₹0.00.", 400);
  }

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM settlements WHERE id = ${settlementId}::uuid FOR UPDATE`;

    const settlement = await tx.settlement.findUnique({
      where: { id: settlementId },
      include: { items: true, adjustments: true, paymentAllocations: true },
    });
    if (!settlement) {
      throw new AppError("NOT_FOUND", "Settlement statement not found.", 404);
    }
    if (
      settlement.status === "SETTLED" ||
      settlement.status === "REVERSED" ||
      settlement.status === "CANCELLED"
    ) {
      throw new AppError(
        "BAD_REQUEST",
        `Cannot add adjustments to a ${settlement.status} settlement.`,
        422,
      );
    }

    const adj = await tx.partnerAdjustment.create({
      data: {
        settlementId: settlement.id,
        partnerId: settlement.partnerId,
        adjustmentType: input.adjustmentType,
        amount,
        reason: input.reason,
        approvedById: actor.userId,
      },
    });

    const allAdjustments = [...settlement.adjustments, adj];
    const totals = computeSettlementStatementTotals({
      itemAmounts: settlement.items.map((i) => i.settlementAmount.toString()),
      creditAdjustments: allAdjustments
        .filter((a) => a.adjustmentType === "CREDIT")
        .map((a) => a.amount.toString()),
      debitAdjustments: allAdjustments
        .filter((a) => a.adjustmentType === "DEBIT")
        .map((a) => a.amount.toString()),
      taxAmount: settlement.taxAmount.toString(),
      allocatedPayments: settlement.paymentAllocations.map((pa) =>
        pa.allocatedAmount.toString(),
      ),
    });

    await tx.settlement.update({
      where: { id: settlementId },
      data: {
        adjustmentsAmount: totals.adjustmentsAmount,
        netAmount: totals.netAmount,
        balanceAmount: totals.balanceAmount,
      },
    });

    await writeAuditLog(tx, {
      actor,
      action: "SETTLEMENT_ADJUSTMENT_ADDED",
      entityType: "PartnerAdjustment",
      entityId: adj.id,
      after: {
        settlementNumber: settlement.settlementNumber,
        adjustmentType: input.adjustmentType,
        amount,
        reason: input.reason,
      },
    });

    return adj;
  });
}

export async function getSettlementPdfBuffer(
  actor: ActorContext,
  settlementId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  if (actor.portalType === "PARTNER") {
    requirePermission(actor, "partner:settlements:read");
  } else {
    requirePermission(actor, "settlements:read");
  }

  const [org, settlement] = await Promise.all([
    db.organization.findFirst(),
    db.settlement.findUnique({
      where: { id: settlementId },
      include: {
        partner: true,
        items: { include: { order: { select: { orderNumber: true } } } },
      },
    }),
  ]);

  if (!settlement) {
    throw new AppError("NOT_FOUND", "Settlement statement not found.", 404);
  }

  if (actor.portalType === "PARTNER") {
    const scope = requirePartnerScope(actor);
    assertPartnerOwnsRecord(scope, settlement.partnerId);
  }

  const buffer = await generateSettlementStatementPdf({
    settlementNumber: settlement.settlementNumber,
    direction: settlement.direction,
    status: settlement.status,
    periodStart: settlement.periodStart,
    periodEnd: settlement.periodEnd,
    issuerLegalName: org?.legalName ?? "Diagnostic Consultancy",
    partnerName: settlement.partner.displayName,
    partnerCode: settlement.partner.partnerCode,
    items: settlement.items.map((i) => ({
      orderNumber: i.order.orderNumber,
      testName: i.testNameSnapshot,
      completedAt: i.completedAtSnapshot,
      baseAmount: money(i.baseAmount),
      commissionRate: i.commissionRateSnapshot?.toString() ?? null,
      settlementAmount: money(i.settlementAmount),
    })),
    grossEligibleAmount: money(settlement.grossEligibleAmount),
    adjustmentsAmount: money(settlement.adjustmentsAmount),
    netAmount: money(settlement.netAmount),
    settledAmount: money(settlement.settledAmount),
    balanceAmount: money(settlement.balanceAmount),
  });

  return { buffer, filename: `${settlement.settlementNumber}.pdf` };
}

