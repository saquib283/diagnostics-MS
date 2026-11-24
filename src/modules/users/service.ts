import { z } from "zod";
import { PartnerRoleCode, PortalType } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllUserSessions } from "@/lib/auth/session";
import {
  requirePermission,
  ROLE_PERMISSIONS,
} from "@/lib/permissions/rbac";
import { requirePartnerScope } from "@/lib/permissions/scope";
import type { ActorContext, SystemRoleCode } from "@/lib/permissions/types";
import { writeAuditLog } from "@/modules/audit/service";

export const createUserSchema = z.object({
  email: z.string().trim().email().max(160),
  fullName: z.string().trim().min(2).max(160),
  mobile: z.string().trim().max(24).optional().nullable(),
  password: z.string().min(10, "Password must be at least 10 characters.").max(256),
  portalType: z.nativeEnum(PortalType),
  roleCodes: z.array(z.string()).min(1),
  partnerId: z.string().uuid().optional().nullable(),
  partnerRole: z.nativeEnum(PartnerRoleCode).optional().nullable(),
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
  roleCodes: z.array(z.string()).min(1).optional(),
});

export async function listUsers(actor: ActorContext) {
  requirePermission(actor, "users:manage");
  return db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      fullName: true,
      mobile: true,
      portalType: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      userRoles: { include: { role: true } },
      partnerMemberships: { include: { partner: { select: { id: true, displayName: true, partnerCode: true } } } },
    },
  });
}

export async function createUserAccount(actor: ActorContext, rawInput: unknown) {
  requirePermission(actor, "users:manage");
  const input = createUserSchema.parse(rawInput);

  if (input.portalType === "PARTNER" && (!input.partnerId || !input.partnerRole)) {
    throw new AppError(
      "BAD_REQUEST",
      "Partner users must be assigned to a specific partner centre and partner role.",
      400,
    );
  }

  for (const code of input.roleCodes) {
    if (!(code in ROLE_PERMISSIONS)) {
      throw new AppError("BAD_REQUEST", `Unknown role code: ${code}`, 400);
    }
  }

  const normalizedEmail = input.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new AppError("CONFLICT", "A user with this email already exists.", 409);
  }

  const passwordHash = await hashPassword(input.password);

  return db.$transaction(async (tx) => {
    const roles = await tx.role.findMany({
      where: { code: { in: input.roleCodes } },
    });

    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        fullName: input.fullName,
        mobile: input.mobile ?? null,
        passwordHash,
        portalType: input.portalType,
        createdById: actor.userId,
        userRoles: {
          create: roles.map((r) => ({ roleId: r.id })),
        },
        partnerMemberships:
          input.portalType === "PARTNER" && input.partnerId && input.partnerRole
            ? {
                create: {
                  partnerId: input.partnerId,
                  partnerRole: input.partnerRole,
                  isPrimary: true,
                },
              }
            : undefined,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        portalType: true,
        isActive: true,
      },
    });

    await writeAuditLog(tx, {
      actor,
      action: "USER_CREATED",
      entityType: "User",
      entityId: user.id,
      after: { ...user, roleCodes: input.roleCodes, partnerId: input.partnerId },
    });

    return user;
  });
}

export async function updateUserStatusAndRoles(
  actor: ActorContext,
  targetUserId: string,
  rawInput: unknown,
) {
  requirePermission(actor, "users:manage");
  const input = updateUserStatusSchema.parse(rawInput);

  if (actor.userId === targetUserId && !input.isActive) {
    throw new AppError("BAD_REQUEST", "You cannot deactivate your own active account.", 400);
  }

  return db.$transaction(async (tx) => {
    const before = await tx.user.findUnique({
      where: { id: targetUserId },
      include: { userRoles: { include: { role: true } } },
    });
    if (!before) {
      throw new AppError("NOT_FOUND", "User not found.", 404);
    }

    if (input.roleCodes) {
      const roles = await tx.role.findMany({
        where: { code: { in: input.roleCodes as SystemRoleCode[] } },
      });
      await tx.userRole.deleteMany({ where: { userId: targetUserId } });
      await tx.userRole.createMany({
        data: roles.map((r) => ({ userId: targetUserId, roleId: r.id })),
      });
    }

    const updated = await tx.user.update({
      where: { id: targetUserId },
      data: { isActive: input.isActive },
      select: { id: true, email: true, fullName: true, isActive: true },
    });

    // Security invariant: deactivating or modifying roles immediately revokes active sessions
    await revokeAllUserSessions(tx, targetUserId);

    await writeAuditLog(tx, {
      actor,
      action: "USER_UPDATED",
      entityType: "User",
      entityId: targetUserId,
      before: { isActive: before.isActive, roles: before.userRoles.map((r) => r.role.code) },
      after: { isActive: updated.isActive, roles: input.roleCodes },
    });

    return updated;
  });
}

export async function listOwnPartnerUsers(actor: ActorContext) {
  const scope = requirePartnerScope(actor);
  requirePermission(actor, "partner:users:manage");
  const partnerId = scope.partnerIds[0];

  return db.partnerUser.findMany({
    where: { partnerId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          mobile: true,
          isActive: true,
          lastLoginAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createOwnPartnerStaffUser(
  actor: ActorContext,
  rawInput: unknown,
) {
  const scope = requirePartnerScope(actor);
  requirePermission(actor, "partner:users:manage");
  const partnerId = scope.partnerIds[0];

  const schema = z.object({
    email: z.string().trim().email().max(160),
    fullName: z.string().trim().min(2).max(160),
    mobile: z.string().trim().max(24).optional().nullable(),
    password: z.string().min(10).max(256),
    partnerRole: z.nativeEnum(PartnerRoleCode),
  });
  const input = schema.parse(rawInput);

  const normalizedEmail = input.email.toLowerCase();
  const exists = await db.user.findUnique({ where: { email: normalizedEmail } });
  if (exists) {
    throw new AppError("CONFLICT", "A user with this email already exists.", 409);
  }

  const passwordHash = await hashPassword(input.password);

  return db.$transaction(async (tx) => {
    const roleRecord = await tx.role.findUnique({
      where: { code: input.partnerRole },
    });
    const created = await tx.user.create({
      data: {
        email: normalizedEmail,
        fullName: input.fullName,
        mobile: input.mobile ?? null,
        passwordHash,
        portalType: "PARTNER",
        createdById: actor.userId,
        userRoles: roleRecord ? { create: [{ roleId: roleRecord.id }] } : undefined,
        partnerMemberships: {
          create: {
            partnerId,
            partnerRole: input.partnerRole,
            isPrimary: true,
          },
        },
      },
      select: { id: true, email: true, fullName: true },
    });

    await writeAuditLog(tx, {
      actor,
      partnerScopeId: partnerId,
      action: "PARTNER_USER_CREATED",
      entityType: "User",
      entityId: created.id,
      after: { ...created, partnerRole: input.partnerRole, partnerId },
    });

    return created;
  });
}

