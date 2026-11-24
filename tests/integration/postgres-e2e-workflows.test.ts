import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetEnvCacheForTests } from "@/lib/env";
import { money } from "@/lib/money";
import { ROLE_PERMISSIONS } from "@/lib/permissions/rbac";
import type { ActorContext } from "@/lib/permissions/types";
import { getDashboardSummary } from "@/modules/analytics/service";
import {
  issueInvoiceAdjustmentNote,
  issueModelAInvoice,
  recordModelBPartnerInvoiceReference,
} from "@/modules/billing/service";
import { updateTest } from "@/modules/catalogue/service";
import {
  createDiagnosticOrder,
  getPartnerPortalOrderDetail,
  transitionOrderItemStatus,
} from "@/modules/orders/service";
import { createPatient } from "@/modules/patients/service";
import {
  initiatePaymentRefund,
  recordManualSplitPayment,
} from "@/modules/payments/service";
import { processRazorpayRawWebhook } from "@/modules/razorpay/service";
import {
  downloadAuthorizedReportFile,
  uploadDiagnosticReportForOrderItem,
} from "@/modules/reports/service";
import {
  approvePartnerSettlement,
  createPartnerSettlement,
  recordAndAllocateSettlementPayment,
} from "@/modules/settlements/service";

const runLivePg = Boolean(process.env.RUN_LIVE_PG_TESTS === "true");

describe.skipIf(!runLivePg)(
  "Live PostgreSQL 18 End-to-End Transactional Workflows & Isolation Suite",
  () => {
    it(
      "executes full Model A Split Payments, Webhook Idempotency, Partner IDOR Isolation, Model B Commissions, Double-Settlement Lock & Balanced Journal",
      async () => {
        const superAdminUser = await db.user.findUniqueOrThrow({
          where: { email: "superadmin@demo-dcms.local" },
        });
        const metroPartner = await db.partner.findUniqueOrThrow({
          where: { partnerCode: "PRT-METRO" },
        });
        const starPartner = await db.partner.findUniqueOrThrow({
          where: { partnerCode: "PRT-STAR" },
        });
        const metroUser = await db.user.findUniqueOrThrow({
          where: { email: "partner.metro@demo-dcms.local" },
        });
        const starUser = await db.user.findUniqueOrThrow({
          where: { email: "partner.star@demo-dcms.local" },
        });

        const adminActor: ActorContext = {
          userId: superAdminUser.id,
          email: superAdminUser.email,
          fullName: superAdminUser.fullName,
          portalType: "CONSULTANCY",
          roles: ["SUPER_ADMIN"],
          permissions: ROLE_PERMISSIONS.SUPER_ADMIN,
          partnerIds: [],
        };

        const partnerMetroActor: ActorContext = {
          userId: metroUser.id,
          email: metroUser.email,
          fullName: metroUser.fullName,
          portalType: "PARTNER",
          roles: ["PARTNER_ADMIN"],
          permissions: ROLE_PERMISSIONS.PARTNER_ADMIN,
          partnerIds: [metroPartner.id],
        };

        const partnerStarActor: ActorContext = {
          userId: starUser.id,
          email: starUser.email,
          fullName: starUser.fullName,
          portalType: "PARTNER",
          roles: ["PARTNER_ADMIN"],
          permissions: ROLE_PERMISSIONS.PARTNER_ADMIN,
          partnerIds: [starPartner.id],
        };

        // 1. Register patient preserving +91 string mobile
        const patient = await createPatient(adminActor, {
          fullName: "[DEMO] Meera Joshi",
          mobile: "+919822001122",
          gender: "FEMALE",
          ageYearsSnapshot: 34,
          city: "Pune",
        });
        expect(patient.patientCode).toMatch(/^PAT-/);
        expect(patient.mobile).toBe("+919822001122");

        const mriTest = await db.test.findUniqueOrThrow({
          where: { code: "MRI-BRAIN" },
        });
        const lipidTest = await db.test.findUniqueOrThrow({
          where: { code: "LIPID-01" },
        });
        const cbcTest = await db.test.findUniqueOrThrow({
          where: { code: "CBC-01" },
        });

        // 2. Create Model A Order totaling exactly ₹5,000.00 (3,500 + 1,000 + 500)
        const orderA = await createDiagnosticOrder(adminActor, {
          patientId: patient.id,
          partnerId: metroPartner.id,
          paymentModel: "MODEL_A_CONSULTANCY_COLLECTS",
          items: [
            { testId: mriTest.id, quantity: 1, discountAmount: "0.00" },
            { testId: lipidTest.id, quantity: 1, discountAmount: "0.00" },
            { testId: cbcTest.id, quantity: 1, discountAmount: "0.00" },
          ],
        });
        expect(money(orderA.netSellingTotal)).toBe("5000.00");

        // Update catalogue price AFTER order creation and verify order snapshot is untouched
        await updateTest(adminActor, mriTest.id, {
          defaultSellingPrice: "4200.00",
        });
        const reloadedOrderA = await db.diagnosticOrder.findUniqueOrThrow({
          where: { id: orderA.id },
          include: { items: true },
        });
        const mriItem = reloadedOrderA.items.find(
          (i) => i.testId === mriTest.id,
        )!;
        expect(money(mriItem.unitSellingPriceSnapshot)).toBe("3500.00");
        // Restore demo test price
        await updateTest(adminActor, mriTest.id, {
          defaultSellingPrice: "3500.00",
        });

        // 3. Issue immutable Model A Invoice (₹5,000.00)
        const invoice = await issueModelAInvoice(adminActor, orderA.id);
        expect(money(invoice.grandTotal)).toBe("5000.00");
        expect(money(invoice.balanceDue)).toBe("5000.00");

        // 4. Split Payments: ₹2,000 Cash + ₹2,000 UPI QR Webhook + ₹1,000 Bank/Card
        const cashRes = await recordManualSplitPayment(adminActor, invoice.id, {
          amount: "2000.00",
          paymentMethod: "CASH",
          externalReference: "Counter-Drawer-A",
        });
        expect(cashRes.invoiceStatus).toBe("PARTIALLY_PAID");
        expect(cashRes.balanceDue).toBe("3000.00");

        // Pending QR payment + Signed Razorpay Webhook (qr_code.credited)
        const pendingQrPayment = await db.patientPayment.create({
          data: {
            invoiceId: invoice.id,
            amount: "2000.00",
            paymentMethod: "UPI_QR",
            paymentStatus: "PENDING",
            gatewayTransaction: {
              create: {
                gateway: "RAZORPAY",
                gatewayQrId: "qr_test_split_2000",
                gatewayStatus: "created",
                grossAmount: "2000.00",
              },
            },
          },
        });
        await db.paymentQrSession.create({
          data: {
            paymentId: pendingQrPayment.id,
            invoiceId: invoice.id,
            gatewayQrId: "qr_test_split_2000",
            amount: "2000.00",
            status: "ACTIVE",
            expiresAt: new Date(Date.now() + 300_000),
            createdById: adminActor.userId,
          },
        });

        process.env.RAZORPAY_WEBHOOK_SECRET = "live_pg_test_webhook_secret_123456";
        resetEnvCacheForTests();
        const webhookBody = JSON.stringify({
          event: "qr_code.credited",
          payload: {
            qr_code: { entity: { id: "qr_test_split_2000", status: "closed" } },
            payment: {
              entity: {
                id: "pay_qr_2000_xyz",
                amount: 200000,
                fee: 4720,
                tax: 720,
                method: "upi",
                status: "captured",
              },
            },
          },
        });
        const validWebhookSig = createHmac(
          "sha256",
          process.env.RAZORPAY_WEBHOOK_SECRET,
        )
          .update(webhookBody, "utf8")
          .digest("hex");

        const whFirst = await processRazorpayRawWebhook({
          rawBody: webhookBody,
          signatureHeader: validWebhookSig,
          eventIdHeader: "evt_qr_unique_001",
        });
        expect(whFirst.status).toBe("PROCESSED");

        // Replay exact same webhook event -> Idempotent duplicate guard!
        const whReplay = await processRazorpayRawWebhook({
          rawBody: webhookBody,
          signatureHeader: validWebhookSig,
          eventIdHeader: "evt_qr_unique_001",
        });
        expect(whReplay.status).toBe("IGNORED_DUPLICATE");

        const afterQrInvoice = await db.invoice.findUniqueOrThrow({
          where: { id: invoice.id },
        });
        expect(afterQrInvoice.status).toBe("PARTIALLY_PAID");
        expect(money(afterQrInvoice.balanceDue)).toBe("1000.00");

        // Final ₹1,000 split payment completes the ₹5,000 invoice
        const finalSplit = await recordManualSplitPayment(
          adminActor,
          invoice.id,
          {
            amount: "1000.00",
            paymentMethod: "BANK_TRANSFER",
            externalReference: "IMPS-991122",
          },
        );
        expect(finalSplit.invoiceStatus).toBe("PAID");
        expect(finalSplit.balanceDue).toBe("0.00");

        // Overpayment on PAID invoice is strictly blocked
        await expect(
          recordManualSplitPayment(adminActor, invoice.id, {
            amount: "10.00",
            paymentMethod: "CASH",
          }),
        ).rejects.toThrow(/OVERPAYMENT_NOT_ALLOWED/);

        // Partial refund & Credit note preserve original invoice items
        await issueInvoiceAdjustmentNote(adminActor, invoice.id, {
          noteType: "CREDIT_NOTE",
          taxableDelta: "500.00",
          taxDelta: "0.00",
          reason: "CBC test cancelled before draw",
        });
        await initiatePaymentRefund(adminActor, cashRes.paymentId, {
          amount: "500.00",
          refundMethod: "CASH",
          reason: "Refund for CBC credit note",
        });

        // 5. Partner Portal Isolation & Report Upload
        // Partner B (Star Care) CANNOT view Partner A (Metro)'s order -> 404 NOT_FOUND
        await expect(
          getPartnerPortalOrderDetail(partnerStarActor, orderA.id),
        ).rejects.toThrow(/NOT_FOUND/);

        // Partner A views its own order (zero selling prices exposed!)
        const metroScopedView = await getPartnerPortalOrderDetail(
          partnerMetroActor,
          orderA.id,
        );
        expect(JSON.stringify(metroScopedView)).not.toContain("3500.00");
        expect(metroScopedView.patient.mobileDisplay).toBe("+91******1122");

        // Partner A marks MRI item IN_PROGRESS -> COMPLETED and uploads PDF report
        await transitionOrderItemStatus(
          partnerMetroActor,
          orderA.id,
          mriItem.id,
          { newStatus: "IN_PROGRESS" },
        );
        const statusRes = await transitionOrderItemStatus(
          partnerMetroActor,
          orderA.id,
          mriItem.id,
          { newStatus: "COMPLETED" },
        );
        expect(statusRes.orderStatus).toBe("PARTIALLY_COMPLETED");

        const uploadedReport = await uploadDiagnosticReportForOrderItem({
          actor: partnerMetroActor,
          orderItemId: mriItem.id,
          filename: "MRI_Brain_Meera.pdf",
          declaredMimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.7\n%Synthetic Demo MRI Report\n%%EOF", "utf8"),
        });

        // Partner B CANNOT download Partner A's uploaded report -> 404 NOT_FOUND
        await expect(
          downloadAuthorizedReportFile(partnerStarActor, uploadedReport.id),
        ).rejects.toThrow(/NOT_FOUND/);

        // 6. Model A Partner Settlement (Strictly COMPLETED items: only MRI ₹2,450; Lipid & CBC still PENDING!)
        const todayStr = new Date().toISOString().slice(0, 10);
        const settlementA = await createPartnerSettlement(adminActor, {
          partnerId: metroPartner.id,
          commercialModel: "MODEL_A_CONSULTANCY_COLLECTS",
          periodStart: todayStr,
          periodEnd: todayStr,
        });
        expect(settlementA.items).toHaveLength(1);
        expect(money(settlementA.netAmount)).toBe("2450.00");

        // Attempting a duplicate settlement for the same completed item MUST fail
        await expect(
          createPartnerSettlement(adminActor, {
            partnerId: metroPartner.id,
            commercialModel: "MODEL_A_CONSULTANCY_COLLECTS",
            periodStart: todayStr,
            periodEnd: todayStr,
          }),
        ).rejects.toThrow(/No unsettled COMPLETED test items/);

        await approvePartnerSettlement(adminActor, settlementA.id);
        const partialPayout = await recordAndAllocateSettlementPayment(
          adminActor,
          settlementA.id,
          {
            amount: "1000.00",
            paymentMethod: "NEFT",
            utrOrReference: "UTR-PART-1",
          },
        );
        expect(partialPayout.status).toBe("PARTIALLY_SETTLED");
        expect(money(partialPayout.balanceAmount)).toBe("1450.00");

        // 7. Model B Order (Patient Pays Partner Directly -> Commission Receivable)
        const orderB = await createDiagnosticOrder(adminActor, {
          patientId: patient.id,
          partnerId: starPartner.id,
          paymentModel: "MODEL_B_PATIENT_PAYS_PARTNER",
          items: [{ testId: lipidTest.id, quantity: 2, discountAmount: "0.00" }], // ₹2,000 -> 15% = ₹300 commission
        });

        // Model B strictly prohibits issuing a consultancy patient invoice
        await expect(issueModelAInvoice(adminActor, orderB.id)).rejects.toThrow(
          /MODEL_B_INVOICE_PROHIBITED/,
        );

        await recordModelBPartnerInvoiceReference(adminActor, orderB.id, {
          partnerInvoiceNumber: "STAR-INV-9001",
          invoiceDate: todayStr,
          grossAmount: "2000.00",
          discountAmount: "0.00",
          taxAmount: "0.00",
          netAmountPaidByPatient: "2000.00",
        });

        const orderBItem = orderB.items[0]!;
        await transitionOrderItemStatus(
          partnerStarActor,
          orderB.id,
          orderBItem.id,
          { newStatus: "CONFIRMED" },
        );
        await transitionOrderItemStatus(
          partnerStarActor,
          orderB.id,
          orderBItem.id,
          { newStatus: "COMPLETED" },
        );

        const settlementB = await createPartnerSettlement(adminActor, {
          partnerId: starPartner.id,
          commercialModel: "MODEL_B_PATIENT_PAYS_PARTNER",
          periodStart: todayStr,
          periodEnd: todayStr,
        });
        expect(settlementB.direction).toBe("RECEIVABLE_FROM_PARTNER");
        expect(money(settlementB.netAmount)).toBe("300.00");

        // 8. Verify Dashboard separates Model B direct partner collections from Consultancy Cash/Bank
        const dash = await getDashboardSummary(adminActor);
        expect(dash.cashCollected).toBe("2000.00");
        expect(dash.totalSuccessfulCollections).toBe("5000.00"); // ₹2,000 + ₹2,000 + ₹1,000 (Model B ₹2,000 NOT included!)
        expect(dash.partnerDirectCollectionsInformational).toBe("2000.00");

        // 9. Verify Double-Entry Accounting Ledger is 100% balanced (SUM(debit) === SUM(credit))
        const ledgerTotals = await db.journalEntryLine.aggregate({
          _sum: { debitAmount: true, creditAmount: true },
        });
        expect(money(ledgerTotals._sum.debitAmount ?? 0)).toBe(
          money(ledgerTotals._sum.creditAmount ?? 0),
        );
      },
      30_000,
    );
  },
);

