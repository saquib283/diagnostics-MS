import { randomUUID } from "node:crypto";
import path from "node:path";
import { db } from "@/lib/db";
import { sha256Hex } from "@/lib/db/sequences";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions/rbac";
import {
  assertPartnerOwnsRecord,
  requirePartnerScope,
} from "@/lib/permissions/scope";
import type { ActorContext } from "@/lib/permissions/types";
import { getPrivateStorage } from "@/lib/storage";
import {
  scanBufferWithClamAvIfEnabled,
  validateUploadedReportBuffer,
} from "@/lib/storage/file-validator";
import { writeAuditLog } from "@/modules/audit/service";
import {
  getInvoiceOrStatementPdfBuffer,
} from "@/modules/billing/service";
import { getReceiptPdfBuffer } from "@/modules/payments/service";

export async function uploadDiagnosticReportForOrderItem(params: {
  actor: ActorContext;
  orderItemId: string;
  filename: string;
  declaredMimeType?: string | null;
  buffer: Buffer;
  notes?: string | null;
}) {
  const { actor } = params;
  if (actor.portalType === "PARTNER") {
    requirePermission(actor, "partner:reports:upload");
  } else {
    requirePermission(actor, "reports:upload");
  }

  const env = getEnv();
  const maxBytes = env.MAX_REPORT_UPLOAD_MB * 1024 * 1024;
  const validated = validateUploadedReportBuffer({
    filename: params.filename,
    declaredMimeType: params.declaredMimeType,
    buffer: params.buffer,
    maxBytes,
  });

  await scanBufferWithClamAvIfEnabled(params.buffer);

  const orderItem = await db.orderItem.findUnique({
    where: { id: params.orderItemId },
    include: {
      order: true,
      reportFiles: { orderBy: { versionNumber: "desc" }, take: 1 },
    },
  });

  if (!orderItem) {
    throw new AppError("NOT_FOUND", "Order test item not found.", 404);
  }

  if (actor.portalType === "PARTNER") {
    const scope = requirePartnerScope(actor);
    assertPartnerOwnsRecord(scope, orderItem.order.partnerId);
  }

  if (
    orderItem.status === "CANCELLED" ||
    orderItem.status === "UNABLE_TO_PERFORM"
  ) {
    throw new AppError(
      "BAD_REQUEST",
      `Cannot upload diagnostic report for an item in ${orderItem.status} status.`,
      422,
    );
  }

  const nextVersion = (orderItem.reportFiles[0]?.versionNumber ?? 0) + 1;
  const ext = path.extname(validated.sanitizedFilename).toLowerCase() || ".pdf";
  const storageKey = `reports/${orderItem.orderId}/${orderItem.id}/v${nextVersion}-${randomUUID()}${ext}`;

  const storage = getPrivateStorage();
  await storage.putObject({
    storageKey,
    body: params.buffer,
    contentType: validated.detectedMime,
  });

  return db.$transaction(async (tx) => {
    await tx.reportFile.updateMany({
      where: { orderItemId: orderItem.id, isLatest: true },
      data: { isLatest: false, supersededAt: new Date() },
    });

    const createdFile = await tx.reportFile.create({
      data: {
        orderItemId: orderItem.id,
        versionNumber: nextVersion,
        originalFilename: validated.sanitizedFilename,
        mimeType: validated.detectedMime,
        fileSizeBytes: validated.fileSizeBytes,
        sha256Checksum: validated.sha256Checksum,
        storageKey,
        isLatest: true,
        uploadedByUserId: actor.userId,
        uploadedPortal: actor.portalType,
        notes: params.notes || null,
      },
    });

    await tx.reportTracking.upsert({
      where: { orderItemId: orderItem.id },
      create: {
        orderItemId: orderItem.id,
        status: "UPLOADED",
        receivedAt: new Date(),
      },
      update: {
        status: "UPLOADED",
        receivedAt: new Date(),
      },
    });

    await tx.documentAccessLog.create({
      data: {
        resourceType: "REPORT",
        resourceId: createdFile.id,
        actorUserId: actor.userId,
        action: "UPLOAD",
        ipAddress: actor.ipAddress ?? null,
        userAgent: actor.userAgent ?? null,
      },
    });

    await writeAuditLog(tx, {
      actor,
      partnerScopeId: orderItem.order.partnerId,
      action: "DIAGNOSTIC_REPORT_UPLOADED",
      entityType: "ReportFile",
      entityId: createdFile.id,
      after: {
        orderNumber: orderItem.order.orderNumber,
        testCode: orderItem.testCodeSnapshot,
        versionNumber: nextVersion,
        sha256Checksum: validated.sha256Checksum,
        fileSizeBytes: validated.fileSizeBytes,
      },
    });

    return createdFile;
  });
}

export async function downloadAuthorizedReportFile(
  actor: ActorContext,
  reportFileId: string,
): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
  if (actor.portalType === "PARTNER") {
    requirePermission(actor, "partner:orders:read");
  } else {
    requirePermission(actor, "reports:download");
  }

  const file = await db.reportFile.findUnique({
    where: { id: reportFileId },
    include: {
      orderItem: { include: { order: true } },
    },
  });

  if (!file) {
    throw new AppError("NOT_FOUND", "Report file not found.", 404);
  }

  if (actor.portalType === "PARTNER") {
    const scope = requirePartnerScope(actor);
    assertPartnerOwnsRecord(scope, file.orderItem.order.partnerId);
  }

  const storage = getPrivateStorage();
  const buffer = await storage.getObjectBuffer(file.storageKey);

  await db.documentAccessLog.create({
    data: {
      resourceType: "REPORT",
      resourceId: file.id,
      actorUserId: actor.userId,
      action: "DOWNLOAD",
      ipAddress: actor.ipAddress ?? null,
      userAgent: actor.userAgent ?? null,
    },
  });

  await writeAuditLog(db, {
    actor,
    partnerScopeId: file.orderItem.order.partnerId,
    action: "DIAGNOSTIC_REPORT_DOWNLOADED",
    entityType: "ReportFile",
    entityId: file.id,
  });

  return {
    buffer,
    mimeType: file.mimeType,
    filename: file.originalFilename,
  };
}

export async function resolvePublicShareTokenDocument(params: {
  rawToken: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
  const tokenHash = sha256Hex(params.rawToken.trim());
  const share = await db.documentShareToken.findUnique({
    where: { tokenHash },
  });

  const now = new Date();
  if (!share || share.revokedAt || share.expiresAt <= now) {
    throw new AppError(
      "NOT_FOUND",
      "This document link has expired or been revoked.",
      404,
    );
  }
  if (share.maxViews !== null && share.viewCount >= share.maxViews) {
    throw new AppError(
      "FORBIDDEN",
      "Maximum allowed downloads reached for this link.",
      403,
    );
  }

  await db.documentShareToken.update({
    where: { id: share.id },
    data: { viewCount: { increment: 1 } },
  });

  await db.documentAccessLog.create({
    data: {
      resourceType: share.resourceType,
      resourceId: share.resourceId,
      shareTokenId: share.id,
      action: "PREVIEW",
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    },
  });

  const systemReaderContext: ActorContext = {
    userId: share.createdById,
    email: "share-token@system.internal",
    fullName: "Authorized Share Token Reader",
    portalType: "CONSULTANCY",
    roles: ["VIEWER_AUDITOR"],
    permissions: ["invoices:read", "payments:read", "reports:download"],
    partnerIds: [],
  };

  if (share.resourceType === "INVOICE") {
    const doc = await getInvoiceOrStatementPdfBuffer(
      systemReaderContext,
      share.resourceId,
      "invoice",
    );
    return { ...doc, mimeType: "application/pdf" };
  }

  if (share.resourceType === "STATEMENT") {
    const doc = await getInvoiceOrStatementPdfBuffer(
      systemReaderContext,
      share.resourceId,
      "statement",
    );
    return { ...doc, mimeType: "application/pdf" };
  }

  if (share.resourceType === "RECEIPT") {
    const doc = await getReceiptPdfBuffer(systemReaderContext, share.resourceId);
    return { ...doc, mimeType: "application/pdf" };
  }

  const reportFile = await db.reportFile.findUnique({
    where: { id: share.resourceId },
  });
  if (!reportFile) {
    throw new AppError("NOT_FOUND", "Shared report file not found.", 404);
  }
  const storage = getPrivateStorage();
  const buffer = await storage.getObjectBuffer(reportFile.storageKey);
  return {
    buffer,
    mimeType: reportFile.mimeType,
    filename: reportFile.originalFilename,
  };
}

export async function listAllReportItems(actor: ActorContext) {
  requirePermission(actor, "reports:read");
  return db.orderItem.findMany({
    where: { status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          patient: { select: { fullName: true, patientCode: true, mobile: true } },
          partner: { select: { displayName: true } },
        },
      },
      reportTracking: true,
      reportFiles: { where: { isLatest: true } },
    },
  });
}

