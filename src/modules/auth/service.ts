import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { sha256Hex } from "@/lib/db/sequences";
import { AppError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createServerSession,
  revokeAllUserSessions,
} from "@/lib/auth/session";
import { writeAuditLog } from "@/modules/audit/service";
import type { ActorContext } from "@/lib/permissions/types";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(160),
  password: z.string().min(1, "Enter your password.").max(256),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(160),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(16).max(256),
  newPassword: z
    .string()
    .min(10, "Password must contain at least 10 characters.")
    .max(256),
});

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const DUMMY_SCRYPT_HASH =
  "scrypt$16384$8$1$00112233445566778899aabbccddeeff$0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

export async function authenticateUser(params: {
  email: string;
  password: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const normalizedEmail = params.email.trim().toLowerCase();
  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      partnerMemberships: {
        where: { isActive: true, partner: { status: "ACTIVE" } },
      },
    },
  });

  if (!user) {
    await verifyPassword(params.password, DUMMY_SCRYPT_HASH);
    throw new AppError("UNAUTHORIZED", "Invalid email or password.", 401);
  }

  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    await writeAuditLog(db, {
      actorUserId: user.id,
      action: "AUTH_LOGIN_LOCKED",
      entityType: "User",
      entityId: user.id,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
    throw new AppError(
      "RATE_LIMITED",
      "Account is temporarily locked after repeated failed sign-in attempts. Try again in 15 minutes.",
      429,
    );
  }

  const valid = await verifyPassword(params.password, user.passwordHash);
  if (!valid || !user.isActive) {
    const nextFailures = user.failedLoginCount + 1;
    const lockedUntil =
      nextFailures >= MAX_FAILED_LOGINS
        ? new Date(now.getTime() + LOCKOUT_DURATION_MS)
        : null;

    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: nextFailures,
        lockedUntil,
      },
    });

    await writeAuditLog(db, {
      actorUserId: user.id,
      action: user.isActive ? "AUTH_LOGIN_FAILED" : "AUTH_LOGIN_INACTIVE_ACCOUNT",
      entityType: "User",
      entityId: user.id,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: { failedLoginCount: nextFailures },
    });

    throw new AppError("UNAUTHORIZED", "Invalid email or password.", 401);
  }

  if (user.portalType === "PARTNER" && user.partnerMemberships.length === 0) {
    throw new AppError(
      "FORBIDDEN",
      "Partner user has no active diagnostic centre assignment.",
      403,
    );
  }

  const session = await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: now,
      },
    });

    const createdSession = await createServerSession({
      userId: user.id,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      tx,
    });

    await writeAuditLog(tx, {
      actorUserId: user.id,
      action: "AUTH_LOGIN_SUCCESS",
      entityType: "User",
      entityId: user.id,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: { portalType: user.portalType },
    });

    return createdSession;
  });

  const redirectTo =
    user.portalType === "PARTNER" ? "/partner/dashboard" : "/admin/dashboard";

  return {
    ...session,
    redirectTo,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      portalType: user.portalType,
    },
  };
}

export async function logoutActor(actor: ActorContext): Promise<void> {
  await db.$transaction(async (tx) => {
    if (actor.sessionId) {
      await tx.session.update({
        where: { id: actor.sessionId },
        data: { revokedAt: new Date() },
      });
    }
    await writeAuditLog(tx, {
      actor,
      action: "AUTH_LOGOUT",
      entityType: "Session",
      entityId: actor.sessionId ?? actor.userId,
    });
  });
}

export async function issuePasswordResetToken(email: string): Promise<{
  issued: boolean;
  rawTokenForNotification?: string;
  userId?: string;
}> {
  const user = await db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!user || !user.isActive) {
    return { issued: false };
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await db.$transaction(async (tx) => {
    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });
    await writeAuditLog(tx, {
      actorUserId: user.id,
      action: "AUTH_PASSWORD_RESET_REQUESTED",
      entityType: "User",
      entityId: user.id,
    });
  });

  return { issued: true, rawTokenForNotification: rawToken, userId: user.id };
}

export async function resetPasswordWithToken(params: {
  rawToken: string;
  newPassword: string;
  ipAddress?: string | null;
}): Promise<void> {
  const tokenHash = sha256Hex(params.rawToken.trim());
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    throw new AppError(
      "BAD_REQUEST",
      "Password reset link is invalid or has expired.",
      400,
    );
  }

  const passwordHash = await hashPassword(params.newPassword);

  await db.$transaction(async (tx) => {
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    await tx.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        failedLoginCount: 0,
        lockedUntil: null,
        mustChangePassword: false,
      },
    });
    await revokeAllUserSessions(tx, record.userId);
    await writeAuditLog(tx, {
      actorUserId: record.userId,
      ipAddress: params.ipAddress,
      action: "AUTH_PASSWORD_RESET_COMPLETED",
      entityType: "User",
      entityId: record.userId,
    });
  });
}

