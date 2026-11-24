import { Prisma } from "@prisma/client";
import type { DbClient } from "@/lib/db";
import { redactSensitiveData } from "@/lib/logger";
import type { ActorContext } from "@/lib/permissions/types";

export interface AuditLogInput {
  actor?: ActorContext | null;
  actorUserId?: string | null;
  partnerScopeId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(tx: DbClient, input: AuditLogInput): Promise<void> {
  const actorUserId = input.actor?.userId ?? input.actorUserId ?? null;
  const actorRoleSnapshot = input.actor?.roles.join(",") ?? null;
  const partnerScopeId =
    input.partnerScopeId ?? input.actor?.partnerIds[0] ?? null;

  await tx.auditLog.create({
    data: {
      actorUserId,
      actorRoleSnapshot,
      partnerScopeId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      requestId: input.requestId ?? null,
      ipAddress: input.ipAddress ?? input.actor?.ipAddress ?? null,
      userAgent: input.userAgent ?? input.actor?.userAgent ?? null,
      beforeJson:
        input.before !== undefined
          ? (redactSensitiveData(input.before) as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      afterJson:
        input.after !== undefined
          ? (redactSensitiveData(input.after) as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      metadataJson:
        input.metadata !== undefined
          ? (redactSensitiveData(input.metadata) as Prisma.InputJsonValue)
          : Prisma.JsonNull,
    },
  });
}

