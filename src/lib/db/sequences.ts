import { createHash } from "node:crypto";
import { DocumentSequenceType, Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { db, type DbClient } from "./index";

const DEFAULT_PREFIXES: Record<DocumentSequenceType, string> = {
  PATIENT: "PAT",
  ORDER: "ORD",
  INVOICE: "INV",
  CREDIT_NOTE: "CN",
  DEBIT_NOTE: "DN",
  RECEIPT: "RCP",
  REFUND: "RFD",
  SETTLEMENT: "STL",
  JOURNAL: "JE",
};

/** Computes Indian Financial Year string (April 1 – March 31), e.g. "2026-27". */
export function getIndianFinancialYear(date: Date = new Date()): string {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffsetMs);
  const year = istDate.getUTCFullYear();
  const monthZeroIndexed = istDate.getUTCMonth(); // 0=Jan ... 3=Apr
  const startYear = monthZeroIndexed >= 3 ? year : year - 1;
  const endTwoDigit = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${endTwoDigit}`;
}

export async function nextDocumentNumber(
  tx: DbClient,
  docType: DocumentSequenceType,
  atDate: Date = new Date(),
): Promise<string> {
  const org = await tx.organization.findFirst({ select: { id: true } });
  if (!org) {
    throw new AppError(
      "POLICY_UNCONFIGURED",
      "Organization profile must be initialized before generating document numbers.",
      500,
    );
  }

  const fy = docType === "PATIENT" ? String(atDate.getUTCFullYear()) : getIndianFinancialYear(atDate);
  const defaultPrefix = DEFAULT_PREFIXES[docType];

  const seq = await tx.invoiceSequence.upsert({
    where: {
      organizationId_docType_financialYear: {
        organizationId: org.id,
        docType,
        financialYear: fy,
      },
    },
    create: {
      organizationId: org.id,
      docType,
      financialYear: fy,
      prefix: `${defaultPrefix}-${fy}-`,
      currentValue: 1,
      paddingLength: 5,
    },
    update: {
      currentValue: { increment: 1 },
    },
  });

  const padded = String(seq.currentValue).padStart(seq.paddingLength, "0");
  return `${seq.prefix}${padded}`;
}

export function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export async function withIdempotency<T>(params: {
  key: string | null | undefined;
  actorId: string;
  route: string;
  requestPayload: unknown;
  statusCode?: number;
  execute: () => Promise<T>;
}): Promise<{ statusCode: number; data: T; replayed: boolean }> {
  const trimmedKey = params.key?.trim();
  if (!trimmedKey) {
    const data = await params.execute();
    return { statusCode: params.statusCode ?? 200, data, replayed: false };
  }
  if (trimmedKey.length > 128) {
    throw new AppError("BAD_REQUEST", "Idempotency-Key must not exceed 128 characters.", 400);
  }

  const requestHash = sha256Hex(JSON.stringify(params.requestPayload ?? {}));
  const existing = await db.idempotencyRecord.findUnique({
    where: {
      actorId_route_key: {
        actorId: params.actorId,
        route: params.route,
        key: trimmedKey,
      },
    },
  });

  if (existing && existing.expiresAt > new Date()) {
    if (existing.requestHash !== requestHash) {
      throw new AppError(
        "IDEMPOTENCY_PAYLOAD_MISMATCH",
        "Idempotency-Key was already used with different request parameters.",
        409,
      );
    }
    return {
      statusCode: existing.statusCode,
      data: existing.responseJson as T,
      replayed: true,
    };
  }

  const data = await params.execute();
  const statusCode = params.statusCode ?? 201;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.idempotencyRecord.upsert({
    where: {
      actorId_route_key: {
        actorId: params.actorId,
        route: params.route,
        key: trimmedKey,
      },
    },
    create: {
      actorId: params.actorId,
      route: params.route,
      key: trimmedKey,
      requestHash,
      statusCode,
      responseJson: data as Prisma.InputJsonValue,
      expiresAt,
    },
    update: {
      requestHash,
      statusCode,
      responseJson: data as Prisma.InputJsonValue,
      expiresAt,
    },
  });

  return { statusCode, data, replayed: false };
}

