import { createHash } from "node:crypto";
import { z } from "zod";
import {
  DocumentKind,
  PaymentMethod,
  RefundMethod,
} from "@prisma/client";
import { db, type DbClient } from "@/lib/db";
import { nextDocumentNumber } from "@/lib/db/sequences";
import { AppError } from "@/lib/errors";
import {
  compareMoney,
  isPositiveMoney,
  money,
  subMoney,
  sumMoney,
} from "@/lib/money";
import { generatePaymentReceiptPdf } from "@/lib/pdf/documents";
import {
  requireConsultancyPortal,
  requirePermission,
} from "@/lib/permissions/rbac";
import type { ActorContext } from "@/lib/permissions/types";
import { getPrivateStorage } from "@/lib/storage";
import { postJournalEntry } from "@/modules/accounting/service";
import { writeAuditLog } from "@/modules/audit/service";
import {
  assertPaymentAllowedAgainstInvoice,
  computeInvoiceLedgerState,
} from "./ledger-math";

export const manualPaymentSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid INR amount."),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "OTHER"]),
  externalReference: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const initiateRefundSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  refundMethod: z.nativeEnum(RefundMethod),
  reason: z.string().trim().min(5, "Provide a refund reason for audit.").max(500),
});

/**
 * Finalizes any verified payment capture (manual cash/bank OR verified Razorpay checkout/QR)
 * inside an active database transaction holding a FOR UPDATE lock on the parent Invoice.
 */
export async function finalizeCapturedPaymentInTx(
  tx: DbClient,
  params: {
    invoiceId: string;
    paymentId: string;
    amount: string;
    paymentMethod: PaymentMethod;
    externalReference?: string | null;
    actorUserId?: string | null;
    ledgerDebitAccountCode: "1100" | "1110" | "1120";
  },
) {
  const invoice = await tx.invoice.findUnique({
    where: { id: params.invoiceId },
    include: {
      order: { select: { orderNumber: true } },
      payments: true,
      refunds: true,
    },
  });
  if (!invoice) {
    throw new AppError("NOT_FOUND", "Invoice not found.", 404);
  }

  const existingReceipt = await tx.paymentReceipt.findUnique({
    where: { paymentId: params.paymentId },
  });
  if (existingReceipt) {
    return { invoice, receipt: existingReceipt, alreadyCaptured: true };
  }

  const updatedPayments = invoice.payments.map((p) =>
    p.id === params.paymentId
      ? { amount: params.amount, status: "SUCCESS" as const }
      : { amount: p.amount.toString(), status: p.paymentStatus },
  );

  const ledgerState = computeInvoiceLedgerState({
    grandTotal: invoice.grandTotal.toString(),
    creditNoteTotal: invoice.creditNoteTotal.toString(),
    debitNoteTotal: invoice.debitNoteTotal.toString(),
    isVoid: invoice.status === "VOID",
    payments: updatedPayments,
    refunds: invoice.refunds.map((r) => ({
      amount: r.amount.toString(),
      status: r.status,
    })),
  });

  await tx.patientPayment.update({
    where: { id: params.paymentId },
    data: {
      paymentStatus: "SUCCESS",
      paymentMethod: params.paymentMethod,
      externalReference: params.externalReference ?? undefined,
      paymentDate: new Date(),
    },
  });

  const updatedInvoice = await tx.invoice.update({
    where: { id: invoice.id },
    data: {
      amountPaid: ledgerState.amountPaid,
      amountRefunded: ledgerState.amountRefunded,
      netCollected: ledgerState.netCollected,
      balanceDue: ledgerState.balanceDue,
      status: ledgerState.status,
    },
    include: { order: { select: { orderNumber: true } } },
  });

  const receiptNumber = await nextDocumentNumber(tx, "RECEIPT");
  const receipt = await tx.paymentReceipt.create({
    data: {
      receiptNumber,
      paymentId: params.paymentId,
      invoiceId: invoice.id,
      patientId: invoice.patientId,
      amount: money(params.amount),
      paymentMethodSnapshot: params.paymentMethod,
      invoiceBalanceAfter: ledgerState.balanceDue,
      issuedById: params.actorUserId ?? null,
    },
  });

  await postJournalEntry(tx, {
    referenceType: "PatientPayment",
    referenceId: params.paymentId,
    narration: `Split payment collected (${params.paymentMethod}) against ${invoice.invoiceNumber} — Receipt ${receiptNumber}`,
    postedById: params.actorUserId ?? null,
    lines: [
      {
        accountCode: params.ledgerDebitAccountCode,
        debitAmount: params.amount,
        creditAmount: "0.00",
      },
      {
        accountCode: "1200",
        debitAmount: "0.00",
        creditAmount: params.amount,
      },
    ],
  });

  return { invoice: updatedInvoice, receipt, alreadyCaptured: false };
}

export async function recordManualSplitPayment(
  actor: ActorContext,
  invoiceId: string,
  rawInput: unknown,
  idempotencyKey?: string | null,
) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "payments:collect");
  const input = manualPaymentSchema.parse(rawInput);
  const amount = money(input.amount);

  const txResult = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId}::uuid FOR UPDATE`;

    const [orgSettings, invoice] = await Promise.all([
      tx.organizationSettings.findFirst(),
      tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { order: { select: { orderNumber: true } } },
      }),
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

    const createdPayment = await tx.patientPayment.create({
      data: {
        invoiceId: invoice.id,
        amount,
        paymentMethod: input.paymentMethod,
        paymentStatus: "PENDING",
        collectedById: actor.userId,
        externalReference: input.externalReference || null,
        idempotencyKey: idempotencyKey || null,
        notes: input.notes || null,
      },
    });

    const debitAccount = input.paymentMethod === "CASH" ? "1100" : "1110";
    const finalized = await finalizeCapturedPaymentInTx(tx, {
      invoiceId: invoice.id,
      paymentId: createdPayment.id,
      amount,
      paymentMethod: input.paymentMethod,
      externalReference: input.externalReference,
      actorUserId: actor.userId,
      ledgerDebitAccountCode: debitAccount,
    });

    await writeAuditLog(tx, {
      actor,
      action: "MANUAL_PAYMENT_RECORDED",
      entityType: "PatientPayment",
      entityId: createdPayment.id,
      after: {
        invoiceNumber: invoice.invoiceNumber,
        receiptNumber: finalized.receipt.receiptNumber,
        amount,
        paymentMethod: input.paymentMethod,
        balanceDueAfter: finalized.invoice.balanceDue.toString(),
      },
    });

    return { paymentId: createdPayment.id, ...finalized };
  });

  // Render & store immutable Payment Receipt PDF outside DB row lock
  const pdfBuffer = await generatePaymentReceiptPdf({
    receiptNumber: txResult.receipt.receiptNumber,
    issuedAt: txResult.receipt.issuedAt,
    issuerLegalName: txResult.invoice.issuerLegalNameSnapshot,
    issuerAddress: txResult.invoice.issuerAddressSnapshot,
    invoiceNumber: txResult.invoice.invoiceNumber,
    orderNumber: txResult.invoice.order.orderNumber,
    patientName: txResult.invoice.patientNameSnapshot,
    patientCode: txResult.invoice.patientCodeSnapshot,
    paymentMethod: input.paymentMethod,
    externalReference: input.externalReference,
    amountPaid: amount,
    invoiceBalanceAfter: txResult.receipt.invoiceBalanceAfter.toString(),
  });

  const storage = getPrivateStorage();
  const storageKey = `receipts/${txResult.receipt.id}/${txResult.receipt.receiptNumber}.pdf`;
  await storage.putObject({
    storageKey,
    body: pdfBuffer,
    contentType: "application/pdf",
  });

  await db.paymentReceipt.update({
    where: { id: txResult.receipt.id },
    data: { pdfStorageKey: storageKey },
  });

  await db.invoiceDocument.create({
    data: {
      invoiceId: txResult.invoice.id,
      receiptId: txResult.receipt.id,
      docKind: DocumentKind.RECEIPT_PDF,
      storageKey,
      sha256Checksum: createHash("sha256").update(pdfBuffer).digest("hex"),
      fileSizeBytes: pdfBuffer.length,
      generatedById: actor.userId,
    },
  });

  return {
    paymentId: txResult.paymentId,
    receipt: txResult.receipt,
    invoiceStatus: txResult.invoice.status,
    balanceDue: money(txResult.invoice.balanceDue),
  };
}

export async function getReceiptPdfBuffer(
  actor: ActorContext,
  receiptId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  requireConsultancyPortal(actor);
  requirePermission(actor, "payments:read");

  const receipt = await db.paymentReceipt.findUnique({
    where: { id: receiptId },
    include: {
      invoice: { include: { order: { select: { orderNumber: true } } } },
      payment: true,
    },
  });
  if (!receipt) {
    throw new AppError("NOT_FOUND", "Payment receipt not found.", 404);
  }

  const storage = getPrivateStorage();
  if (receipt.pdfStorageKey) {
    const buffer = await storage.getObjectBuffer(receipt.pdfStorageKey);
    return { buffer, filename: `${receipt.receiptNumber}.pdf` };
  }

  const buffer = await generatePaymentReceiptPdf({
    receiptNumber: receipt.receiptNumber,
    issuedAt: receipt.issuedAt,
    issuerLegalName: receipt.invoice.issuerLegalNameSnapshot,
    issuerAddress: receipt.invoice.issuerAddressSnapshot,
    invoiceNumber: receipt.invoice.invoiceNumber,
    orderNumber: receipt.invoice.order.orderNumber,
    patientName: receipt.invoice.patientNameSnapshot,
    patientCode: receipt.invoice.patientCodeSnapshot,
    paymentMethod: receipt.paymentMethodSnapshot,
    externalReference: receipt.payment.externalReference,
    amountPaid: receipt.amount.toString(),
    invoiceBalanceAfter: receipt.invoiceBalanceAfter.toString(),
  });
  return { buffer, filename: `${receipt.receiptNumber}.pdf` };
}

export async function initiatePaymentRefund(
  actor: ActorContext,
  paymentId: string,
  rawInput: unknown,
  gatewayRefundCallback?: (params: {
    gatewayPaymentId: string;
    amountInr: string;
  }) => Promise<{ gatewayRefundId: string }>,
) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "refunds:initiate");
  const input = initiateRefundSchema.parse(rawInput);
  const refundAmount = money(input.amount);

  if (!isPositiveMoney(refundAmount)) {
    throw new AppError("BAD_REQUEST", "Refund amount must exceed ₹0.00.", 400);
  }

  const payment = await db.patientPayment.findUnique({
    where: { id: paymentId },
    include: {
      refunds: true,
      gatewayTransaction: true,
      invoice: true,
    },
  });

  if (!payment) {
    throw new AppError("NOT_FOUND", "Original payment transaction not found.", 404);
  }

  if (
    payment.paymentStatus !== "SUCCESS" &&
    payment.paymentStatus !== "PARTIALLY_REFUNDED"
  ) {
    throw new AppError(
      "BAD_REQUEST",
      `Cannot refund a payment with status ${payment.paymentStatus}.`,
      422,
    );
  }

  const alreadyRefundedOnPayment = sumMoney(
    payment.refunds
      .filter((r) => r.status === "PROCESSED" || r.status === "PENDING")
      .map((r) => r.amount.toString()),
  );
  const refundableRemaining = subMoney(
    payment.amount.toString(),
    alreadyRefundedOnPayment,
  );

  if (compareMoney(refundAmount, refundableRemaining) > 0) {
    throw new AppError(
      "BAD_REQUEST",
      `Refund amount (₹${refundAmount}) exceeds remaining refundable amount on this payment (₹${refundableRemaining}).`,
      422,
    );
  }

  let gatewayRefundId: string | null = null;
  if (input.refundMethod === "GATEWAY_REVERSAL") {
    if (!payment.gatewayTransaction?.gatewayPaymentId || !gatewayRefundCallback) {
      throw new AppError(
        "BAD_REQUEST",
        "Gateway reversal requires an associated verified Razorpay payment ID.",
        422,
      );
    }
    const gwRes = await gatewayRefundCallback({
      gatewayPaymentId: payment.gatewayTransaction.gatewayPaymentId,
      amountInr: refundAmount,
    });
    gatewayRefundId = gwRes.gatewayRefundId;
  }

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${payment.invoiceId}::uuid FOR UPDATE`;

    const refundNumber = await nextDocumentNumber(tx, "REFUND");
    const createdRefund = await tx.refund.create({
      data: {
        refundNumber,
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        refundMethod: input.refundMethod,
        gatewayRefundId,
        amount: refundAmount,
        reason: input.reason,
        status: "PROCESSED",
        requestedById: actor.userId,
        approvedById: actor.userId,
        processedAt: new Date(),
      },
    });

    const totalProcessedRefundsOnPayment = sumMoney([
      ...payment.refunds
        .filter((r) => r.status === "PROCESSED")
        .map((r) => r.amount.toString()),
      refundAmount,
    ]);

    const nextPaymentStatus =
      compareMoney(totalProcessedRefundsOnPayment, payment.amount.toString()) >= 0
        ? "REFUNDED"
        : "PARTIALLY_REFUNDED";

    await tx.patientPayment.update({
      where: { id: payment.id },
      data: { paymentStatus: nextPaymentStatus },
    });

    const freshInvoice = await tx.invoice.findUniqueOrThrow({
      where: { id: payment.invoiceId },
      include: { payments: true, refunds: true },
    });

    const ledgerState = computeInvoiceLedgerState({
      grandTotal: freshInvoice.grandTotal.toString(),
      creditNoteTotal: freshInvoice.creditNoteTotal.toString(),
      debitNoteTotal: freshInvoice.debitNoteTotal.toString(),
      isVoid: freshInvoice.status === "VOID",
      payments: freshInvoice.payments.map((p) => ({
        amount: p.amount.toString(),
        status: p.paymentStatus,
      })),
      refunds: freshInvoice.refunds.map((r) => ({
        amount: r.amount.toString(),
        status: r.status,
      })),
    });

    await tx.invoice.update({
      where: { id: payment.invoiceId },
      data: {
        amountPaid: ledgerState.amountPaid,
        amountRefunded: ledgerState.amountRefunded,
        netCollected: ledgerState.netCollected,
        balanceDue: ledgerState.balanceDue,
        status: ledgerState.status,
      },
    });

    const creditAccount =
      input.refundMethod === "CASH"
        ? "1100"
        : input.refundMethod === "GATEWAY_REVERSAL"
          ? "1120"
          : "1110";

    await postJournalEntry(tx, {
      referenceType: "Refund",
      referenceId: createdRefund.id,
      narration: `Refund ${refundNumber} against payment ${payment.id} (${freshInvoice.invoiceNumber})`,
      postedById: actor.userId,
      lines: [
        { accountCode: "1200", debitAmount: refundAmount, creditAmount: "0.00" },
        { accountCode: creditAccount, debitAmount: "0.00", creditAmount: refundAmount },
      ],
    });

    await writeAuditLog(tx, {
      actor,
      action: "PAYMENT_REFUNDED",
      entityType: "Refund",
      entityId: createdRefund.id,
      after: {
        refundNumber,
        amount: refundAmount,
        refundMethod: input.refundMethod,
        gatewayRefundId,
        reason: input.reason,
      },
    });

    return createdRefund;
  });
}

export async function listPayments(
  actor: ActorContext,
  params: { page?: number; pageSize?: number },
) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "payments:read");
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));

  const [totalItems, items] = await Promise.all([
    db.patientPayment.count(),
    db.patientPayment.findMany({
      orderBy: { paymentDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            patientNameSnapshot: true,
            patientCodeSnapshot: true,
          },
        },
        receipt: true,
        gatewayTransaction: true,
        collectedBy: { select: { fullName: true } },
      },
    }),
  ]);
  return { items, page, pageSize, totalItems };
}

