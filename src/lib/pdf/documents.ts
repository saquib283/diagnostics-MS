import PDFDocument from "pdfkit";
import { formatInr } from "@/lib/money";

function renderPdfToBuffer(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 42,
      info: {
        Creator: "DCMS Healthcare Financial ERP",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    build(doc);
    doc.end();
  });
}

function formatIstDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export interface InvoicePdfPayload {
  documentTitle: string;
  isAccountStatement?: boolean;
  invoiceNumber: string;
  orderNumber: string;
  issueDate: Date;
  status: string;
  issuer: {
    legalName: string;
    gstin?: string | null;
    address: string;
    phone?: string;
    email?: string;
  };
  patient: {
    fullName: string;
    patientCode: string;
    mobile: string;
  };
  partnerName: string;
  items: Array<{
    code: string;
    description: string;
    hsnSac?: string | null;
    quantity: number;
    unitPrice: string;
    discount: string;
    taxable: string;
    taxTotal: string;
    lineTotal: string;
  }>;
  totals: {
    subtotal: string;
    discount: string;
    taxable: string;
    cgst: string;
    sgst: string;
    igst: string;
    grandTotal: string;
    effectiveTotal: string;
    amountPaid: string;
    amountRefunded: string;
    balanceDue: string;
  };
  payments?: Array<{
    receiptNumber?: string | null;
    paymentDate: Date;
    method: string;
    reference?: string | null;
    amount: string;
    status: string;
  }>;
  termsText?: string | null;
}

export async function generateInvoiceOrStatementPdf(
  payload: InvoicePdfPayload,
): Promise<Buffer> {
  return renderPdfToBuffer((doc) => {
    // Header Band
    doc
      .fillColor("#1B365D")
      .fontSize(16)
      .font("Helvetica-Bold")
      .text(payload.issuer.legalName, { align: "left" });

    doc
      .fillColor("#334155")
      .fontSize(9)
      .font("Helvetica")
      .text(payload.issuer.address);
    if (payload.issuer.gstin) {
      doc.text(`GSTIN: ${payload.issuer.gstin}`);
    }
    if (payload.issuer.phone || payload.issuer.email) {
      doc.text(
        [payload.issuer.phone, payload.issuer.email].filter(Boolean).join(" | "),
      );
    }

    doc.moveDown(0.6);
    doc
      .strokeColor("#CBD5E1")
      .lineWidth(1)
      .moveTo(42, doc.y)
      .lineTo(553, doc.y)
      .stroke();
    doc.moveDown(0.8);

    // Document Title & Metadata
    const title = payload.isAccountStatement
      ? "PATIENT ACCOUNT STATEMENT"
      : payload.documentTitle.toUpperCase();

    doc
      .fillColor("#0F172A")
      .font("Helvetica-Bold")
      .fontSize(13)
      .text(title, { continued: true })
      .fontSize(10)
      .text(`   [${payload.status}]`, { align: "right" });

    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(9.5).fillColor("#0F172A");
    doc.text(`Invoice No: ${payload.invoiceNumber}    |    Order No: ${payload.orderNumber}`);
    doc.text(`Issued On (IST): ${formatIstDate(payload.issueDate)}`);
    doc.text(
      `Patient: ${payload.patient.fullName} (${payload.patient.patientCode}) — Tel: ${payload.patient.mobile}`,
    );
    doc.text(`Fulfilling Diagnostic Centre: ${payload.partnerName}`);

    doc.moveDown(0.8);

    // Table Header
    const tableTop = doc.y;
    doc.rect(42, tableTop, 511, 20).fill("#F1F5F9");
    doc.fillColor("#1E293B").font("Helvetica-Bold").fontSize(8.5);
    doc.text("Code", 48, tableTop + 6, { width: 65 });
    doc.text("Diagnostic Test", 115, tableTop + 6, { width: 175 });
    doc.text("Qty", 292, tableTop + 6, { width: 28, align: "right" });
    doc.text("Rate", 324, tableTop + 6, { width: 68, align: "right" });
    doc.text("Disc", 395, tableTop + 6, { width: 52, align: "right" });
    doc.text("Tax", 450, tableTop + 6, { width: 45, align: "right" });
    doc.text("Total", 498, tableTop + 6, { width: 50, align: "right" });

    let y = tableTop + 24;
    doc.font("Helvetica").fontSize(8.5).fillColor("#0F172A");

    for (const item of payload.items) {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      doc.text(item.code, 48, y, { width: 65 });
      doc.text(item.description, 115, y, { width: 175 });
      doc.text(String(item.quantity), 292, y, { width: 28, align: "right" });
      doc.text(formatInr(item.unitPrice), 324, y, { width: 68, align: "right" });
      doc.text(formatInr(item.discount), 395, y, { width: 52, align: "right" });
      doc.text(formatInr(item.taxTotal), 450, y, { width: 45, align: "right" });
      doc.text(formatInr(item.lineTotal), 498, y, { width: 50, align: "right" });
      y += 18;
    }

    doc
      .strokeColor("#CBD5E1")
      .moveTo(42, y + 2)
      .lineTo(553, y + 2)
      .stroke();
    y += 10;

    // Totals Block
    const writeTotalRow = (label: string, val: string, bold = false) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9.5);
      doc.text(label, 340, y, { width: 120, align: "right" });
      doc.text(val, 465, y, { width: 85, align: "right" });
      y += 15;
    };

    writeTotalRow("Subtotal:", formatInr(payload.totals.subtotal));
    writeTotalRow("Discount:", formatInr(payload.totals.discount));
    writeTotalRow("Taxable Value:", formatInr(payload.totals.taxable));
    if (payload.totals.cgst !== "0.00" || payload.totals.sgst !== "0.00") {
      writeTotalRow("CGST:", formatInr(payload.totals.cgst));
      writeTotalRow("SGST:", formatInr(payload.totals.sgst));
    }
    if (payload.totals.igst !== "0.00") {
      writeTotalRow("IGST:", formatInr(payload.totals.igst));
    }
    writeTotalRow("Grand Total:", formatInr(payload.totals.grandTotal), true);
    if (payload.totals.effectiveTotal !== payload.totals.grandTotal) {
      writeTotalRow(
        "Adjusted Effective Total:",
        formatInr(payload.totals.effectiveTotal),
        true,
      );
    }
    writeTotalRow("Amount Collected:", formatInr(payload.totals.amountPaid));
    if (payload.totals.amountRefunded !== "0.00") {
      writeTotalRow("Amount Refunded:", formatInr(payload.totals.amountRefunded));
    }
    writeTotalRow("Balance Due:", formatInr(payload.totals.balanceDue), true);

    if (payload.isAccountStatement && payload.payments && payload.payments.length > 0) {
      y += 12;
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .text("Split Payment & Transaction History", 42, y);
      y += 16;
      doc.font("Helvetica").fontSize(8.5);
      for (const p of payload.payments) {
        doc.text(
          `${formatIstDate(p.paymentDate)} | ${p.receiptNumber ?? "-"} | ${p.method} | ${p.status} | ${formatInr(p.amount)} ${p.reference ? `(Ref: ${p.reference})` : ""}`,
          42,
          y,
        );
        y += 14;
      }
    }

    if (payload.termsText) {
      doc.moveDown(1.5);
      doc
        .fillColor("#475569")
        .font("Helvetica")
        .fontSize(8)
        .text(`Terms & Notes: ${payload.termsText}`, 42, doc.y, { width: 511 });
    }
  });
}

export async function generatePaymentReceiptPdf(params: {
  receiptNumber: string;
  issuedAt: Date;
  issuerLegalName: string;
  issuerAddress: string;
  invoiceNumber: string;
  orderNumber: string;
  patientName: string;
  patientCode: string;
  paymentMethod: string;
  externalReference?: string | null;
  amountPaid: string;
  invoiceBalanceAfter: string;
}): Promise<Buffer> {
  return renderPdfToBuffer((doc) => {
    doc
      .fillColor("#1B365D")
      .font("Helvetica-Bold")
      .fontSize(15)
      .text(params.issuerLegalName);
    doc
      .fillColor("#334155")
      .font("Helvetica")
      .fontSize(9)
      .text(params.issuerAddress);
    doc.moveDown(0.8);
    doc
      .strokeColor("#CBD5E1")
      .moveTo(42, doc.y)
      .lineTo(553, doc.y)
      .stroke();
    doc.moveDown(0.8);

    doc
      .fillColor("#0F172A")
      .font("Helvetica-Bold")
      .fontSize(13)
      .text("PAYMENT RECEIPT");
    doc.moveDown(0.6);

    doc.font("Helvetica").fontSize(10);
    doc.text(`Receipt Number: ${params.receiptNumber}`);
    doc.text(`Receipt Date (IST): ${formatIstDate(params.issuedAt)}`);
    doc.text(`Against Invoice: ${params.invoiceNumber} (Order: ${params.orderNumber})`);
    doc.text(`Received From: ${params.patientName} (${params.patientCode})`);
    doc.text(`Payment Mode: ${params.paymentMethod}`);
    if (params.externalReference) {
      doc.text(`Transaction / Gateway Ref: ${params.externalReference}`);
    }
    doc.moveDown(0.8);

    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(`Amount Received: ${formatInr(params.amountPaid)}`);
    doc
      .font("Helvetica")
      .fontSize(10)
      .text(
        `Remaining Invoice Balance After This Payment: ${formatInr(params.invoiceBalanceAfter)}`,
      );
  });
}

export async function generateSettlementStatementPdf(params: {
  settlementNumber: string;
  direction: "PAYABLE_TO_PARTNER" | "RECEIVABLE_FROM_PARTNER";
  status: string;
  periodStart: Date;
  periodEnd: Date;
  issuerLegalName: string;
  partnerName: string;
  partnerCode: string;
  items: Array<{
    orderNumber: string;
    testName: string;
    completedAt: Date;
    baseAmount: string;
    commissionRate?: string | null;
    settlementAmount: string;
  }>;
  grossEligibleAmount: string;
  adjustmentsAmount: string;
  netAmount: string;
  settledAmount: string;
  balanceAmount: string;
}): Promise<Buffer> {
  return renderPdfToBuffer((doc) => {
    doc
      .fillColor("#1B365D")
      .font("Helvetica-Bold")
      .fontSize(15)
      .text(params.issuerLegalName);
    doc
      .fillColor("#0F172A")
      .fontSize(12)
      .text(
        params.direction === "PAYABLE_TO_PARTNER"
          ? "PARTNER DIAGNOSTIC PAYABLE STATEMENT (MODEL A)"
          : "PARTNER COMMISSION RECEIVABLE STATEMENT (MODEL B)",
      );
    doc.moveDown(0.5);

    doc.font("Helvetica").fontSize(9.5).fillColor("#334155");
    doc.text(`Statement No: ${params.settlementNumber}    |    Status: ${params.status}`);
    doc.text(`Partner Centre: ${params.partnerName} (${params.partnerCode})`);
    doc.text(
      `Eligible Completion Window: ${params.periodStart.toISOString().slice(0, 10)} to ${params.periodEnd.toISOString().slice(0, 10)}`,
    );
    doc.moveDown(0.8);

    const top = doc.y;
    doc.rect(42, top, 511, 18).fill("#F1F5F9");
    doc.fillColor("#0F172A").font("Helvetica-Bold").fontSize(8.5);
    doc.text("Order #", 48, top + 5, { width: 95 });
    doc.text("Completed Test", 145, top + 5, { width: 175 });
    doc.text("Completed Date", 322, top + 5, { width: 80 });
    doc.text("Base", 405, top + 5, { width: 65, align: "right" });
    doc.text("Amount", 475, top + 5, { width: 72, align: "right" });

    let y = top + 22;
    doc.font("Helvetica").fontSize(8.5);
    for (const item of params.items) {
      if (y > 720) {
        doc.addPage();
        y = 50;
      }
      doc.text(item.orderNumber, 48, y, { width: 95 });
      doc.text(item.testName, 145, y, { width: 175 });
      doc.text(item.completedAt.toISOString().slice(0, 10), 322, y, { width: 80 });
      doc.text(formatInr(item.baseAmount), 405, y, { width: 65, align: "right" });
      doc.text(formatInr(item.settlementAmount), 475, y, { width: 72, align: "right" });
      y += 16;
    }

    y += 10;
    doc.font("Helvetica-Bold").fontSize(9.5);
    doc.text(`Gross Eligible: ${formatInr(params.grossEligibleAmount)}`, 330, y, {
      width: 217,
      align: "right",
    });
    y += 14;
    doc.text(`Adjustments: ${formatInr(params.adjustmentsAmount)}`, 330, y, {
      width: 217,
      align: "right",
    });
    y += 14;
    doc.text(`Net Statement Amount: ${formatInr(params.netAmount)}`, 330, y, {
      width: 217,
      align: "right",
    });
    y += 14;
    doc.text(`Settled / Allocated: ${formatInr(params.settledAmount)}`, 330, y, {
      width: 217,
      align: "right",
    });
    y += 14;
    doc.text(`Remaining Balance: ${formatInr(params.balanceAmount)}`, 330, y, {
      width: 217,
      align: "right",
    });
  });
}

