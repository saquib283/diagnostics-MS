import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import {
  AdjustmentNoteType,
  DeliveryStatus,
  DocumentKind,
  InvoiceStatus,
  Prisma,
  ShareChannel,
  ShareResourceType,
} from "@prisma/client";
import { db } from "@/lib/db";
import { nextDocumentNumber, sha256Hex } from "@/lib/db/sequences";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import {
  addMoney,
  computeGstBreakdown,
  isPositiveMoney,
  money,
  mulMoney,
  sumMoney,
} from "@/lib/money";
import { generateInvoiceOrStatementPdf } from "@/lib/pdf/documents";
import {
  requireConsultancyPortal,
  requirePermission,
} from "@/lib/permissions/rbac";
import type { ActorContext } from "@/lib/permissions/types";
import { getPrivateStorage } from "@/lib/storage";
import { postJournalEntry } from "@/modules/accounting/service";
import { writeAuditLog } from "@/modules/audit/service";
import {
  sendTransactionalEmail,
  sendWhatsAppTemplateNotification,
} from "@/modules/notifications/service";
import {
  assertInvoiceModelEligibility,
  assertPartnerRefModelEligibility,
  computeInvoiceLedgerState,
} from "@/modules/payments/ledger-math";

export const recordPartnerInvoiceRefSchema = z.object({
  partnerInvoiceNumber: z.string().trim().min(1).max(80),
  partnerReceiptNumber: z.string().trim().max(80).optional().nullable(),
  invoiceDate: z.coerce.date(),
  grossAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  discountAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).default("0.00"),
  taxAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).default("0.00"),
  netAmountPaidByPatient: z.string().regex(/^\d+(\.\d{1,2})?$/),
  paymentModeReported: z.string().trim().max(40).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const createInvoiceAdjustmentSchema = z.object({
  noteType: z.nativeEnum(AdjustmentNoteType),
  reason: z.string().trim().min(5, "Provide a clear audit reason.").max(1000),
  taxableDelta: z.string().regex(/^\d+(\.\d{1,2})?$/),
  taxDelta: z.string().regex(/^\d+(\.\d{1,2})?$/).default("0.00"),
});

export const shareDocumentSchema = z.object({
  resourceType: z.nativeEnum(ShareResourceType),
  channel: z.nativeEnum(ShareChannel),
  recipientMobile: z.string().trim().max(24).optional().nullable(),
  recipientEmail: z.string().trim().email().max(160).optional().nullable().or(z.literal("")),
  ttlHours: z.coerce.number().int().min(1).max(720).optional(),
});

export async function issueModelAInvoice(actor: ActorContext, orderId: string) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "invoices:issue");

  const storage = getPrivateStorage();

  const result = await db.$transaction(async (tx) => {
    const [org, order, existingInvoice] = await Promise.all([
      tx.organization.findFirst({ include: { settings: true } }),
      tx.diagnosticOrder.findUnique({
        where: { id: orderId },
        include: {
          patient: true,
          partner: true,
          items: { where: { status: { not: "CANCELLED" } } },
        },
      }),
      tx.invoice.findUnique({ where: { orderId } }),
    ]);

    if (!org || !org.settings) {
      throw new AppError("POLICY_UNCONFIGURED", "Organization settings missing.", 500);
    }
    if (!order) {
      throw new AppError("NOT_FOUND", "Diagnostic order not found.", 404);
    }
    if (existingInvoice) {
      return { invoice: existingInvoice, alreadyIssued: true, pdfPayload: null };
    }

    assertInvoiceModelEligibility(order.paymentModel);

    if (order.items.length === 0) {
      throw new AppError(
        "BAD_REQUEST",
        "Cannot issue an invoice for an order with zero active test items.",
        422,
      );
    }

    const invoiceNumber = await nextDocumentNumber(tx, "INVOICE");
    const issueDate = new Date();

    const builtItems = order.items.map((item) => {
      const gst = computeGstBreakdown({
        taxableAmount: item.taxableAmountSnapshot.toString(),
        cgstRate: item.cgstRateSnapshot.toString(),
        sgstRate: item.sgstRateSnapshot.toString(),
        igstRate: item.igstRateSnapshot.toString(),
        isExempt: Number(item.taxAmountSnapshot.toString()) === 0,
        issuerStateCode: org.stateCode,
        placeOfSupplyStateCode: order.partner.stateCode,
      });

      return {
        orderItemId: item.id,
        descriptionSnapshot: item.testNameSnapshot,
        testCodeSnapshot: item.testCodeSnapshot,
        hsnSacSnapshot: item.hsnSacSnapshot,
        quantity: item.quantity,
        unitPrice: item.unitSellingPriceSnapshot.toString(),
        discountAmount: item.discountAmountSnapshot.toString(),
        taxableAmount: item.taxableAmountSnapshot.toString(),
        cgstRate: gst.cgstRate,
        cgstAmount: gst.cgstAmount,
        sgstRate: gst.sgstRate,
        sgstAmount: gst.sgstAmount,
        igstRate: gst.igstRate,
        igstAmount: gst.igstAmount,
        lineTotal: gst.lineTotal,
        taxCodeSnapshot: item.taxCodeSnapshot ?? "EXEMPT",
      };
    });

    const subtotalAmount = sumMoney(
      builtItems.map((i) => mulMoney(i.unitPrice, i.quantity)),
    );
    const discountAmount = sumMoney(builtItems.map((i) => i.discountAmount));
    const taxableAmount = sumMoney(builtItems.map((i) => i.taxableAmount));
    const cgstAmount = sumMoney(builtItems.map((i) => i.cgstAmount));
    const sgstAmount = sumMoney(builtItems.map((i) => i.sgstAmount));
    const igstAmount = sumMoney(builtItems.map((i) => i.igstAmount));
    const totalTaxAmount = sumMoney([cgstAmount, sgstAmount, igstAmount]);
    const grandTotal = addMoney(taxableAmount, totalTaxAmount);

    const issuerAddressSnapshot = `${org.registeredAddress}, ${org.city}, ${org.stateName} - ${org.pincode}`;

    const createdInvoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        orderId: order.id,
        patientId: order.patientId,
        partnerId: order.partnerId,
        status: "UNPAID",
        documentTitleSnapshot: org.settings.invoiceDocumentTitle,
        issueDate,
        issuerLegalNameSnapshot: org.legalName,
        issuerGstinSnapshot: org.gstin,
        issuerAddressSnapshot,
        patientNameSnapshot: order.patient.fullName,
        patientCodeSnapshot: order.patient.patientCode,
        patientMobileSnapshot: order.patient.mobile,
        partnerNameSnapshot: order.partner.displayName,
        placeOfSupplyStateCode: order.partner.stateCode,
        subtotalAmount,
        discountAmount,
        taxableAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        totalTaxAmount,
        grandTotal,
        effectiveTotal: grandTotal,
        amountPaid: "0.00",
        amountRefunded: "0.00",
        netCollected: "0.00",
        balanceDue: grandTotal,
        termsSnapshot: org.settings.invoiceTermsText,
        issuedById: actor.userId,
        items: {
          create: builtItems.map(({ taxCodeSnapshot: _tc, ...rest }) => rest),
        },
        taxSnapshots: {
          create: [
            {
              taxCodeSnapshot: builtItems[0]?.taxCodeSnapshot ?? "EXEMPT",
              hsnSacSnapshot: builtItems[0]?.hsnSacSnapshot ?? null,
              taxableValue: taxableAmount,
              cgstRate: builtItems[0]?.cgstRate ?? "0.0000",
              cgstAmount,
              sgstRate: builtItems[0]?.sgstRate ?? "0.0000",
              sgstAmount,
              igstRate: builtItems[0]?.igstRate ?? "0.0000",
              igstAmount,
              totalTax: totalTaxAmount,
            },
          ],
        },
      },
      include: { items: true },
    });

    if (isPositiveMoney(grandTotal)) {
      const journalLines = [
        { accountCode: "1200", debitAmount: grandTotal, creditAmount: "0.00" },
        { accountCode: "4100", debitAmount: "0.00", creditAmount: taxableAmount },
      ];
      if (isPositiveMoney(totalTaxAmount)) {
        journalLines.push({
          accountCode: "2200",
          debitAmount: "0.00",
          creditAmount: totalTaxAmount,
        });
      }
      await postJournalEntry(tx, {
        referenceType: "Invoice",
        referenceId: createdInvoice.id,
        narration: `Model A patient invoice issued: ${invoiceNumber}`,
        postedById: actor.userId,
        lines: journalLines,
      });
    }

    await writeAuditLog(tx, {
      actor,
      action: "INVOICE_ISSUED",
      entityType: "Invoice",
      entityId: createdInvoice.id,
      after: {
        invoiceNumber,
        orderNumber: order.orderNumber,
        grandTotal,
      },
    });

    return {
      invoice: createdInvoice,
      alreadyIssued: false,
      pdfPayload: {
        documentTitle: createdInvoice.documentTitleSnapshot,
        invoiceNumber: createdInvoice.invoiceNumber,
        orderNumber: order.orderNumber,
        issueDate: createdInvoice.issueDate,
        status: createdInvoice.status,
        issuer: {
          legalName: createdInvoice.issuerLegalNameSnapshot,
          gstin: createdInvoice.issuerGstinSnapshot,
          address: createdInvoice.issuerAddressSnapshot,
          phone: org.contactPhone,
          email: org.contactEmail,
        },
        patient: {
          fullName: createdInvoice.patientNameSnapshot,
          patientCode: createdInvoice.patientCodeSnapshot,
          mobile: createdInvoice.patientMobileSnapshot,
        },
        partnerName: createdInvoice.partnerNameSnapshot,
        items: builtItems.map((i) => ({
          code: i.testCodeSnapshot,
          description: i.descriptionSnapshot,
          hsnSac: i.hsnSacSnapshot,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discountAmount,
          taxable: i.taxableAmount,
          taxTotal: sumMoney([i.cgstAmount, i.sgstAmount, i.igstAmount]),
          lineTotal: i.lineTotal,
        })),
        totals: {
          subtotal: subtotalAmount,
          discount: discountAmount,
          taxable: taxableAmount,
          cgst: cgstAmount,
          sgst: sgstAmount,
          igst: igstAmount,
          grandTotal,
          effectiveTotal: grandTotal,
          amountPaid: "0.00",
          amountRefunded: "0.00",
          balanceDue: grandTotal,
        },
        termsText: createdInvoice.termsSnapshot,
      },
    };
  });

  if (!result.alreadyIssued && result.pdfPayload) {
    const pdfBuffer = await generateInvoiceOrStatementPdf(result.pdfPayload);
    const checksum = createHash("sha256").update(pdfBuffer).digest("hex");
    const storageKey = `invoices/${result.invoice.id}/original-${result.invoice.invoiceNumber}.pdf`;
    await storage.putObject({
      storageKey,
      body: pdfBuffer,
      contentType: "application/pdf",
    });

    await db.invoiceDocument.create({
      data: {
        invoiceId: result.invoice.id,
        docKind: DocumentKind.ISSUED_INVOICE_PDF,
        storageKey,
        sha256Checksum: checksum,
        fileSizeBytes: pdfBuffer.length,
        generatedById: actor.userId,
      },
    });
  }

  return result.invoice;
}

export async function recordModelBPartnerInvoiceReference(
  actor: ActorContext,
  orderId: string,
  rawInput: unknown,
) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "orders:create");
  const input = recordPartnerInvoiceRefSchema.parse(rawInput);

  return db.$transaction(async (tx) => {
    const order = await tx.diagnosticOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new AppError("NOT_FOUND", "Diagnostic order not found.", 404);
    }

    assertPartnerRefModelEligibility(order.paymentModel);

    const ref = await tx.partnerInvoiceReference.upsert({
      where: { orderId },
      create: {
        orderId,
        partnerId: order.partnerId,
        partnerInvoiceNumber: input.partnerInvoiceNumber,
        partnerReceiptNumber: input.partnerReceiptNumber || null,
        invoiceDate: input.invoiceDate,
        grossAmount: money(input.grossAmount),
        discountAmount: money(input.discountAmount),
        taxAmount: money(input.taxAmount),
        netAmountPaidByPatient: money(input.netAmountPaidByPatient),
        paymentModeReported: input.paymentModeReported || null,
        notes: input.notes || null,
        recordedById: actor.userId,
      },
      update: {
        partnerInvoiceNumber: input.partnerInvoiceNumber,
        partnerReceiptNumber: input.partnerReceiptNumber || null,
        invoiceDate: input.invoiceDate,
        grossAmount: money(input.grossAmount),
        discountAmount: money(input.discountAmount),
        taxAmount: money(input.taxAmount),
        netAmountPaidByPatient: money(input.netAmountPaidByPatient),
        paymentModeReported: input.paymentModeReported || null,
        notes: input.notes || null,
      },
    });

    // Track direct partner collection strictly in collection_records (never in consultancy cash/bank)
    await tx.collectionRecord.create({
      data: {
        recordType: "MODEL_B_PARTNER_DIRECT",
        orderId: order.id,
        partnerId: order.partnerId,
        amount: money(input.netAmountPaidByPatient),
        referenceNumber: input.partnerReceiptNumber || input.partnerInvoiceNumber,
        collectedAt: input.invoiceDate,
        reconciliationStatus: "MATCHED",
        reconciledById: actor.userId,
        notes: "Direct patient-to-partner collection recorded under Model B.",
      },
    });

    await writeAuditLog(tx, {
      actor,
      action: "PARTNER_INVOICE_REF_RECORDED",
      entityType: "PartnerInvoiceReference",
      entityId: ref.id,
      after: ref,
    });

    return ref;
  });
}

export async function listInvoices(
  actor: ActorContext,
  params: {
    status?: InvoiceStatus;
    partnerId?: string;
    patientId?: string;
    page?: number;
    pageSize?: number;
  },
) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "invoices:read");

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));

  const where: Prisma.InvoiceWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.partnerId ? { partnerId: params.partnerId } : {}),
    ...(params.patientId ? { patientId: params.patientId } : {}),
  };

  const [totalItems, items] = await Promise.all([
    db.invoice.count({ where }),
    db.invoice.findMany({
      where,
      orderBy: { issueDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        order: { select: { orderNumber: true } },
        _count: { select: { payments: true } },
      },
    }),
  ]);

  return { items, page, pageSize, totalItems };
}

export async function getInvoiceDetail(actor: ActorContext, invoiceId: string) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "invoices:read");

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      order: true,
      patient: true,
      partner: true,
      items: true,
      taxSnapshots: true,
      adjustmentNotes: { orderBy: { createdAt: "desc" } },
      payments: {
        orderBy: { paymentDate: "desc" },
        include: {
          receipt: true,
          gatewayTransaction: true,
          refunds: true,
          collectedBy: { select: { fullName: true } },
        },
      },
      qrSessions: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      shareLogs: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          shareToken: {
            select: {
              id: true,
              expiresAt: true,
              revokedAt: true,
              viewCount: true,
            },
          },
        },
      },
    },
  });

  if (!invoice) {
    throw new AppError("NOT_FOUND", "Invoice not found.", 404);
  }
  const now = new Date();
  return {
    ...invoice,
    shareLogs: invoice.shareLogs.map((log) => ({
      ...log,
      isTokenExpired: log.shareToken ? log.shareToken.expiresAt <= now : false,
    })),
  };
}

export async function getInvoiceOrStatementPdfBuffer(
  actor: ActorContext,
  invoiceId: string,
  kind: "invoice" | "statement",
): Promise<{ buffer: Buffer; filename: string }> {
  requireConsultancyPortal(actor);
  requirePermission(actor, "invoices:read");

  const invoice = await getInvoiceDetail(actor, invoiceId);
  const storage = getPrivateStorage();

  if (kind === "invoice") {
    const storedDoc = await db.invoiceDocument.findFirst({
      where: { invoiceId: invoice.id, docKind: DocumentKind.ISSUED_INVOICE_PDF },
      orderBy: { createdAt: "asc" },
    });
    if (storedDoc) {
      const buffer = await storage.getObjectBuffer(storedDoc.storageKey);
      return { buffer, filename: `${invoice.invoiceNumber}.pdf` };
    }
  }

  // Render Account Statement (or regenerate identical snapshot if storage missing in fresh test)
  const buffer = await generateInvoiceOrStatementPdf({
    documentTitle: invoice.documentTitleSnapshot,
    isAccountStatement: kind === "statement",
    invoiceNumber: invoice.invoiceNumber,
    orderNumber: invoice.order.orderNumber,
    issueDate: invoice.issueDate,
    status: invoice.status,
    issuer: {
      legalName: invoice.issuerLegalNameSnapshot,
      gstin: invoice.issuerGstinSnapshot,
      address: invoice.issuerAddressSnapshot,
    },
    patient: {
      fullName: invoice.patientNameSnapshot,
      patientCode: invoice.patientCodeSnapshot,
      mobile: invoice.patientMobileSnapshot,
    },
    partnerName: invoice.partnerNameSnapshot,
    items: invoice.items.map((i) => ({
      code: i.testCodeSnapshot,
      description: i.descriptionSnapshot,
      hsnSac: i.hsnSacSnapshot,
      quantity: i.quantity,
      unitPrice: i.unitPrice.toString(),
      discount: i.discountAmount.toString(),
      taxable: i.taxableAmount.toString(),
      taxTotal: sumMoney([
        i.cgstAmount.toString(),
        i.sgstAmount.toString(),
        i.igstAmount.toString(),
      ]),
      lineTotal: i.lineTotal.toString(),
    })),
    totals: {
      subtotal: invoice.subtotalAmount.toString(),
      discount: invoice.discountAmount.toString(),
      taxable: invoice.taxableAmount.toString(),
      cgst: invoice.cgstAmount.toString(),
      sgst: invoice.sgstAmount.toString(),
      igst: invoice.igstAmount.toString(),
      grandTotal: invoice.grandTotal.toString(),
      effectiveTotal: invoice.effectiveTotal.toString(),
      amountPaid: invoice.amountPaid.toString(),
      amountRefunded: invoice.amountRefunded.toString(),
      balanceDue: invoice.balanceDue.toString(),
    },
    payments: invoice.payments.map((p) => ({
      receiptNumber: p.receipt?.receiptNumber ?? null,
      paymentDate: p.paymentDate,
      method: p.paymentMethod,
      reference: p.externalReference,
      amount: p.amount.toString(),
      status: p.paymentStatus,
    })),
    termsText: invoice.termsSnapshot,
  });

  const prefix = kind === "statement" ? "Statement" : "Invoice";
  return { buffer, filename: `${prefix}-${invoice.invoiceNumber}.pdf` };
}

export async function issueInvoiceAdjustmentNote(
  actor: ActorContext,
  invoiceId: string,
  rawInput: unknown,
) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "invoices:adjust");
  const input = createInvoiceAdjustmentSchema.parse(rawInput);

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId}::uuid FOR UPDATE`;

    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true, refunds: true },
    });
    if (!invoice) {
      throw new AppError("NOT_FOUND", "Invoice not found.", 404);
    }
    if (invoice.status === "VOID") {
      throw new AppError("INVOICE_IMMUTABLE", "Cannot adjust a VOID invoice.", 422);
    }

    const totalDelta = addMoney(input.taxableDelta, input.taxDelta);
    const noteNumber = await nextDocumentNumber(
      tx,
      input.noteType === "CREDIT_NOTE" ? "CREDIT_NOTE" : "DEBIT_NOTE",
    );

    const nextCreditTotal =
      input.noteType === "CREDIT_NOTE"
        ? addMoney(invoice.creditNoteTotal.toString(), totalDelta)
        : invoice.creditNoteTotal.toString();

    const nextDebitTotal =
      input.noteType === "DEBIT_NOTE"
        ? addMoney(invoice.debitNoteTotal.toString(), totalDelta)
        : invoice.debitNoteTotal.toString();

    const ledgerState = computeInvoiceLedgerState({
      grandTotal: invoice.grandTotal.toString(),
      creditNoteTotal: nextCreditTotal,
      debitNoteTotal: nextDebitTotal,
      isVoid: false,
      payments: invoice.payments.map((p) => ({
        amount: p.amount.toString(),
        status: p.paymentStatus,
      })),
      refunds: invoice.refunds.map((r) => ({
        amount: r.amount.toString(),
        status: r.status,
      })),
    });

    const note = await tx.invoiceAdjustmentNote.create({
      data: {
        noteNumber,
        invoiceId,
        noteType: input.noteType,
        reason: input.reason,
        taxableDelta: money(input.taxableDelta),
        taxDelta: money(input.taxDelta),
        totalDelta,
        approvedById: actor.userId,
      },
    });

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        creditNoteTotal: nextCreditTotal,
        debitNoteTotal: nextDebitTotal,
        effectiveTotal: ledgerState.effectiveTotal,
        balanceDue: ledgerState.balanceDue,
        status: ledgerState.status,
      },
    });

    await writeAuditLog(tx, {
      actor,
      action: "INVOICE_ADJUSTMENT_NOTE_ISSUED",
      entityType: "InvoiceAdjustmentNote",
      entityId: note.id,
      after: { noteNumber, noteType: input.noteType, totalDelta, reason: input.reason },
    });

    return note;
  });
}

export async function createAndShareDocumentLink(
  actor: ActorContext,
  resourceId: string,
  rawInput: unknown,
) {
  requireConsultancyPortal(actor);
  const input = shareDocumentSchema.parse(rawInput);

  if (input.resourceType === "REPORT") {
    requirePermission(actor, "reports:share");
  } else {
    requirePermission(actor, "invoices:share");
  }

  const env = getEnv();
  const orgSettings = await db.organizationSettings.findFirst();
  const ttlHours = input.ttlHours ?? orgSettings?.shareLinkDefaultTtlHours ?? 72;

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  const shareUrl = `${env.NEXT_PUBLIC_APP_URL}/d/${rawToken}`;

  const tokenRow = await db.documentShareToken.create({
    data: {
      tokenHash,
      resourceType: input.resourceType,
      resourceId,
      expiresAt,
      createdById: actor.userId,
    },
  });

  let deliveryStatus: DeliveryStatus = DeliveryStatus.MANUAL;
  let destinationMasked: string | null = null;
  let providerMessageId: string | null = null;
  let errorMessage: string | null = null;

  if (input.channel === "WHATSAPP") {
    if (!input.recipientMobile) {
      throw new AppError("BAD_REQUEST", "Recipient mobile number required for WhatsApp sharing.", 400);
    }
    const dispatched = await sendWhatsAppTemplateNotification({
      recipientMobile: input.recipientMobile,
      templateName:
        input.resourceType === "REPORT"
          ? "dcms_report_ready_link"
          : "dcms_billing_document_link",
      bodyVariables: [input.resourceType, shareUrl],
      eventType: `SHARE_${input.resourceType}`,
      referenceType: input.resourceType,
      referenceId: resourceId,
    });
    deliveryStatus = dispatched.status;
    destinationMasked = dispatched.destinationMasked;
    providerMessageId = dispatched.providerMessageId ?? null;
    errorMessage = dispatched.errorMessage ?? null;
  } else if (input.channel === "EMAIL") {
    if (!input.recipientEmail) {
      throw new AppError("BAD_REQUEST", "Recipient email required for Email sharing.", 400);
    }
    const dispatched = await sendTransactionalEmail({
      recipientEmail: input.recipientEmail,
      subject: `Your Diagnostic ${input.resourceType.toLowerCase()} link`,
      textBody: `Access your secure document here (link expires in ${ttlHours} hours):\n${shareUrl}\n\nFor your privacy, clinical details are not included in this email.`,
      eventType: `SHARE_${input.resourceType}`,
      referenceType: input.resourceType,
      referenceId: resourceId,
    });
    deliveryStatus = dispatched.status;
    destinationMasked = dispatched.destinationMasked;
    providerMessageId = dispatched.providerMessageId ?? null;
    errorMessage = dispatched.errorMessage ?? null;
  }

  await db.invoiceShareLog.create({
    data: {
      invoiceId:
        input.resourceType === "INVOICE" || input.resourceType === "STATEMENT"
          ? resourceId
          : null,
      receiptId: input.resourceType === "RECEIPT" ? resourceId : null,
      reportFileId: input.resourceType === "REPORT" ? resourceId : null,
      channel: input.channel,
      destinationMasked,
      shareTokenId: tokenRow.id,
      providerMessageId,
      deliveryStatus,
      errorMessage,
      sharedById: actor.userId,
    },
  });

  await writeAuditLog(db, {
    actor,
    action: "DOCUMENT_SHARED",
    entityType: input.resourceType,
    entityId: resourceId,
    metadata: {
      channel: input.channel,
      shareTokenId: tokenRow.id,
      deliveryStatus,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return {
    shareTokenId: tokenRow.id,
    shareUrl,
    expiresAt: expiresAt.toISOString(),
    deliveryStatus,
    errorMessage,
  };
}

export async function revokeShareToken(actor: ActorContext, tokenId: string) {
  requireConsultancyPortal(actor);
  requirePermission(actor, "invoices:share");

  const updated = await db.documentShareToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() },
  });

  await writeAuditLog(db, {
    actor,
    action: "DOCUMENT_SHARE_REVOKED",
    entityType: "DocumentShareToken",
    entityId: tokenId,
  });

  return updated;
}
