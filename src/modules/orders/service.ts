import { z } from "zod";
import {
  CommercialModel,
  OrderItemStatus,
  OrderStatus,
  Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";
import { nextDocumentNumber } from "@/lib/db/sequences";
import { AppError } from "@/lib/errors";
import { allocateProportional, isPositiveMoney } from "@/lib/money";
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
import { toPartnerOrderDTO } from "@/modules/partners/dto";
import { selectEffectiveRecord } from "@/modules/partners/pricing-engine";
import {
  assertValidOrderItemTransition,
  buildOrderItemsSnapshot,
  deriveOrderStatus,
  type OrderSnapshotLineInput,
} from "./state-machine";

export const createOrderSchema = z.object({
  patientId: z.string().uuid("Select a valid patient."),
  partnerId: z.string().uuid("Select a valid partner diagnostic centre."),
  paymentModel: z.nativeEnum(CommercialModel),
  referringDoctor: z.string().trim().max(160).optional().nullable(),
  clinicalNotes: z.string().trim().max(2000).optional().nullable(),
  internalNotes: z.string().trim().max(2000).optional().nullable(),
  scheduledAt: z.coerce.date().optional().nullable(),
  items: z
    .array(
      z
        .object({
          testId: z.string().uuid().optional().nullable(),
          packageId: z.string().uuid().optional().nullable(),
          quantity: z.coerce.number().int().positive().default(1),
          discountAmount: z
            .string()
            .regex(/^\d+(\.\d{1,2})?$/)
            .default("0.00"),
        })
        .refine((v) => Boolean(v.testId) !== Boolean(v.packageId), {
          message: "Specify exactly one of testId or packageId per line.",
        }),
    )
    .min(1, "Add at least one test or package to the order."),
});

export const transitionOrderItemSchema = z.object({
  newStatus: z.nativeEnum(OrderItemStatus),
  reason: z.string().trim().max(500).optional().nullable(),
});

export async function listOrders(
  actor: ActorContext,
  params: {
    partnerId?: string;
    patientId?: string;
    status?: OrderStatus;
    paymentModel?: CommercialModel;
    page?: number;
    pageSize?: number;
  },
) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "orders:read");

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));

  const where: Prisma.DiagnosticOrderWhereInput = {
    ...(params.partnerId ? { partnerId: params.partnerId } : {}),
    ...(params.patientId ? { patientId: params.patientId } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.paymentModel ? { paymentModel: params.paymentModel } : {}),
  };

  const [totalItems, items] = await Promise.all([
    db.diagnosticOrder.count({ where }),
    db.diagnosticOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        patient: { select: { id: true, patientCode: true, fullName: true, mobile: true } },
        partner: { select: { id: true, partnerCode: true, displayName: true } },
        items: { select: { id: true, testNameSnapshot: true, status: true } },
        invoice: { select: { id: true, invoiceNumber: true, status: true, balanceDue: true } },
        partnerInvoiceReference: { select: { id: true, partnerInvoiceNumber: true } },
      },
    }),
  ]);

  return { items, page, pageSize, totalItems };
}

export async function getOrderDetail(actor: ActorContext, orderId: string) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "orders:read");

  const order = await db.diagnosticOrder.findUnique({
    where: { id: orderId },
    include: {
      patient: true,
      partner: true,
      contract: true,
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          reportTracking: true,
          reportFiles: { orderBy: { versionNumber: "desc" } },
        },
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { fullName: true, portalType: true } } },
      },
      invoice: {
        include: {
          payments: { orderBy: { paymentDate: "desc" } },
          receipts: true,
        },
      },
      partnerInvoiceReference: true,
    },
  });

  if (!order) {
    throw new AppError("NOT_FOUND", "Diagnostic order not found.", 404);
  }
  return order;
}

export async function createDiagnosticOrder(
  actor: ActorContext,
  rawInput: unknown,
) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "orders:create");
  const input = createOrderSchema.parse(rawInput);
  const now = new Date();

  return db.$transaction(async (tx) => {
    const [org, patient, partner] = await Promise.all([
      tx.organization.findFirst({ include: { settings: true } }),
      tx.patient.findUnique({ where: { id: input.patientId } }),
      tx.partner.findUnique({
        where: { id: input.partnerId },
        include: {
          contracts: { where: { status: "ACTIVE" } },
          testPrices: { where: { isActive: true } },
          commissionRates: { where: { isActive: true } },
        },
      }),
    ]);

    if (!org || !org.settings) {
      throw new AppError("POLICY_UNCONFIGURED", "Organization profile not initialized.", 500);
    }
    if (!patient || !patient.isActive) {
      throw new AppError("NOT_FOUND", "Active patient not found.", 404);
    }
    if (!partner || partner.status !== "ACTIVE") {
      throw new AppError("BAD_REQUEST", "Selected partner diagnostic centre is not active.", 422);
    }

    const activeContract = selectEffectiveRecord(
      partner.contracts.map((c) => ({ ...c, isActive: c.status === "ACTIVE" })),
      now,
    );

    if (activeContract) {
      if (
        activeContract.allowedModels === "MODEL_A_ONLY" &&
        input.paymentModel !== "MODEL_A_CONSULTANCY_COLLECTS"
      ) {
        throw new AppError(
          "BAD_REQUEST",
          "Partner contract permits only Model A (Consultancy Collects).",
          422,
        );
      }
      if (
        activeContract.allowedModels === "MODEL_B_ONLY" &&
        input.paymentModel !== "MODEL_B_PATIENT_PAYS_PARTNER"
      ) {
        throw new AppError(
          "BAD_REQUEST",
          "Partner contract permits only Model B (Patient Pays Partner).",
          422,
        );
      }
    }

    const gstEnabled = org.settings.gstEnabled;
    const snapshotLines: OrderSnapshotLineInput[] = [];

    const resolveLineForTest = (
      testRow: {
        id: string;
        code: string;
        name: string;
        defaultSellingPrice: { toString(): string };
        isActive: boolean;
        taxCode: {
          code: string;
          hsnSacCode: string;
          cgstRate: { toString(): string };
          sgstRate: { toString(): string };
          igstRate: { toString(): string };
          isExempt: boolean;
        } | null;
      },
      opts: {
        quantity: number;
        discountAmount: string;
        sourcePackageId?: string | null;
        unitSellingOverride?: string;
      },
    ): OrderSnapshotLineInput => {
      if (!testRow.isActive) {
        throw new AppError(
          "BAD_REQUEST",
          `Test ${testRow.code} (${testRow.name}) is inactive and cannot be added to new orders.`,
          422,
        );
      }

      const partnerPriceCandidates = partner.testPrices.filter(
        (p) => p.testId === testRow.id,
      );
      const effectivePartnerPrice = selectEffectiveRecord(
        partnerPriceCandidates,
        now,
      );

      if (effectivePartnerPrice && !effectivePartnerPrice.isPerformed) {
        throw new AppError(
          "BAD_REQUEST",
          `Partner ${partner.displayName} is marked as not performing test ${testRow.code}.`,
          422,
        );
      }

      if (
        input.paymentModel === "MODEL_A_CONSULTANCY_COLLECTS" &&
        !effectivePartnerPrice
      ) {
        throw new AppError(
          "BAD_REQUEST",
          `No active negotiated partner price configured for ${partner.displayName} on test ${testRow.code}.`,
          422,
        );
      }

      // Commission lookup for Model B: test-specific override -> partner-wide default
      let commPct: string | null = null;
      let commBasis =
        activeContract?.commissionBasis &&
        activeContract.commissionBasis !== "UNCONFIGURED"
          ? activeContract.commissionBasis
          : org.settings!.defaultCommissionBasis;

      if (input.paymentModel === "MODEL_B_PATIENT_PAYS_PARTNER") {
        const testSpecificComm = selectEffectiveRecord(
          partner.commissionRates.filter((r) => r.testId === testRow.id),
          now,
        );
        const defaultComm = selectEffectiveRecord(
          partner.commissionRates.filter((r) => r.testId === null),
          now,
        );
        const chosenComm = testSpecificComm ?? defaultComm;
        if (!chosenComm) {
          throw new AppError(
            "BAD_REQUEST",
            `No active commission rate configured for partner ${partner.displayName} (test ${testRow.code}).`,
            422,
          );
        }
        commPct = chosenComm.commissionPercentage.toString();
        if (chosenComm.calculationBasis !== "UNCONFIGURED") {
          commBasis = chosenComm.calculationBasis;
        }
      }

      const tax = gstEnabled ? testRow.taxCode : null;

      return {
        test: {
          id: testRow.id,
          code: testRow.code,
          name: testRow.name,
          defaultSellingPrice: testRow.defaultSellingPrice.toString(),
          hsnSacCode: tax?.hsnSacCode ?? null,
          taxCode: tax?.code ?? null,
          cgstRate: tax ? tax.cgstRate.toString() : "0.0000",
          sgstRate: tax ? tax.sgstRate.toString() : "0.0000",
          igstRate: tax ? tax.igstRate.toString() : "0.0000",
          isExempt: tax ? tax.isExempt : true,
        },
        sourcePackageId: opts.sourcePackageId ?? null,
        unitSellingPriceOverride: opts.unitSellingOverride,
        quantity: opts.quantity,
        discountAmount: opts.discountAmount,
        partnerUnitPrice: effectivePartnerPrice
          ? effectivePartnerPrice.agreedPurchasePrice.toString()
          : "0.00",
        commissionPercentage: commPct,
        commissionBasis: commBasis,
      };
    };

    for (const reqItem of input.items) {
      if (reqItem.testId) {
        const testRow = await tx.test.findUnique({
          where: { id: reqItem.testId },
          include: { taxCode: true },
        });
        if (!testRow) {
          throw new AppError("NOT_FOUND", "Selected test not found.", 404);
        }
        snapshotLines.push(
          resolveLineForTest(testRow, {
            quantity: reqItem.quantity,
            discountAmount: reqItem.discountAmount,
          }),
        );
      } else if (reqItem.packageId) {
        const pkg = await tx.testPackage.findUnique({
          where: { id: reqItem.packageId },
          include: {
            taxCode: true,
            items: { include: { test: { include: { taxCode: true } } } },
          },
        });
        if (!pkg || !pkg.isActive) {
          throw new AppError("BAD_REQUEST", "Selected package is not active.", 422);
        }

        const weights = pkg.items.map((pi) => pi.allocationWeight.toString());
        const allocatedPrices = allocateProportional(
          pkg.defaultSellingPrice.toString(),
          weights,
        );
        const allocatedDiscounts = allocateProportional(
          reqItem.discountAmount,
          weights,
        );

        pkg.items.forEach((pkgItem, idx) => {
          snapshotLines.push(
            resolveLineForTest(pkgItem.test, {
              quantity: pkgItem.quantity * reqItem.quantity,
              discountAmount: allocatedDiscounts[idx] ?? "0.00",
              sourcePackageId: pkg.id,
              unitSellingOverride: allocatedPrices[idx],
            }),
          );
        });
      }
    }

    const built = buildOrderItemsSnapshot({
      paymentModel: input.paymentModel,
      issuerStateCode: org.stateCode,
      placeOfSupplyStateCode: partner.stateCode,
      lines: snapshotLines,
    });

    const orderNumber = await nextDocumentNumber(tx, "ORDER", now);

    const createdOrder = await tx.diagnosticOrder.create({
      data: {
        orderNumber,
        patientId: patient.id,
        partnerId: partner.id,
        contractId: activeContract?.id ?? null,
        paymentModel: input.paymentModel,
        status: "PENDING",
        referringDoctor: input.referringDoctor || null,
        clinicalNotes: input.clinicalNotes || null,
        internalNotes: input.internalNotes || null,
        subtotalSelling: built.subtotalSelling,
        discountTotal: built.discountTotal,
        taxTotal: built.taxTotal,
        netSellingTotal: built.netSellingTotal,
        partnerPayableEstimate: built.partnerPayableEstimate,
        commissionEstimate: built.commissionEstimate,
        scheduledAt: input.scheduledAt ?? null,
        createdById: actor.userId,
        items: {
          create: built.items.map((item) => ({
            ...item,
            status: "PENDING",
            reportTracking: {
              create: { status: "AWAITING" },
            },
          })),
        },
        statusHistory: {
          create: {
            previousStatus: "NONE",
            newStatus: "PENDING",
            actorUserId: actor.userId,
            actorPortal: actor.portalType,
            reason: "Order created",
          },
        },
      },
      include: { items: true, patient: true, partner: true },
    });

    await writeAuditLog(tx, {
      actor,
      action: "ORDER_CREATED",
      entityType: "DiagnosticOrder",
      entityId: createdOrder.id,
      after: {
        orderNumber: createdOrder.orderNumber,
        partnerId: createdOrder.partnerId,
        paymentModel: createdOrder.paymentModel,
        itemCount: createdOrder.items.length,
        netSellingTotal: createdOrder.netSellingTotal.toString(),
      },
    });

    return createdOrder;
  });
}

export async function transitionOrderItemStatus(
  actor: ActorContext,
  orderId: string,
  itemId: string,
  rawInput: unknown,
) {
  const input = transitionOrderItemSchema.parse(rawInput);

  if (actor.portalType === "PARTNER") {
    requirePermission(actor, "partner:orders:status");
    if (input.newStatus === "CANCELLED") {
      throw new AppError(
        "FORBIDDEN",
        "Partner users cannot unilaterally cancel order items; use UNABLE_TO_PERFORM or contact the consultancy.",
        403,
      );
    }
  } else {
    requirePermission(actor, "orders:status:update");
  }

  return db.$transaction(async (tx) => {
    const order = await tx.diagnosticOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) {
      throw new AppError("NOT_FOUND", "Order not found.", 404);
    }

    if (actor.portalType === "PARTNER") {
      const scope = requirePartnerScope(actor);
      assertPartnerOwnsRecord(scope, order.partnerId);
    }

    const targetItem = order.items.find((i) => i.id === itemId);
    if (!targetItem) {
      throw new AppError("NOT_FOUND", "Order item not found.", 404);
    }

    assertValidOrderItemTransition(targetItem.status, input.newStatus);

    const now = new Date();
    const orgSettings = await tx.organizationSettings.findFirst();

    await tx.orderItem.update({
      where: { id: itemId },
      data: {
        status: input.newStatus,
        completedAt: input.newStatus === "COMPLETED" ? now : targetItem.completedAt,
        completedByUserId:
          input.newStatus === "COMPLETED" ? actor.userId : targetItem.completedByUserId,
      },
    });

    // Post accounting accrual when item completes (if consultancy approval is not required)
    if (
      input.newStatus === "COMPLETED" &&
      !orgSettings?.requireConsultancyCompletionApproval
    ) {
      if (
        order.paymentModel === "MODEL_A_CONSULTANCY_COLLECTS" &&
        isPositiveMoney(targetItem.partnerNetPayableSnapshot.toString())
      ) {
        await postJournalEntry(tx, {
          referenceType: "OrderItemCompletion",
          referenceId: itemId,
          narration: `Partner service cost accrued on completed test ${targetItem.testCodeSnapshot} (${order.orderNumber})`,
          postedById: actor.userId,
          lines: [
            {
              accountCode: "5100",
              debitAmount: targetItem.partnerNetPayableSnapshot.toString(),
              creditAmount: "0.00",
              partnerId: order.partnerId,
            },
            {
              accountCode: "2100",
              debitAmount: "0.00",
              creditAmount: targetItem.partnerNetPayableSnapshot.toString(),
              partnerId: order.partnerId,
            },
          ],
        });
      } else if (
        order.paymentModel === "MODEL_B_PATIENT_PAYS_PARTNER" &&
        targetItem.commissionAmountSnapshot &&
        isPositiveMoney(targetItem.commissionAmountSnapshot.toString())
      ) {
        await postJournalEntry(tx, {
          referenceType: "OrderItemCommissionAccrual",
          referenceId: itemId,
          narration: `Partner commission earned on completed test ${targetItem.testCodeSnapshot} (${order.orderNumber})`,
          postedById: actor.userId,
          lines: [
            {
              accountCode: "1210",
              debitAmount: targetItem.commissionAmountSnapshot.toString(),
              creditAmount: "0.00",
              partnerId: order.partnerId,
            },
            {
              accountCode: "4200",
              debitAmount: "0.00",
              creditAmount: targetItem.commissionAmountSnapshot.toString(),
              partnerId: order.partnerId,
            },
          ],
        });
      }
    }

    const updatedStatuses = order.items.map((i) =>
      i.id === itemId ? input.newStatus : i.status,
    );
    const nextOrderStatus = deriveOrderStatus(updatedStatuses);

    if (nextOrderStatus !== order.status) {
      await tx.diagnosticOrder.update({
        where: { id: orderId },
        data: {
          status: nextOrderStatus,
          cancelledAt: nextOrderStatus === "CANCELLED" ? now : order.cancelledAt,
        },
      });
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        orderItemId: itemId,
        previousStatus: targetItem.status,
        newStatus: input.newStatus,
        reason: input.reason || null,
        actorUserId: actor.userId,
        actorPortal: actor.portalType,
      },
    });

    await writeAuditLog(tx, {
      actor,
      partnerScopeId: order.partnerId,
      action: "ORDER_ITEM_STATUS_CHANGED",
      entityType: "OrderItem",
      entityId: itemId,
      before: { status: targetItem.status, orderStatus: order.status },
      after: { status: input.newStatus, orderStatus: nextOrderStatus },
      metadata: { orderNumber: order.orderNumber, reason: input.reason ?? null },
    });

    return { itemId, status: input.newStatus, orderStatus: nextOrderStatus };
  });
}

export async function approveOrderItemCompletion(
  actor: ActorContext,
  orderId: string,
  itemId: string,
) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "orders:completion:approve");

  return db.$transaction(async (tx) => {
    const item = await tx.orderItem.findFirst({
      where: { id: itemId, orderId },
      include: { order: true },
    });
    if (!item) {
      throw new AppError("NOT_FOUND", "Order item not found.", 404);
    }
    if (item.status !== "COMPLETED") {
      throw new AppError("BAD_REQUEST", "Only COMPLETED items can be approved.", 400);
    }
    if (item.completionApprovedAt) {
      return item;
    }

    const updated = await tx.orderItem.update({
      where: { id: itemId },
      data: {
        completionApprovedAt: new Date(),
        completionApprovedById: actor.userId,
      },
    });

    await writeAuditLog(tx, {
      actor,
      action: "ORDER_ITEM_COMPLETION_APPROVED",
      entityType: "OrderItem",
      entityId: itemId,
      after: { completionApprovedAt: updated.completionApprovedAt },
    });

    return updated;
  });
}

export async function listOrdersForPartnerPortal(
  actor: ActorContext,
  params: { status?: OrderStatus; page?: number; pageSize?: number },
) {
  const scope = requirePartnerScope(actor);
  requirePermission(actor, "partner:orders:read");

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));

  const orgSettings = await db.organizationSettings.findFirst();
  const phoneVisibility = orgSettings?.partnerPatientPhoneVisibility ?? "MASKED";

  const where: Prisma.DiagnosticOrderWhereInput = {
    partnerId: { in: [...scope.partnerIds] },
    ...(params.status ? { status: params.status } : {}),
  };

  const [totalItems, rows] = await Promise.all([
    db.diagnosticOrder.count({ where }),
    db.diagnosticOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        patient: {
          select: {
            patientCode: true,
            fullName: true,
            mobile: true,
            gender: true,
            ageYearsSnapshot: true,
          },
        },
        items: {
          include: { reportTracking: { select: { status: true } } },
        },
      },
    }),
  ]);

  return {
    items: rows.map((row) => toPartnerOrderDTO(row, { phoneVisibility })),
    page,
    pageSize,
    totalItems,
  };
}

export async function getPartnerPortalOrderDetail(
  actor: ActorContext,
  orderId: string,
) {
  const scope = requirePartnerScope(actor);
  requirePermission(actor, "partner:orders:read");

  const row = await db.diagnosticOrder.findUnique({
    where: { id: orderId },
    include: {
      patient: {
        select: {
          patientCode: true,
          fullName: true,
          mobile: true,
          gender: true,
          ageYearsSnapshot: true,
        },
      },
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          reportTracking: { select: { status: true } },
          reportFiles: {
            where: { isLatest: true },
            select: {
              id: true,
              originalFilename: true,
              versionNumber: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!row) {
    throw new AppError("NOT_FOUND", "Order not found.", 404);
  }
  assertPartnerOwnsRecord(scope, row.partnerId);

  const orgSettings = await db.organizationSettings.findFirst();
  const phoneVisibility = orgSettings?.partnerPatientPhoneVisibility ?? "MASKED";
  const dto = toPartnerOrderDTO(row, { phoneVisibility });

  return {
    ...dto,
    items: dto.items.map((dtoItem) => {
      const src = row.items.find((r) => r.id === dtoItem.id);
      return {
        ...dtoItem,
        latestReportFile: src?.reportFiles[0] ?? null,
      };
    }),
  };
}

export const amendOrCancelOrderSchema = z.object({
  action: z.enum(["AMEND_NOTES", "CANCEL_ORDER"]),
  reason: z.string().trim().min(5, "Audit reason (min 5 chars) is required.").max(500),
  referringDoctor: z.string().trim().max(160).optional().nullable(),
  clinicalNotes: z.string().trim().max(2000).optional().nullable(),
});

export async function amendOrCancelDiagnosticOrder(
  actor: ActorContext,
  orderId: string,
  rawInput: unknown,
) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "orders:amend");
  const input = amendOrCancelOrderSchema.parse(rawInput);

  return db.$transaction(async (tx) => {
    const order = await tx.diagnosticOrder.findUnique({
      where: { id: orderId },
      include: { items: true, invoice: true },
    });
    if (!order) {
      throw new AppError("NOT_FOUND", "Diagnostic order not found.", 404);
    }

    if (input.action === "AMEND_NOTES") {
      const updated = await tx.diagnosticOrder.update({
        where: { id: orderId },
        data: {
          referringDoctor:
            input.referringDoctor !== undefined
              ? input.referringDoctor || null
              : order.referringDoctor,
          clinicalNotes:
            input.clinicalNotes !== undefined
              ? input.clinicalNotes || null
              : order.clinicalNotes,
        },
      });

      await writeAuditLog(tx, {
        actor,
        action: "ORDER_AMENDED",
        entityType: "DiagnosticOrder",
        entityId: orderId,
        before: {
          referringDoctor: order.referringDoctor,
          clinicalNotes: order.clinicalNotes,
        },
        after: {
          referringDoctor: updated.referringDoctor,
          clinicalNotes: updated.clinicalNotes,
          reason: input.reason,
        },
      });
      return updated;
    }

    // CANCEL_ORDER: block if any item is already COMPLETED or locked in settlement
    const hasCompletedOrSettled = order.items.some(
      (i) => i.status === "COMPLETED" || i.settlementLockStatus !== "UNSETTLED",
    );
    if (hasCompletedOrSettled) {
      throw new AppError(
        "BAD_REQUEST",
        "Cannot cancel an order that already has completed or settled test items.",
        422,
      );
    }
    if (order.invoice && Number(order.invoice.netCollected.toString()) > 0) {
      throw new AppError(
        "BAD_REQUEST",
        "Refund collected invoice payments before cancelling this order.",
        422,
      );
    }

    const now = new Date();
    await tx.orderItem.updateMany({
      where: { orderId, status: { not: "CANCELLED" } },
      data: { status: "CANCELLED" },
    });

    if (order.invoice && order.invoice.status === "UNPAID") {
      await tx.invoice.update({
        where: { id: order.invoice.id },
        data: {
          status: "VOID",
          voidedAt: now,
          voidReason: input.reason,
          balanceDue: "0.00",
        },
      });
    }

    const cancelled = await tx.diagnosticOrder.update({
      where: { id: orderId },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancellationReason: input.reason,
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        previousStatus: order.status,
        newStatus: "CANCELLED",
        reason: input.reason,
        actorUserId: actor.userId,
        actorPortal: actor.portalType,
      },
    });

    await writeAuditLog(tx, {
      actor,
      action: "ORDER_CANCELLED",
      entityType: "DiagnosticOrder",
      entityId: orderId,
      before: { status: order.status },
      after: { status: "CANCELLED", reason: input.reason },
    });

    return cancelled;
  });
}

