import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { db, type DbClient } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { resolvePermissionsForRoles } from "@/lib/permissions/rbac";
import type { ActorContext, SystemRoleCode } from "@/lib/permissions/types";

export function hashSessionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export async function createServerSession(params: {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  tx?: DbClient;
}): Promise<{ rawToken: string; csrfToken: string; expiresAt: Date }> {
  const env = getEnv();
  const rawToken = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(24).toString("base64url");
  const sessionTokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(
    Date.now() + env.SESSION_ABSOLUTE_TIMEOUT_DAYS * 24 * 60 * 60 * 1000,
  );

  const client = params.tx ?? db;
  await client.session.create({
    data: {
      sessionTokenHash,
      csrfToken,
      userId: params.userId,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ? params.userAgent.slice(0, 512) : null,
      expiresAt,
    },
  });

  return { rawToken, csrfToken, expiresAt };
}

export async function setSessionCookie(rawToken: string, expiresAt: Date): Promise<void> {
  const env = getEnv();
  const cookieStore = await cookies();
  cookieStore.set(env.SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure:
      env.NODE_ENV === "production" &&
      env.NEXT_PUBLIC_APP_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const env = getEnv();
  const cookieStore = await cookies();
  cookieStore.delete(env.SESSION_COOKIE_NAME);
}

export async function resolveActorFromRawToken(
  rawToken: string | undefined | null,
  meta?: { ipAddress?: string | null; userAgent?: string | null },
): Promise<ActorContext | null> {
  if (!rawToken) {
    return null;
  }
  const env = getEnv();
  const sessionTokenHash = hashSessionToken(rawToken);
  const now = new Date();

  const session = await db.session.findUnique({
    where: { sessionTokenHash },
    include: {
      user: {
        include: {
          userRoles: { include: { role: true } },
          partnerMemberships: {
            where: { isActive: true, partner: { status: "ACTIVE" } },
          },
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt <= now) {
    return null;
  }

  const idleLimitMs = env.SESSION_IDLE_TIMEOUT_HOURS * 60 * 60 * 1000;
  if (now.getTime() - session.lastSeenAt.getTime() > idleLimitMs) {
    await db.session.update({
      where: { id: session.id },
      data: { revokedAt: now },
    });
    return null;
  }

  if (!session.user.isActive) {
    return null;
  }

  // Touch lastSeenAt when > 2 minutes old to avoid write amplification
  if (now.getTime() - session.lastSeenAt.getTime() > 2 * 60 * 1000) {
    await db.session.update({
      where: { id: session.id },
      data: { lastSeenAt: now },
    });
  }

  const roleCodes = session.user.userRoles.map(
    (ur) => ur.role.code as SystemRoleCode,
  );
  const partnerRoleCodes = session.user.partnerMemberships.map(
    (pm) => pm.partnerRole as SystemRoleCode,
  );
  const allRoles = Array.from(new Set([...roleCodes, ...partnerRoleCodes]));
  const permissions = resolvePermissionsForRoles(allRoles);
  const partnerIds = session.user.partnerMemberships.map((pm) => pm.partnerId);

  return {
    userId: session.user.id,
    email: session.user.email,
    fullName: session.user.fullName,
    portalType: session.user.portalType,
    roles: allRoles,
    permissions,
    partnerIds,
    sessionId: session.id,
    csrfToken: session.csrfToken,
    ipAddress: meta?.ipAddress ?? session.ipAddress,
    userAgent: meta?.userAgent ?? session.userAgent,
  };
}

export async function getCurrentActor(req?: NextRequest): Promise<ActorContext | null> {
  const env = getEnv();
  let rawToken: string | undefined;
  if (req) {
    rawToken = req.cookies.get(env.SESSION_COOKIE_NAME)?.value;
  } else {
    const cookieStore = await cookies();
    rawToken = cookieStore.get(env.SESSION_COOKIE_NAME)?.value;
  }
  return resolveActorFromRawToken(rawToken, {
    ipAddress: req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: req?.headers.get("user-agent") ?? null,
  });
}

export async function requireActor(req?: NextRequest): Promise<ActorContext> {
  const actor = await getCurrentActor(req);
  if (!actor) {
    if (!req) {
      redirect("/login");
    }
    throw new AppError("UNAUTHORIZED", "Authentication required.", 401);
  }
  return actor;
}

export async function revokeAllUserSessions(
  tx: DbClient,
  userId: string,
): Promise<void> {
  await tx.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

