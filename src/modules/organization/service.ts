import { z } from "zod";
import {
  CommissionCalculationBasis,
  PartnerPhoneVisibility,
  SupplyCategory,
} from "@prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  requireConsultancyPortal,
  requirePermission,
} from "@/lib/permissions/rbac";
import type { ActorContext } from "@/lib/permissions/types";
import { writeAuditLog } from "@/modules/audit/service";

export const updateOrganizationSettingsSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  displayName: z.string().trim().min(2).max(200),
  gstin: z.string().trim().max(20).optional().nullable(),
  pan: z.string().trim().max(16).optional().nullable(),
  registeredAddress: z.string().trim().min(5).max(1000),
  city: z.string().trim().min(2).max(100),
  stateCode: z.string().trim().length(2),
  stateName: z.string().trim().min(2).max(100),
  pincode: z.string().trim().min(4).max(12),
  contactEmail: z.string().trim().email().max(160),
  contactPhone: z.string().trim().min(6).max(24),
  defaultCommissionBasis: z.nativeEnum(CommissionCalculationBasis),
  requireConsultancyCompletionApproval: z.boolean(),
  allowInvoiceOverpayment: z.boolean(),
  partnerPatientPhoneVisibility: z.nativeEnum(PartnerPhoneVisibility),
  requireSettlementApproval: z.boolean(),
  gstEnabled: z.boolean(),
  invoiceDocumentTitle: z.string().trim().min(3).max(80),
  staticQrFallbackEnabled: z.boolean(),
  staticQrVpaLabel: z.string().trim().max(120).optional().nullable(),
  shareLinkDefaultTtlHours: z.coerce.number().int().min(1).max(720),
  invoiceTermsText: z.string().max(3000).optional().nullable(),
});

export const createTaxCodeSchema = z.object({
  code: z.string().trim().min(2).max(32),
  name: z.string().trim().min(2).max(120),
  hsnSacCode: z.string().trim().min(2).max(20),
  supplyCategory: z.nativeEnum(SupplyCategory),
  cgstRate: z.string().regex(/^\d+(\.\d{1,4})?$/),
  sgstRate: z.string().regex(/^\d+(\.\d{1,4})?$/),
  igstRate: z.string().regex(/^\d+(\.\d{1,4})?$/),
  isExempt: z.boolean(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
});

export async function getOrganizationWithSettings(actor: ActorContext) {
  requireConsultancyPortal(actor);
  const org = await db.organization.findFirst({
    include: { settings: true, sequences: true },
  });
  if (!org || !org.settings) {
    throw new AppError(
      "NOT_FOUND",
      "Organization settings not initialized. Run `npm run db:seed`.",
      404,
    );
  }
  return org;
}

export async function updateOrganizationWithSettings(
  actor: ActorContext,
  rawInput: unknown,
) {
  requirePermission(actor, "org:settings:manage");
  const input = updateOrganizationSettingsSchema.parse(rawInput);

  return db.$transaction(async (tx) => {
    const current = await tx.organization.findFirst({
      include: { settings: true },
    });
    if (!current || !current.settings) {
      throw new AppError("NOT_FOUND", "Organization profile not found.", 404);
    }

    const updatedOrg = await tx.organization.update({
      where: { id: current.id },
      data: {
        legalName: input.legalName,
        displayName: input.displayName,
        gstin: input.gstin || null,
        pan: input.pan || null,
        registeredAddress: input.registeredAddress,
        city: input.city,
        stateCode: input.stateCode,
        stateName: input.stateName,
        pincode: input.pincode,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
      },
    });

    const updatedSettings = await tx.organizationSettings.update({
      where: { organizationId: current.id },
      data: {
        defaultCommissionBasis: input.defaultCommissionBasis,
        requireConsultancyCompletionApproval:
          input.requireConsultancyCompletionApproval,
        allowInvoiceOverpayment: input.allowInvoiceOverpayment,
        partnerPatientPhoneVisibility: input.partnerPatientPhoneVisibility,
        requireSettlementApproval: input.requireSettlementApproval,
        gstEnabled: input.gstEnabled,
        invoiceDocumentTitle: input.invoiceDocumentTitle,
        staticQrFallbackEnabled: input.staticQrFallbackEnabled,
        staticQrVpaLabel: input.staticQrVpaLabel || null,
        shareLinkDefaultTtlHours: input.shareLinkDefaultTtlHours,
        invoiceTermsText: input.invoiceTermsText || null,
      },
    });

    await writeAuditLog(tx, {
      actor,
      action: "ORGANIZATION_SETTINGS_UPDATED",
      entityType: "Organization",
      entityId: current.id,
      before: current,
      after: { ...updatedOrg, settings: updatedSettings },
    });

    return { ...updatedOrg, settings: updatedSettings };
  });
}

export async function listTaxCodes(actor: ActorContext) {
  requireConsultancyPortal(actor);
  return db.taxCode.findMany({
    orderBy: [{ supplyCategory: "asc" }, { code: "asc" }],
  });
}

export async function createTaxCode(actor: ActorContext, rawInput: unknown) {
  requirePermission(actor, "org:settings:manage");
  const input = createTaxCodeSchema.parse(rawInput);

  return db.$transaction(async (tx) => {
    const created = await tx.taxCode.create({
      data: {
        code: input.code.toUpperCase(),
        name: input.name,
        hsnSacCode: input.hsnSacCode,
        supplyCategory: input.supplyCategory,
        cgstRate: input.cgstRate,
        sgstRate: input.sgstRate,
        igstRate: input.igstRate,
        isExempt: input.isExempt,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
      },
    });
    await writeAuditLog(tx, {
      actor,
      action: "TAX_CODE_CREATED",
      entityType: "TaxCode",
      entityId: created.id,
      after: created,
    });
    return created;
  });
}

