import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { money, rate } from "@/lib/money";
import { requirePermission } from "@/lib/permissions/rbac";
import type { ActorContext } from "@/lib/permissions/types";
import { writeAuditLog } from "@/modules/audit/service";

export const createTestCategorySchema = z.object({
  code: z.string().trim().min(2).max(32),
  name: z.string().trim().min(2).max(120),
  sortOrder: z.coerce.number().int().default(0),
});

export const createTestSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(200),
  categoryId: z.string().uuid(),
  description: z.string().trim().max(1000).optional().nullable(),
  sampleType: z.string().trim().max(80).optional().nullable(),
  turnaroundHours: z.coerce.number().int().positive().max(720).optional().nullable(),
  defaultSellingPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid INR price."),
  taxCodeId: z.string().uuid().optional().nullable().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export const updateTestSchema = createTestSchema.partial();

export const createPackageSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  defaultSellingPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  taxCodeId: z.string().uuid().optional().nullable().or(z.literal("")),
  isActive: z.boolean().default(true),
  items: z
    .array(
      z.object({
        testId: z.string().uuid(),
        quantity: z.coerce.number().int().positive().default(1),
        allocationWeight: z.string().regex(/^\d+(\.\d{1,4})?$/).default("1.0000"),
      }),
    )
    .min(1, "Package must include at least one diagnostic test."),
});

export async function listTestCategories(actor: ActorContext) {
  requirePermission(actor, "catalogue:read");
  return db.testCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { tests: true } } },
  });
}

export async function createTestCategory(actor: ActorContext, rawInput: unknown) {
  requirePermission(actor, "catalogue:manage");
  const input = createTestCategorySchema.parse(rawInput);

  return db.$transaction(async (tx) => {
    const created = await tx.testCategory.create({
      data: {
        code: input.code.toUpperCase(),
        name: input.name,
        sortOrder: input.sortOrder,
      },
    });
    await writeAuditLog(tx, {
      actor,
      action: "TEST_CATEGORY_CREATED",
      entityType: "TestCategory",
      entityId: created.id,
      after: created,
    });
    return created;
  });
}

export async function listTests(
  actor: ActorContext,
  params: { q?: string; categoryId?: string; activeOnly?: boolean },
) {
  requirePermission(actor, "catalogue:read");
  const where: Prisma.TestWhereInput = {
    ...(params.activeOnly ? { isActive: true } : {}),
    ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q.trim(), mode: "insensitive" } },
            { code: { contains: params.q.trim(), mode: "insensitive" } },
          ],
        }
      : {}),
  };

  return db.test.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { category: true, taxCode: true },
  });
}

export async function createTest(actor: ActorContext, rawInput: unknown) {
  requirePermission(actor, "catalogue:manage");
  const input = createTestSchema.parse(rawInput);

  return db.$transaction(async (tx) => {
    const created = await tx.test.create({
      data: {
        code: input.code.toUpperCase(),
        name: input.name,
        categoryId: input.categoryId,
        description: input.description || null,
        sampleType: input.sampleType || null,
        turnaroundHours: input.turnaroundHours ?? null,
        defaultSellingPrice: money(input.defaultSellingPrice),
        taxCodeId: input.taxCodeId || null,
        isActive: input.isActive,
      },
      include: { category: true, taxCode: true },
    });

    await writeAuditLog(tx, {
      actor,
      action: "TEST_CREATED",
      entityType: "Test",
      entityId: created.id,
      after: created,
    });

    return created;
  });
}

export async function updateTest(
  actor: ActorContext,
  testId: string,
  rawInput: unknown,
) {
  requirePermission(actor, "catalogue:manage");
  const input = updateTestSchema.parse(rawInput);

  return db.$transaction(async (tx) => {
    const before = await tx.test.findUnique({ where: { id: testId } });
    if (!before) {
      throw new AppError("NOT_FOUND", "Test not found.", 404);
    }

    const updated = await tx.test.update({
      where: { id: testId },
      data: {
        name: input.name,
        categoryId: input.categoryId,
        description: input.description,
        sampleType: input.sampleType,
        turnaroundHours: input.turnaroundHours,
        defaultSellingPrice: input.defaultSellingPrice
          ? money(input.defaultSellingPrice)
          : undefined,
        taxCodeId: input.taxCodeId !== undefined ? input.taxCodeId || null : undefined,
        isActive: input.isActive,
      },
    });

    await writeAuditLog(tx, {
      actor,
      action: "TEST_UPDATED",
      entityType: "Test",
      entityId: testId,
      before,
      after: updated,
    });

    return updated;
  });
}

export async function listPackages(
  actor: ActorContext,
  params?: { activeOnly?: boolean },
) {
  requirePermission(actor, "catalogue:read");
  return db.testPackage.findMany({
    where: params?.activeOnly ? { isActive: true } : undefined,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      taxCode: true,
      items: { include: { test: true } },
    },
  });
}

export async function createPackage(actor: ActorContext, rawInput: unknown) {
  requirePermission(actor, "catalogue:manage");
  const input = createPackageSchema.parse(rawInput);

  return db.$transaction(async (tx) => {
    const created = await tx.testPackage.create({
      data: {
        code: input.code.toUpperCase(),
        name: input.name,
        description: input.description || null,
        defaultSellingPrice: money(input.defaultSellingPrice),
        taxCodeId: input.taxCodeId || null,
        isActive: input.isActive,
        items: {
          create: input.items.map((item) => ({
            testId: item.testId,
            quantity: item.quantity,
            allocationWeight: rate(item.allocationWeight),
          })),
        },
      },
      include: { items: { include: { test: true } } },
    });

    await writeAuditLog(tx, {
      actor,
      action: "PACKAGE_CREATED",
      entityType: "TestPackage",
      entityId: created.id,
      after: created,
    });

    return created;
  });
}

export const updatePackageSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  defaultSellingPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  isActive: z.boolean().optional(),
});

export async function updatePackage(
  actor: ActorContext,
  packageId: string,
  rawInput: unknown,
) {
  requirePermission(actor, "catalogue:manage");
  const input = updatePackageSchema.parse(rawInput);

  return db.$transaction(async (tx) => {
    const before = await tx.testPackage.findUnique({ where: { id: packageId } });
    if (!before) {
      throw new AppError("NOT_FOUND", "Test package not found.", 404);
    }

    const updated = await tx.testPackage.update({
      where: { id: packageId },
      data: {
        name: input.name,
        description: input.description,
        defaultSellingPrice: input.defaultSellingPrice
          ? money(input.defaultSellingPrice)
          : undefined,
        isActive: input.isActive,
      },
    });

    await writeAuditLog(tx, {
      actor,
      action: "PACKAGE_UPDATED",
      entityType: "TestPackage",
      entityId: packageId,
      before,
      after: updated,
    });

    return updated;
  });
}

