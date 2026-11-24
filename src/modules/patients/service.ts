import { z } from "zod";
import { ConsentType, Gender, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { nextDocumentNumber } from "@/lib/db/sequences";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions/rbac";
import type { ActorContext } from "@/lib/permissions/types";
import { writeAuditLog } from "@/modules/audit/service";

const phoneStringSchema = z
  .string()
  .trim()
  .min(7, "Enter a valid mobile number.")
  .max(24)
  .regex(/^[+\d][\d\s\-()]{6,23}$/, "Mobile number must preserve digits and optional +country code.");

export const createPatientSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required.").max(160),
  mobile: phoneStringSchema,
  alternateMobile: phoneStringSchema.optional().nullable().or(z.literal("")),
  email: z.string().trim().email().max(160).optional().nullable().or(z.literal("")),
  dateOfBirth: z.coerce.date().optional().nullable(),
  ageYearsSnapshot: z.coerce.number().int().min(0).max(130).optional().nullable(),
  gender: z.nativeEnum(Gender),
  addressLine: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  pincode: z.string().trim().max(12).optional().nullable(),
  consents: z
    .array(
      z.object({
        consentType: z.nativeEnum(ConsentType),
        granted: z.boolean(),
      }),
    )
    .optional(),
});

export const updatePatientSchema = createPatientSchema.partial();

export async function listPatients(
  actor: ActorContext,
  params: { q?: string; page?: number; pageSize?: number },
) {
  requirePermission(actor, "patients:read");
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
  const q = params.q?.trim();

  const where: Prisma.PatientWhereInput = q
    ? {
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { mobile: { contains: q } },
          { patientCode: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [totalItems, items] = await Promise.all([
    db.patient.count({ where }),
    db.patient.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { orders: true, invoices: true } },
      },
    }),
  ]);

  return { items, page, pageSize, totalItems };
}

export async function createPatient(actor: ActorContext, rawInput: unknown) {
  requirePermission(actor, "patients:write");
  const input = createPatientSchema.parse(rawInput);

  let derivedAge = input.ageYearsSnapshot ?? null;
  if (derivedAge === null && input.dateOfBirth) {
    const diffYears = Math.floor(
      (Date.now() - input.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
    );
    if (diffYears >= 0 && diffYears <= 130) {
      derivedAge = diffYears;
    }
  }

  return db.$transaction(async (tx) => {
    const patientCode = await nextDocumentNumber(tx, "PATIENT");
    const created = await tx.patient.create({
      data: {
        patientCode,
        fullName: input.fullName,
        mobile: input.mobile,
        alternateMobile: input.alternateMobile || null,
        email: input.email || null,
        dateOfBirth: input.dateOfBirth ?? null,
        ageYearsSnapshot: derivedAge,
        gender: input.gender,
        addressLine: input.addressLine || null,
        city: input.city || null,
        state: input.state || null,
        pincode: input.pincode || null,
        createdById: actor.userId,
        consents:
          input.consents && input.consents.length > 0
            ? {
                create: input.consents.map((c) => ({
                  consentType: c.consentType,
                  granted: c.granted,
                  capturedById: actor.userId,
                })),
              }
            : undefined,
      },
      include: { consents: true },
    });

    await writeAuditLog(tx, {
      actor,
      action: "PATIENT_CREATED",
      entityType: "Patient",
      entityId: created.id,
      after: { id: created.id, patientCode: created.patientCode, fullName: created.fullName },
    });

    return created;
  });
}

export async function getPatientWithHistory(
  actor: ActorContext,
  patientId: string,
) {
  requirePermission(actor, "patients:read");
  const patient = await db.patient.findUnique({
    where: { id: patientId },
    include: {
      consents: { orderBy: { capturedAt: "desc" } },
      orders: {
        orderBy: { createdAt: "desc" },
        include: {
          partner: { select: { id: true, displayName: true, partnerCode: true } },
          items: {
            include: {
              reportTracking: true,
              reportFiles: { where: { isLatest: true } },
            },
          },
          invoice: {
            include: {
              payments: { orderBy: { paymentDate: "desc" } },
              receipts: true,
              shareLogs: { orderBy: { createdAt: "desc" }, take: 10 },
            },
          },
          partnerInvoiceReference: true,
        },
      },
    },
  });

  if (!patient) {
    throw new AppError("NOT_FOUND", "Patient record not found.", 404);
  }

  await writeAuditLog(db, {
    actor,
    action: "PATIENT_HISTORY_VIEWED",
    entityType: "Patient",
    entityId: patient.id,
  });

  return patient;
}

export async function updatePatient(
  actor: ActorContext,
  patientId: string,
  rawInput: unknown,
) {
  requirePermission(actor, "patients:write");
  const input = updatePatientSchema.parse(rawInput);

  return db.$transaction(async (tx) => {
    const before = await tx.patient.findUnique({ where: { id: patientId } });
    if (!before) {
      throw new AppError("NOT_FOUND", "Patient not found.", 404);
    }

    const updated = await tx.patient.update({
      where: { id: patientId },
      data: {
        fullName: input.fullName,
        mobile: input.mobile,
        alternateMobile:
          input.alternateMobile !== undefined ? input.alternateMobile || null : undefined,
        email: input.email !== undefined ? input.email || null : undefined,
        dateOfBirth: input.dateOfBirth,
        ageYearsSnapshot: input.ageYearsSnapshot,
        gender: input.gender,
        addressLine: input.addressLine,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        updatedById: actor.userId,
      },
    });

    await writeAuditLog(tx, {
      actor,
      action: "PATIENT_UPDATED",
      entityType: "Patient",
      entityId: patientId,
      before: { fullName: before.fullName, mobile: before.mobile },
      after: { fullName: updated.fullName, mobile: updated.mobile },
    });

    return updated;
  });
}

