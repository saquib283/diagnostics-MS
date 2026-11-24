import { z } from "zod";
import {
  GatewayProvider,
  PaymentMethod,
  Prisma,
  WebhookProcessingStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { redactSensitiveData } from "@/lib/logger";
import { addMoney, fromPaise, isPositiveMoney, money, toPaise } from "@/lib/money";
import {
  requireConsultancyPortal,
  requirePermission,
} from "@/lib/permissions/rbac";
import type { ActorContext } from "@/lib/permissions/types";
import { postJournalEntry } from "@/modules/accounting/service";
import { writeAuditLog } from "@/modules/audit/service";
import { assertPaymentAllowedAgainstInvoice } from "@/modules/payments/ledger-math";
import { finalizeCapturedPaymentInTx } from "@/modules/payments/service";
import {
  evaluateQrSessionAvailability,
  extractGatewayFeeBreakdown,
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from "./signature";

function getRazorpayAuthHeader(): { keyId: string; keySecret: string; basicAuth: string } {
  const env = getEnv();
  if (!env.RAZORPAY_ENABLED || !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new AppError(
      "POLICY_UNCONFIGURED",
      "Razorpay integration is disabled or credentials are not configured in server environment.",
      422,
    );
  }
  const basicAuth = Buffer.from(
    `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`,
    "utf8",
  ).toString("base64");
  return { keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET, basicAuth };
}

async function razorpayApiRequest<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const { basicAuth } = getRazorpayAuthHeader();
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json()) as T & { error?: { description?: string } };
  if (!res.ok) {
    throw new AppError(
      "BAD_REQUEST",
      body.error?.description ?? `Razorpay API returned HTTP ${res.status}`,
      502,
    );
  }
  return body;
}

function mapRazorpayMethodToEnum(rawMethod?: string | null): PaymentMethod {
  switch ((rawMethod ?? "").toLowerCase()) {
    case "upi":
      return "UPI_ONLINE";
    case "card":
      return "CARD";
    case "netbanking":
      return "NETBANKING";
    case "wallet":
      return "WALLET";
    default:
      return "OTHER";
  }
}

export const createRazorpayOrderSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  preferredMethod: z.enum(["CARD", "UPI_ONLINE", "NETBANKING"]).default("CARD"),
});

export const verifyRazorpayCallbackSchema = z.object({
  razorpayOrderId: z.string().min(4),
  razorpayPaymentId: z.string().min(4),
  razorpaySignature: z.string().min(16),
});

export const createDynamicQrSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export async function initiateRazorpayOrderForInvoice(
  actor: ActorContext,
  invoiceId: string,
  rawInput: unknown,
) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "payments:collect");
  const input = createRazorpayOrderSchema.parse(rawInput);
  const { keyId } = getRazorpayAuthHeader();
  const amount = money(input.amount);

  const [orgSettings, invoice] = await Promise.all([
    db.organizationSettings.findFirst(),
    db.invoice.findUnique({ where: { id: invoiceId } }),
  ]);
  if (!invoice) {
    throw new AppError("NOT_FOUND", "Invoice not found.", 404);
  }

  assertPaymentAllowedAgainstInvoice({
    invoiceStatus: invoice.status,
    balanceDue: invoice.balanceDue.toString(),
    attemptedAmount: amount,
    allowOverpayment: orgSettings?.allowInvoiceOverpayment ?? false,
  });

  const amountPaise = toPaise(amount);
  const rzpOrder = await razorpayApiRequest<{ id: string; status: string }>(
    "/orders",
    {
      method: "POST",
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: `${invoice.invoiceNumber}-${Date.now()}`,
        notes: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
        },
      }),
    },
  );

  const payment = await db.$transaction(async (tx) => {
    const p = await tx.patientPayment.create({
      data: {
        invoiceId: invoice.id,
        amount,
        paymentMethod: input.preferredMethod,
        paymentStatus: "PENDING",
        collectedById: actor.userId,
        externalReference: rzpOrder.id,
        gatewayTransaction: {
          create: {
            gateway: GatewayProvider.RAZORPAY,
            gatewayOrderId: rzpOrder.id,
            gatewayStatus: rzpOrder.status,
            grossAmount: amount,
          },
        },
      },
    });

    await writeAuditLog(tx, {
      actor,
      action: "RAZORPAY_ORDER_INITIATED",
      entityType: "PatientPayment",
      entityId: p.id,
      after: { razorpayOrderId: rzpOrder.id, amount },
    });

    return p;
  });

  return {
    paymentId: payment.id,
    razorpayKeyId: keyId,
    razorpayOrderId: rzpOrder.id,
    amountPaise,
    currency: "INR",
    invoiceNumber: invoice.invoiceNumber,
    patientName: invoice.patientNameSnapshot,
    patientMobile: invoice.patientMobileSnapshot,
  };
}

export async function verifyAndCaptureRazorpayCheckout(
  actor: ActorContext,
  rawInput: unknown,
) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "payments:collect");
  const input = verifyRazorpayCallbackSchema.parse(rawInput);
  const { keySecret } = getRazorpayAuthHeader();

  const sigOk = verifyRazorpayCheckoutSignature({
    razorpayOrderId: input.razorpayOrderId,
    razorpayPaymentId: input.razorpayPaymentId,
    razorpaySignature: input.razorpaySignature,
    keySecret,
  });

  if (!sigOk) {
    throw new AppError(
      "FORBIDDEN",
      "Invalid Razorpay payment signature. Capture rejected.",
      403,
    );
  }

  // Authoritative backend fetch: never rely solely on browser callback fields
  const rzpPayment = await razorpayApiRequest<{
    id: string;
    order_id: string;
    status: string;
    method: string;
    amount: number;
    fee?: number;
    tax?: number;
  }>(`/payments/${encodeURIComponent(input.razorpayPaymentId)}`, {
    method: "GET",
  });

  if (rzpPayment.status !== "captured" || rzpPayment.order_id !== input.razorpayOrderId) {
    throw new AppError(
      "BAD_REQUEST",
      `Gateway payment status is '${rzpPayment.status}' (not captured).`,
      422,
    );
  }

  const feeBreakdown = extractGatewayFeeBreakdown({
    amountPaise: rzpPayment.amount,
    feePaise: rzpPayment.fee,
    taxPaise: rzpPayment.tax,
  });
  const mappedMethod = mapRazorpayMethodToEnum(rzpPayment.method);

  return db.$transaction(async (tx) => {
    const gwTx = await tx.paymentGatewayTransaction.findFirst({
      where: { gatewayOrderId: input.razorpayOrderId },
      include: { payment: true },
    });
    if (!gwTx) {
      throw new AppError("NOT_FOUND", "Matching payment attempt not found.", 404);
    }

    await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${gwTx.payment.invoiceId}::uuid FOR UPDATE`;

    await tx.paymentGatewayTransaction.update({
      where: { id: gwTx.id },
      data: {
        gatewayPaymentId: rzpPayment.id,
        gatewaySignatureVerified: true,
        gatewayMethod: rzpPayment.method,
        gatewayStatus: rzpPayment.status,
        gatewayFee: feeBreakdown.gatewayFee,
        gatewayFeeTax: feeBreakdown.gatewayFeeTax,
        netSettlementEstimate: feeBreakdown.netSettlementEstimate,
        verifiedAt: new Date(),
      },
    });

    const finalized = await finalizeCapturedPaymentInTx(tx, {
      invoiceId: gwTx.payment.invoiceId,
      paymentId: gwTx.paymentId,
      amount: feeBreakdown.grossAmount,
      paymentMethod: mappedMethod,
      externalReference: rzpPayment.id,
      actorUserId: actor.userId,
      ledgerDebitAccountCode: "1120",
    });

    await writeAuditLog(tx, {
      actor,
      action: "RAZORPAY_CHECKOUT_CAPTURED",
      entityType: "PatientPayment",
      entityId: gwTx.paymentId,
      after: {
        razorpayPaymentId: rzpPayment.id,
        method: mappedMethod,
        grossAmount: feeBreakdown.grossAmount,
        gatewayFee: feeBreakdown.gatewayFee,
        gatewayFeeTax: feeBreakdown.gatewayFeeTax,
      },
    });

    return finalized;
  });
}

export async function createDynamicInvoiceUpiQr(
  actor: ActorContext,
  invoiceId: string,
  rawInput: unknown,
) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "payments:collect");
  const input = createDynamicQrSchema.parse(rawInput);
  const env = getEnv();

  if (!env.RAZORPAY_ENABLED || !env.RAZORPAY_DYNAMIC_QR_ENABLED) {
    throw new AppError(
      "POLICY_UNCONFIGURED",
      "Dynamic Razorpay UPI QR is not enabled on this server/merchant configuration.",
      422,
    );
  }

  const amount = money(input.amount);
  const [orgSettings, invoice] = await Promise.all([
    db.organizationSettings.findFirst(),
    db.invoice.findUnique({ where: { id: invoiceId } }),
  ]);
  if (!invoice) {
    throw new AppError("NOT_FOUND", "Invoice not found.", 404);
  }

  assertPaymentAllowedAgainstInvoice({
    invoiceStatus: invoice.status,
    balanceDue: invoice.balanceDue.toString(),
    attemptedAmount: amount,
    allowOverpayment: orgSettings?.allowInvoiceOverpayment ?? false,
  });

  const expiresAtUnix = Math.floor(Date.now() / 1000) + env.RAZORPAY_QR_TTL_SECONDS;
  const expiresAt = new Date(expiresAtUnix * 1000);

  const qrResp = await razorpayApiRequest<{
    id: string;
    image_url: string;
    status: string;
  }>("/payments/qr_codes", {
    method: "POST",
    body: JSON.stringify({
      type: "upi_qr",
      name: `INV ${invoice.invoiceNumber}`,
      usage: "single_use",
      fixed_amount: true,
      payment_amount: toPaise(amount),
      description: `Diagnostic Invoice ${invoice.invoiceNumber}`,
      close_by: expiresAtUnix,
      notes: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      },
    }),
  });

  return db.$transaction(async (tx) => {
    const payment = await tx.patientPayment.create({
      data: {
        invoiceId: invoice.id,
        amount,
        paymentMethod: "UPI_QR",
        paymentStatus: "PENDING",
        collectedById: actor.userId,
        externalReference: qrResp.id,
        gatewayTransaction: {
          create: {
            gateway: GatewayProvider.RAZORPAY,
            gatewayQrId: qrResp.id,
            gatewayStatus: qrResp.status,
            grossAmount: amount,
          },
        },
      },
    });

    const qrSession = await tx.paymentQrSession.create({
      data: {
        paymentId: payment.id,
        invoiceId: invoice.id,
        gatewayQrId: qrResp.id,
        qrMode: "DYNAMIC_SINGLE_USE",
        amount,
        qrImageUrl: qrResp.image_url,
        status: "ACTIVE",
        expiresAt,
        createdById: actor.userId,
      },
    });

    await writeAuditLog(tx, {
      actor,
      action: "DYNAMIC_UPI_QR_CREATED",
      entityType: "PaymentQrSession",
      entityId: qrSession.id,
      after: { gatewayQrId: qrResp.id, amount, expiresAt: expiresAt.toISOString() },
    });

    return qrSession;
  });
}

export async function closeDynamicUpiQrSession(
  actor: ActorContext,
  qrSessionId: string,
) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "payments:collect");

  const session = await db.paymentQrSession.findUnique({
    where: { id: qrSessionId },
  });
  if (!session) {
    throw new AppError("NOT_FOUND", "QR session not found.", 404);
  }
  if (session.status !== "ACTIVE") {
    return session;
  }

  const env = getEnv();
  if (env.RAZORPAY_ENABLED) {
    await razorpayApiRequest(
      `/payments/qr_codes/${encodeURIComponent(session.gatewayQrId)}/close`,
      { method: "POST", body: "{}" },
    );
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.paymentQrSession.update({
      where: { id: qrSessionId },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    await tx.patientPayment.updateMany({
      where: { id: session.paymentId, paymentStatus: "PENDING" },
      data: { paymentStatus: "CANCELLED" },
    });
    await writeAuditLog(tx, {
      actor,
      action: "DYNAMIC_UPI_QR_CLOSED",
      entityType: "PaymentQrSession",
      entityId: qrSessionId,
    });
    return updated;
  });
}

export async function issueRazorpayGatewayRefund(params: {
  gatewayPaymentId: string;
  amountInr: string;
}): Promise<{ gatewayRefundId: string }> {
  const resp = await razorpayApiRequest<{ id: string }>(
    `/payments/${encodeURIComponent(params.gatewayPaymentId)}/refund`,
    {
      method: "POST",
      body: JSON.stringify({
        amount: toPaise(params.amountInr),
        speed: "normal",
      }),
    },
  );
  return { gatewayRefundId: resp.id };
}

/**
 * Idempotent raw-body Razorpay webhook processor.
 * Verifies HMAC-SHA256 against exact raw body string before touching business tables.
 */
export async function processRazorpayRawWebhook(params: {
  rawBody: string;
  signatureHeader: string | null | undefined;
  eventIdHeader: string | null | undefined;
}) {
  const env = getEnv();
  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    throw new AppError(
      "POLICY_UNCONFIGURED",
      "RAZORPAY_WEBHOOK_SECRET is not configured.",
      500,
    );
  }

  const signatureOk = verifyRazorpayWebhookSignature({
    rawBody: params.rawBody,
    signatureHeader: params.signatureHeader,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  });

  if (!signatureOk) {
    throw new AppError("FORBIDDEN", "Invalid Razorpay webhook signature.", 401);
  }

  const parsed = JSON.parse(params.rawBody) as {
    event?: string;
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          order_id?: string;
          amount?: number;
          fee?: number;
          tax?: number;
          method?: string;
          status?: string;
          notes?: { invoiceId?: string };
        };
      };
      qr_code?: {
        entity?: {
          id?: string;
          status?: string;
        };
      };
      settlement?: {
        entity?: {
          id?: string;
          utr?: string;
          amount?: number;
          fees?: number;
          tax?: number;
          created_at?: number;
        };
      };
    };
  };

  const eventType = parsed.event ?? "unknown";
  const derivedEventId =
    params.eventIdHeader?.trim() ||
    `${eventType}:${parsed.payload?.payment?.entity?.id ?? parsed.payload?.qr_code?.entity?.id ?? parsed.payload?.settlement?.entity?.id ?? Date.now()}`;

  const existingEvent = await db.paymentWebhookEvent.findUnique({
    where: {
      gateway_eventId: {
        gateway: GatewayProvider.RAZORPAY,
        eventId: derivedEventId,
      },
    },
  });

  if (existingEvent) {
    return { status: "IGNORED_DUPLICATE", eventId: derivedEventId };
  }

  const webhookRow = await db.paymentWebhookEvent.create({
    data: {
      gateway: GatewayProvider.RAZORPAY,
      eventId: derivedEventId,
      eventType,
      signatureVerified: true,
      processingStatus: WebhookProcessingStatus.RECEIVED,
      redactedPayloadJson: redactSensitiveData(parsed) as Prisma.InputJsonValue,
    },
  });

  await db.$transaction(async (tx) => {
    const paymentEntity = parsed.payload?.payment?.entity;
    const qrEntity = parsed.payload?.qr_code?.entity;
    const settlementEntity = parsed.payload?.settlement?.entity;

    if (
      (eventType === "payment.captured" || eventType === "qr_code.credited") &&
      paymentEntity?.id &&
      paymentEntity.amount
    ) {
      const feeBreakdown = extractGatewayFeeBreakdown({
        amountPaise: paymentEntity.amount,
        feePaise: paymentEntity.fee,
        taxPaise: paymentEntity.tax,
      });

      const gwTx = await tx.paymentGatewayTransaction.findFirst({
        where: {
          OR: [
            ...(paymentEntity.order_id
              ? [{ gatewayOrderId: paymentEntity.order_id }]
              : []),
            ...(qrEntity?.id ? [{ gatewayQrId: qrEntity.id }] : []),
          ],
        },
        include: { payment: true },
      });

      if (gwTx) {
        await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${gwTx.payment.invoiceId}::uuid FOR UPDATE`;

        if (qrEntity?.id) {
          const qrSession = await tx.paymentQrSession.findUnique({
            where: { gatewayQrId: qrEntity.id },
          });
          if (qrSession) {
            const availability = evaluateQrSessionAvailability(qrSession, new Date());
            if (availability === "ALREADY_USED") {
              return;
            }
            await tx.paymentQrSession.update({
              where: { id: qrSession.id },
              data: { status: "CREDITED", closedAt: new Date() },
            });
          }
        }

        await tx.paymentGatewayTransaction.update({
          where: { id: gwTx.id },
          data: {
            gatewayPaymentId: paymentEntity.id,
            gatewaySignatureVerified: true,
            gatewayMethod: paymentEntity.method ?? "upi",
            gatewayStatus: "captured",
            gatewayFee: feeBreakdown.gatewayFee,
            gatewayFeeTax: feeBreakdown.gatewayFeeTax,
            netSettlementEstimate: feeBreakdown.netSettlementEstimate,
            verifiedAt: new Date(),
          },
        });

        await finalizeCapturedPaymentInTx(tx, {
          invoiceId: gwTx.payment.invoiceId,
          paymentId: gwTx.paymentId,
          amount: feeBreakdown.grossAmount,
          paymentMethod: qrEntity?.id
            ? "UPI_QR"
            : mapRazorpayMethodToEnum(paymentEntity.method),
          externalReference: paymentEntity.id,
          ledgerDebitAccountCode: "1120",
        });
      }
    } else if (eventType === "payment.failed" && paymentEntity?.order_id) {
      const gwTx = await tx.paymentGatewayTransaction.findFirst({
        where: { gatewayOrderId: paymentEntity.order_id },
      });
      if (gwTx) {
        await tx.paymentGatewayTransaction.update({
          where: { id: gwTx.id },
          data: {
            gatewayPaymentId: paymentEntity.id ?? null,
            gatewayStatus: "failed",
          },
        });
        await tx.patientPayment.updateMany({
          where: { id: gwTx.paymentId, paymentStatus: "PENDING" },
          data: { paymentStatus: "FAILED" },
        });
      }
    } else if (eventType === "qr_code.closed" && qrEntity?.id) {
      await tx.paymentQrSession.updateMany({
        where: { gatewayQrId: qrEntity.id, status: "ACTIVE" },
        data: { status: "EXPIRED", closedAt: new Date() },
      });
    } else if (eventType === "settlement.processed" && settlementEntity?.id) {
      const netAmount = fromPaise(settlementEntity.amount ?? 0);
      const totalFee = fromPaise(settlementEntity.fees ?? 0);
      const totalTax = fromPaise(settlementEntity.tax ?? 0);

      await tx.gatewaySettlement.upsert({
        where: { gatewaySettlementId: settlementEntity.id },
        create: {
          gateway: GatewayProvider.RAZORPAY,
          gatewaySettlementId: settlementEntity.id,
          utrNumber: settlementEntity.utr ?? null,
          grossAmount: netAmount,
          totalFee,
          totalTax,
          netAmount,
          settledAt: settlementEntity.created_at
            ? new Date(settlementEntity.created_at * 1000)
            : new Date(),
        },
        update: {
          utrNumber: settlementEntity.utr ?? undefined,
        },
      });
    }

    await tx.paymentWebhookEvent.update({
      where: { id: webhookRow.id },
      data: {
        processingStatus: WebhookProcessingStatus.PROCESSED,
        processedAt: new Date(),
      },
    });
  });

  return { status: "PROCESSED", eventId: derivedEventId };
}

export const reconcileStaticQrSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  utrReference: z.string().trim().min(4).max(120),
  notes: z.string().max(500).optional().nullable(),
});

export async function reconcileStaticQrCollectionToInvoice(
  actor: ActorContext,
  rawInput: unknown,
) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "payments:reconcile");
  const input = reconcileStaticQrSchema.parse(rawInput);
  const amount = money(input.amount);

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${input.invoiceId}::uuid FOR UPDATE`;

    const [orgSettings, invoice] = await Promise.all([
      tx.organizationSettings.findFirst(),
      tx.invoice.findUnique({ where: { id: input.invoiceId } }),
    ]);

    if (!orgSettings?.staticQrFallbackEnabled) {
      throw new AppError(
        "POLICY_UNCONFIGURED",
        "Static QR manual reconciliation is disabled in Organization Settings.",
        422,
      );
    }
    if (!invoice) {
      throw new AppError("NOT_FOUND", "Invoice not found.", 404);
    }

    assertPaymentAllowedAgainstInvoice({
      invoiceStatus: invoice.status,
      balanceDue: invoice.balanceDue.toString(),
      attemptedAmount: amount,
      allowOverpayment: orgSettings.allowInvoiceOverpayment,
    });

    const payment = await tx.patientPayment.create({
      data: {
        invoiceId: invoice.id,
        amount,
        paymentMethod: "STATIC_QR_MANUAL",
        paymentStatus: "PENDING",
        collectedById: actor.userId,
        externalReference: input.utrReference,
        notes: input.notes || "Reconciled static QR bank UTR",
      },
    });

    const finalized = await finalizeCapturedPaymentInTx(tx, {
      invoiceId: invoice.id,
      paymentId: payment.id,
      amount,
      paymentMethod: "STATIC_QR_MANUAL",
      externalReference: input.utrReference,
      actorUserId: actor.userId,
      ledgerDebitAccountCode: "1110",
    });

    await tx.collectionRecord.create({
      data: {
        recordType: "STATIC_QR_UNMATCHED",
        matchedInvoiceId: invoice.id,
        matchedPaymentId: payment.id,
        amount,
        referenceNumber: input.utrReference,
        collectedAt: new Date(),
        reconciliationStatus: "MATCHED",
        reconciledById: actor.userId,
        notes: input.notes || null,
      },
    });

    await writeAuditLog(tx, {
      actor,
      action: "STATIC_QR_RECONCILED",
      entityType: "PatientPayment",
      entityId: payment.id,
      after: { invoiceNumber: invoice.invoiceNumber, amount, utrReference: input.utrReference },
    });

    return finalized;
  });
}

export const reconcileGatewayBatchToBankSchema = z.object({
  gatewaySettlementId: z.string().min(4).max(80),
  utrNumber: z.string().trim().min(4).max(80),
  grossAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  totalFee: z.string().regex(/^\d+(\.\d{1,2})?$/).default("0.00"),
  totalTax: z.string().regex(/^\d+(\.\d{1,2})?$/).default("0.00"),
  netBankCreditAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export async function reconcileGatewayBatchToBank(
  actor: ActorContext,
  rawInput: unknown,
) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "payments:reconcile");
  const input = reconcileGatewayBatchToBankSchema.parse(rawInput);

  return db.$transaction(async (tx) => {
    const batch = await tx.gatewaySettlement.upsert({
      where: { gatewaySettlementId: input.gatewaySettlementId },
      create: {
        gateway: GatewayProvider.RAZORPAY,
        gatewaySettlementId: input.gatewaySettlementId,
        utrNumber: input.utrNumber,
        grossAmount: money(input.grossAmount),
        totalFee: money(input.totalFee),
        totalTax: money(input.totalTax),
        netAmount: money(input.netBankCreditAmount),
        settledAt: new Date(),
        bankReconciledAt: new Date(),
        reconciledById: actor.userId,
      },
      update: {
        utrNumber: input.utrNumber,
        bankReconciledAt: new Date(),
        reconciledById: actor.userId,
      },
    });

    const feePlusTax = addMoney(input.totalFee, input.totalTax);
    const lines = [
      {
        accountCode: "1110",
        debitAmount: money(input.netBankCreditAmount),
        creditAmount: "0.00",
      },
      ...(isPositiveMoney(feePlusTax)
        ? [{ accountCode: "5200", debitAmount: feePlusTax, creditAmount: "0.00" }]
        : []),
      {
        accountCode: "1120",
        debitAmount: "0.00",
        creditAmount: money(input.grossAmount),
      },
    ];

    await postJournalEntry(tx, {
      referenceType: "GatewaySettlement",
      referenceId: batch.id,
      narration: `Razorpay settlement ${input.gatewaySettlementId} reconciled to bank (UTR: ${input.utrNumber})`,
      postedById: actor.userId,
      lines,
    });

    await writeAuditLog(tx, {
      actor,
      action: "GATEWAY_SETTLEMENT_BANK_RECONCILED",
      entityType: "GatewaySettlement",
      entityId: batch.id,
      after: batch,
    });

    return batch;
  });
}

export async function listReconciliationOverview(actor: ActorContext) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "payments:reconcile");

  const [orgSettings, openInvoices, gatewaySettlements] = await Promise.all([
    db.organizationSettings.findFirst(),
    db.invoice.findMany({
      where: { status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
      orderBy: { issueDate: "desc" },
      take: 50,
      select: {
        id: true,
        invoiceNumber: true,
        patientNameSnapshot: true,
        balanceDue: true,
      },
    }),
    db.gatewaySettlement.findMany({
      orderBy: { settledAt: "desc" },
      take: 30,
    }),
  ]);

  return {
    staticQrFallbackEnabled: Boolean(orgSettings?.staticQrFallbackEnabled),
    openInvoices: openInvoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      patientName: inv.patientNameSnapshot,
      balanceDue: money(inv.balanceDue),
    })),
    gatewaySettlements,
  };
}

