import { z } from "zod";
import {
  AllowedContractModels,
  CommercialModel,
  CommissionCalculationBasis,
  ContractStatus,
  PartnerStatus,
  SettlementCycle,
} from "@prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { money, rate } from "@/lib/money";
import { requirePermission } from "@/lib/permissions/rbac";
import type { ActorContext } from "@/lib/permissions/types";
import { writeAuditLog } from "@/modules/audit/service";
import { hasEffectiveWindowOverlap } from "./pricing-engine";

export const createPartnerSchema = z.object({
  partnerCode: z.string().trim().min(2).max(32),
  legalName: z.string().trim().min(2).max(200),
  displayName: z.string().trim().min(2).max(200),
  contactPerson: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(160).optional().nullable().or(z.literal("")),
  phone: z.string().trim().min(7).max(24),
  addressLine: z.string().trim().min(4).max(500),
  city: z.string().trim().min(2).max(100),
  stateCode: z.string().trim().length(2),
  stateName: z.string().trim().min(2).max(100),
  pincode: z.string().trim().min(4).max(12),
  gstin: z.string().trim().max(20).optional().nullable().or(z.literal("")),
  pan: z.string().trim().max(16).optional().nullable().or(z.literal("")),
  defaultPaymentModel: z.nativeEnum(CommercialModel),
  paymentTermsDays: z.coerce.number().int().min(0).max(180).default(15),
  bankAccountName: z.string().trim().max(160).optional().nullable(),
  bankAccountNumberMasked: z.string().trim().max(40).optional().nullable(),
  bankIfsc: z.string().trim().max(16).optional().nullable(),
  status: z.nativeEnum(PartnerStatus).default("ACTIVE"),
  notes: z.string().max(2000).optional().nullable(),
});

export const createPartnerContractSchema = z.object({
  contractNumber: z.string().trim().min(3).max(48),
  allowedModels: z.nativeEnum(AllowedContractModels),
  commissionBasis: z.nativeEnum(CommissionCalculationBasis),
  settlementCycle: z.nativeEnum(SettlementCycle).default("MONTHLY"),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
  status: z.nativeEnum(ContractStatus).default("ACTIVE"),
  notes: z.string().max(1000).optional().nullable(),
});

export const setPartnerTestPriceSchema = z.object({
  testId: z.string().uuid(),
  agreedPurchasePrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  partnerMrpReference: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().nullable(),
  isPerformed: z.boolean().default(true),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
});

export const setPartnerCommissionRateSchema = z.object({
  testId: z.string().uuid().optional().nullable().or(z.literal("")),
  commissionPercentage: z.string().regex(/^\d+(\.\d{1,4})?$/),
  calculationBasis: z.nativeEnum(CommissionCalculationBasis),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
});

export async function listPartners(
  actor: ActorContext,
  params?: { activeOnly?: boolean },
) {
  requirePermission(actor, "partners:read");
  return db.partner.findMany({
    where: params?.activeOnly ? { status: "ACTIVE" } : undefined,
    orderBy: [{ status: "asc" }, { displayName: "asc" }],
    include: {
      _count: { select: { orders: true, partnerUsers: true } },
    },
  });
}

export async function getPartnerDetail(actor: ActorContext, partnerId: string) {
  requirePermission(actor, "partners:read");
  const partner = await db.partner.findUnique({
    where: { id: partnerId },
    include: {
      contracts: { orderBy: { effectiveFrom: "desc" } },
      testPrices: {
        orderBy: [{ isActive: "desc" }, { effectiveFrom: "desc" }],
        include: { test: { select: { id: true, code: true, name: true, defaultSellingPrice: true } } },
      },
      commissionRates: {
        orderBy: [{ isActive: "desc" }, { effectiveFrom: "desc" }],
        include: { test: { select: { id: true, code: true, name: true } } },
      },
      partnerUsers: {
        include: {
          user: { select: { id: true, email: true, fullName: true, isActive: true } },
        },
      },
    },
  });
  if (!partner) {
    throw new AppError("NOT_FOUND", "Partner diagnostic centre not found.", 404);
  }
  return partner;
}

export async function createPartner(actor: ActorContext, rawInput: unknown) {
  requirePermission(actor, "partners:manage");
  const input = createPartnerSchema.parse(rawInput);

  return db.$transaction(async (tx) => {
    const created = await tx.partner.create({
      data: {
        partnerCode: input.partnerCode.toUpperCase(),
        legalName: input.legalName,
        displayName: input.displayName,
        contactPerson: input.contactPerson,
        email: input.email || null,
        phone: input.phone,
        addressLine: input.addressLine,
        city: input.city,
        stateCode: input.stateCode,
        stateName: input.stateName,
        pincode: input.pincode,
        gstin: input.gstin || null,
        pan: input.pan || null,
        defaultPaymentModel: input.defaultPaymentModel,
        paymentTermsDays: input.paymentTermsDays,
        bankAccountName: input.bankAccountName || null,
        bankAccountNumberMasked: input.bankAccountNumberMasked || null,
        bankIfsc: input.bankIfsc || null,
        status: input.status,
        notes: input.notes || null,
      },
    });

    await writeAuditLog(tx, {
      actor,
      action: "PARTNER_CREATED",
      entityType: "Partner",
      entityId: created.id,
      after: created,
    });

    return created;
  });
}

export async function updatePartnerStatus(
  actor: ActorContext,
  partnerId: string,
  status: PartnerStatus,
) {
  requirePermission(actor, "partners:manage");
  return db.$transaction(async (tx) => {
    const before = await tx.partner.findUnique({ where: { id: partnerId } });
    if (!before) {
      throw new AppError("NOT_FOUND", "Partner not found.", 404);
    }
    const updated = await tx.partner.update({
      where: { id: partnerId },
      data: { status },
    });
    await writeAuditLog(tx, {
      actor,
      action: "PARTNER_STATUS_UPDATED",
      entityType: "Partner",
      entityId: partnerId,
      before: { status: before.status },
      after: { status: updated.status },
    });
    return updated;
  });
}

export async function createPartnerContract(
  actor: ActorContext,
  partnerId: string,
  rawInput: unknown,
) {
  requirePermission(actor, "partners:manage");
  const input = createPartnerContractSchema.parse(rawInput);

  return db.$transaction(async (tx) => {
    const created = await tx.partnerContract.create({
      data: {
        partnerId,
        contractNumber: input.contractNumber.toUpperCase(),
        allowedModels: input.allowedModels,
        commissionBasis: input.commissionBasis,
        settlementCycle: input.settlementCycle,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        status: input.status,
        notes: input.notes || null,
        createdById: actor.userId,
      },
    });

    await writeAuditLog(tx, {
      actor,
      action: "PARTNER_CONTRACT_CREATED",
      entityType: "PartnerContract",
      entityId: created.id,
      after: created,
    });
    return created;
  });
}

export async function setPartnerTestPrice(
  actor: ActorContext,
  partnerId: string,
  rawInput: unknown,
) {
  requirePermission(actor, "pricing:manage");
  const input = setPartnerTestPriceSchema.parse(rawInput);

  return db.$transaction(async (tx) => {
    const existingActive = await tx.partnerTestPrice.findMany({
      where: { partnerId, testId: input.testId, isActive: true },
    });

    const candidateWindow = {
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo ?? null,
    };

    for (const row of existingActive) {
      if (
        hasEffectiveWindowOverlap(candidateWindow, {
          effectiveFrom: row.effectiveFrom,
          effectiveTo: row.effectiveTo,
        })
      ) {
        throw new AppError(
          "PRICE_WINDOW_OVERLAP",
          "Active negotiated price date range overlaps an existing active price window for this partner and test.",
          409,
        );
      }
    }

    const created = await tx.partnerTestPrice.create({
      data: {
        partnerId,
        testId: input.testId,
        agreedPurchasePrice: money(input.agreedPurchasePrice),
        partnerMrpReference: input.partnerMrpReference
          ? money(input.partnerMrpReference)
          : null,
        isPerformed: input.isPerformed,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        createdById: actor.userId,
      },
    });

    await writeAuditLog(tx, {
      actor,
      action: "PARTNER_TEST_PRICE_SET",
      entityType: "PartnerTestPrice",
      entityId: created.id,
      after: created,
    });

    return created;
  });
}

export async function setPartnerCommissionRate(
  actor: ActorContext,
  partnerId: string,
  rawInput: unknown,
) {
  requirePermission(actor, "pricing:manage");
  const input = setPartnerCommissionRateSchema.parse(rawInput);
  const resolvedTestId = input.testId || null;

  const pctNum = Number(input.commissionPercentage);
  if (!Number.isFinite(pctNum) || pctNum < 0 || pctNum > 100) {
    throw new AppError(
      "BAD_REQUEST",
      "Commission percentage must be between 0 and 100.",
      400,
    );
  }

  return db.$transaction(async (tx) => {
    const existingActive = await tx.partnerCommissionRate.findMany({
      where: { partnerId, testId: resolvedTestId, isActive: true },
    });

    const candidateWindow = {
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo ?? null,
    };

    for (const row of existingActive) {
      if (
        hasEffectiveWindowOverlap(candidateWindow, {
          effectiveFrom: row.effectiveFrom,
          effectiveTo: row.effectiveTo,
        })
      ) {
        throw new AppError(
          "PRICE_WINDOW_OVERLAP",
          "Active commission rate date range overlaps an existing active rate for the same partner/test scope.",
          409,
        );
      }
    }

    const created = await tx.partnerCommissionRate.create({
      data: {
        partnerId,
        testId: resolvedTestId,
        commissionPercentage: rate(input.commissionPercentage),
        calculationBasis: input.calculationBasis,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        createdById: actor.userId,
      },
    });

    await writeAuditLog(tx, {
      actor,
      action: "PARTNER_COMMISSION_RATE_SET",
      entityType: "PartnerCommissionRate",
      entityId: created.id,
      after: created,
    });

    return created;
  });
}

