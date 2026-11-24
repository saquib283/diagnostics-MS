import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  generateInvoiceOrStatementPdf,
  generatePaymentReceiptPdf,
} from "@/lib/pdf/documents";
import { buildExcelReportBuffer } from "@/lib/excel/exporter";
import { verifyCsrfAndOrigin } from "@/lib/http";
import { POST as razorpayWebhookPost } from "@/app/api/v1/webhooks/razorpay/route";

describe("Integration: Server PDF Engine, ExcelJS Exporter, CSRF & Raw-Body Webhook Route", () => {
  it("generates deterministic valid PDF buffers (%PDF-) for Model A Invoices, Statements, and Payment Receipts", async () => {
    const invoicePdf = await generateInvoiceOrStatementPdf({
      documentTitle: "Invoice",
      invoiceNumber: "INV-2026-27-00001",
      orderNumber: "ORD-2026-27-00001",
      issueDate: new Date("2026-11-24T08:00:00Z"),
      status: "PARTIALLY_PAID",
      issuer: {
        legalName: "[DEMO] Apex Diagnostic Consultancy Pvt. Ltd.",
        gstin: null,
        address: "204 Healthcare Chambers, Pune - 411005",
      },
      patient: {
        fullName: "[DEMO] Aarav Kulkarni",
        patientCode: "PAT-2026-00001",
        mobile: "+919000000101",
      },
      partnerName: "[DEMO] Metro Scans",
      items: [
        {
          code: "MRI-BRAIN",
          description: "MRI Brain Plain",
          hsnSac: "999316",
          quantity: 1,
          unitPrice: "5000.00",
          discount: "0.00",
          taxable: "5000.00",
          taxTotal: "0.00",
          lineTotal: "5000.00",
        },
      ],
      totals: {
        subtotal: "5000.00",
        discount: "0.00",
        taxable: "5000.00",
        cgst: "0.00",
        sgst: "0.00",
        igst: "0.00",
        grandTotal: "5000.00",
        effectiveTotal: "5000.00",
        amountPaid: "2000.00",
        amountRefunded: "0.00",
        balanceDue: "3000.00",
      },
    });

    expect(invoicePdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(invoicePdf.length).toBeGreaterThan(800);

    const receiptPdf = await generatePaymentReceiptPdf({
      receiptNumber: "RCP-2026-27-00001",
      issuedAt: new Date("2026-11-24T08:05:00Z"),
      issuerLegalName: "[DEMO] Apex Diagnostic Consultancy Pvt. Ltd.",
      issuerAddress: "Pune - 411005",
      invoiceNumber: "INV-2026-27-00001",
      orderNumber: "ORD-2026-27-00001",
      patientName: "[DEMO] Aarav Kulkarni",
      patientCode: "PAT-2026-00001",
      paymentMethod: "CASH",
      externalReference: "Counter #1",
      amountPaid: "2000.00",
      invoiceBalanceAfter: "3000.00",
    });

    expect(receiptPdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(receiptPdf.length).toBeGreaterThan(600);
  });

  it("generates valid Excel (.xlsx ZIP PK header) financial workbooks", async () => {
    const xlsx = await buildExcelReportBuffer({
      sheetName: "DailyCollections",
      title: "Daily Collection Register",
      columns: [
        { header: "Receipt #", key: "receipt", width: 20 },
        { header: "Amount", key: "amount", width: 16, isCurrency: true },
      ],
      rows: [
        { receipt: "RCP-001", amount: "2000.00" },
        { receipt: "RCP-002", amount: "2000.00" },
        { receipt: "RCP-003", amount: "1000.00" },
      ],
    });

    // .xlsx OOXML files start with PK\x03\x04
    expect(xlsx[0]).toBe(0x50);
    expect(xlsx[1]).toBe(0x4b);
  });

  it("enforces Origin + X-CSRF-Token checks on state-changing requests", () => {
    const evilOriginReq = new NextRequest("http://localhost:3000/api/v1/orders", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "https://attacker.example.com",
      },
    });
    expect(() => verifyCsrfAndOrigin(evilOriginReq, null)).toThrow(/FORBIDDEN/);

    const missingCsrfReq = new NextRequest("http://localhost:3000/api/v1/orders", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
    });
    expect(() =>
      verifyCsrfAndOrigin(missingCsrfReq, {
        userId: "u1",
        email: "a@b.c",
        fullName: "Admin",
        portalType: "CONSULTANCY",
        roles: ["ADMIN"],
        permissions: [],
        partnerIds: [],
        csrfToken: "expected-secret-csrf-token",
      }),
    ).toThrow(/X-CSRF-Token/);
  });

  it("rejects forged Razorpay webhook requests with invalid HMAC signatures on the raw body route", async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret_32_characters_long";
    const req = new NextRequest("http://localhost:3000/api/v1/webhooks/razorpay", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": "0000000000000000000000000000000000000000000000000000000000000000",
      },
      body: JSON.stringify({ event: "payment.captured" }),
    });

    const response = await razorpayWebhookPost(req);
    expect(response.status).toBe(401);
  });
});

