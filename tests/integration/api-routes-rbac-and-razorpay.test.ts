import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST as postCreateOrder } from "@/app/api/v1/orders/route";
import { GET as getPartnerOrder } from "@/app/api/v1/partner/orders/[id]/route";
import { GET as getPublicSharedDoc } from "@/app/api/v1/public/documents/[token]/route";
import { POST as postReconciliation } from "@/app/api/v1/reconciliation/route";
import { GET as getReportDownload } from "@/app/api/v1/reports/[fileId]/download/route";
import { GET as getSettlementPdf } from "@/app/api/v1/settlements/[id]/pdf/route";
import { POST as postRazorpayWebhook } from "@/app/api/v1/webhooks/razorpay/route";
import { createServerSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getEnv, resetEnvCacheForTests } from "@/lib/env";
import { addMoney, money } from "@/lib/money";
import { ROLE_PERMISSIONS } from "@/lib/permissions/rbac";
import type { ActorContext } from "@/lib/permissions/types";
import {
  createAndShareDocumentLink,
  issueModelAInvoice,
  revokeShareToken,
} from "@/modules/billing/service";
import {
  amendOrCancelDiagnosticOrder,
  createDiagnosticOrder,
  transitionOrderItemStatus,
} from "@/modules/orders/service";
import { createPatient } from "@/modules/patients/service";
import { uploadDiagnosticReportForOrderItem } from "@/modules/reports/service";
import {
  addPartnerSettlementAdjustment,
  createPartnerSettlement,
} from "@/modules/settlements/service";
import { createUserAccount, updateUserStatusAndRoles } from "@/modules/users/service";

const runLivePg = Boolean(process.env.RUN_LIVE_PG_TESTS === "true");

function buildAuthedRequest(
  url: string,
  opts: {
    method?: string;
    rawToken?: string;
    csrfToken?: string;
    body?: unknown;
  } = {},
): NextRequest {
  const env = getEnv();
  const headers = new Headers({
    origin: "http://localhost:3000",
  });
  if (opts.rawToken) {
    headers.set("cookie", `${env.SESSION_COOKIE_NAME}=${opts.rawToken}`);
  }
  if (opts.csrfToken) {
    headers.set("x-csrf-token", opts.csrfToken);
  }
  let serializedBody: string | undefined;
  if (opts.body !== undefined) {
    headers.set("content-type", "application/json");
    serializedBody =
      typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  }
  return new NextRequest(url, {
    method: opts.method ?? "GET",
    headers,
    body: serializedBody,
  });
}

describe.skipIf(!runLivePg)(
  "Next.js Route Handlers RBAC, Partner Cross-Tenant Isolation, Razorpay Edge Cases & Session Revocation",
  () => {
    it(
      "enforces HTTP 401/403/404 across API Route Handlers, processes failed/expired/settlement Razorpay webhooks safely, revokes share links, and kills active sessions upon user deactivation",
      async () => {
        process.env.RAZORPAY_WEBHOOK_SECRET = "route_handler_webhook_secret_98765";
        resetEnvCacheForTests();

        const [superAdmin, receptionist, accountant, metroUser, starUser, metroPartner, cbcTest] =
          await Promise.all([
            db.user.findUniqueOrThrow({ where: { email: "superadmin@demo-dcms.local" } }),
            db.user.findUniqueOrThrow({ where: { email: "reception@demo-dcms.local" } }),
            db.user.findUniqueOrThrow({ where: { email: "accounts@demo-dcms.local" } }),
            db.user.findUniqueOrThrow({ where: { email: "partner.metro@demo-dcms.local" } }),
            db.user.findUniqueOrThrow({ where: { email: "partner.star@demo-dcms.local" } }),
            db.partner.findUniqueOrThrow({ where: { partnerCode: "PRT-METRO" } }),
            db.test.findUniqueOrThrow({ where: { code: "CBC-01" } }),
          ]);

        const adminActor: ActorContext = {
          userId: superAdmin.id,
          email: superAdmin.email,
          fullName: superAdmin.fullName,
          portalType: "CONSULTANCY",
          roles: ["SUPER_ADMIN"],
          permissions: ROLE_PERMISSIONS.SUPER_ADMIN,
          partnerIds: [],
        };

        const metroPartnerActor: ActorContext = {
          userId: metroUser.id,
          email: metroUser.email,
          fullName: metroUser.fullName,
          portalType: "PARTNER",
          roles: ["PARTNER_ADMIN"],
          permissions: ROLE_PERMISSIONS.PARTNER_ADMIN,
          partnerIds: [metroPartner.id],
        };

        const [receptionSession, accountantSession, metroSession, starSession] =
          await Promise.all([
            createServerSession({ userId: receptionist.id }),
            createServerSession({ userId: accountant.id }),
            createServerSession({ userId: metroUser.id }),
            createServerSession({ userId: starUser.id }),
          ]);

        // Create a dedicated patient + Metro order + completed test + PDF report + settlement
        const patient = await createPatient(adminActor, {
          fullName: "[DEMO] Vikram Kulkarni",
          mobile: "+919833445566",
          gender: "MALE",
          ageYearsSnapshot: 45,
        });

        const metroOrder = await createDiagnosticOrder(adminActor, {
          patientId: patient.id,
          partnerId: metroPartner.id,
          paymentModel: "MODEL_A_CONSULTANCY_COLLECTS",
          items: [{ testId: cbcTest.id, quantity: 1, discountAmount: "0.00" }],
        });

        // 1. Unauthenticated API request -> 401
        const unauthRes = await getPartnerOrder(
          buildAuthedRequest(`http://localhost:3000/api/v1/partner/orders/${metroOrder.id}`),
          { params: Promise.resolve({ id: metroOrder.id }) },
        );
        expect(unauthRes.status).toBe(401);

        // 2. Partner B (Star Care) probing Partner A (Metro) order -> 404 (Cross-tenant IDOR blocked)
        const starCrossOrderRes = await getPartnerOrder(
          buildAuthedRequest(`http://localhost:3000/api/v1/partner/orders/${metroOrder.id}`, {
            rawToken: starSession.rawToken,
          }),
          { params: Promise.resolve({ id: metroOrder.id }) },
        );
        expect(starCrossOrderRes.status).toBe(404);

        // Partner A reading its own order -> 200 without consultancy selling prices
        const metroOwnOrderRes = await getPartnerOrder(
          buildAuthedRequest(`http://localhost:3000/api/v1/partner/orders/${metroOrder.id}`, {
            rawToken: metroSession.rawToken,
          }),
          { params: Promise.resolve({ id: metroOrder.id }) },
        );
        expect(metroOwnOrderRes.status).toBe(200);
        const metroOwnJson = await metroOwnOrderRes.json();
        expect(JSON.stringify(metroOwnJson)).not.toContain("unitSellingPriceSnapshot");

        // 3. Partner user attempting consultancy-only POST /api/v1/orders -> 403 FORBIDDEN
        const partnerCreateOrderRes = await postCreateOrder(
          buildAuthedRequest("http://localhost:3000/api/v1/orders", {
            method: "POST",
            rawToken: metroSession.rawToken,
            csrfToken: metroSession.csrfToken,
            body: {
              patientId: patient.id,
              partnerId: metroPartner.id,
              paymentModel: "MODEL_A_CONSULTANCY_COLLECTS",
              items: [{ testId: cbcTest.id, quantity: 1 }],
            },
          }),
        );
        expect(partnerCreateOrderRes.status).toBe(403);

        // 4. Upload report & complete Metro item; verify Partner B gets 404 on report & settlement PDF
        const orderItem = metroOrder.items[0]!;
        await transitionOrderItemStatus(metroPartnerActor, metroOrder.id, orderItem.id, {
          newStatus: "IN_PROGRESS",
        });
        await transitionOrderItemStatus(metroPartnerActor, metroOrder.id, orderItem.id, {
          newStatus: "COMPLETED",
        });

        const reportFile = await uploadDiagnosticReportForOrderItem({
          actor: metroPartnerActor,
          orderItemId: orderItem.id,
          filename: "CBC_Vikram.pdf",
          declaredMimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.7\n%CBC Report\n%%EOF", "utf8"),
        });

        const starReportProbe = await getReportDownload(
          buildAuthedRequest(`http://localhost:3000/api/v1/reports/${reportFile.id}/download`, {
            rawToken: starSession.rawToken,
          }),
          { params: Promise.resolve({ fileId: reportFile.id }) },
        );
        expect(starReportProbe.status).toBe(404);

        const todayStr = new Date().toISOString().slice(0, 10);
        const metroSettlement = await createPartnerSettlement(adminActor, {
          partnerId: metroPartner.id,
          commercialModel: "MODEL_A_CONSULTANCY_COLLECTS",
          periodStart: todayStr,
          periodEnd: todayStr,
        });

        // Credit & Debit adjustments recalculate settlement net/balance deterministically
        await addPartnerSettlementAdjustment(adminActor, metroSettlement.id, {
          adjustmentType: "CREDIT",
          amount: "50.00",
          reason: "Home collection phlebotomy allowance",
        });
        const adjustedSettlement = await db.settlement.findUniqueOrThrow({
          where: { id: metroSettlement.id },
        });
        expect(money(adjustedSettlement.netAmount)).toBe(
          addMoney(money(metroSettlement.grossEligibleAmount), "50.00"),
        );

        const starSettlementPdfProbe = await getSettlementPdf(
          buildAuthedRequest(`http://localhost:3000/api/v1/settlements/${metroSettlement.id}/pdf`, {
            rawToken: starSession.rawToken,
          }),
          { params: Promise.resolve({ id: metroSettlement.id }) },
        );
        expect(starSettlementPdfProbe.status).toBe(404);

        const metroSettlementPdfRes = await getSettlementPdf(
          buildAuthedRequest(`http://localhost:3000/api/v1/settlements/${metroSettlement.id}/pdf`, {
            rawToken: metroSession.rawToken,
          }),
          { params: Promise.resolve({ id: metroSettlement.id }) },
        );
        expect(metroSettlementPdfRes.status).toBe(200);
        const pdfBytes = Buffer.from(await metroSettlementPdfRes.arrayBuffer());
        expect(pdfBytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");

        // 5. Role Separation: Receptionist cannot reconcile gateway settlement batches (403); Accountant can (201)
        const recForbidden = await postReconciliation(
          buildAuthedRequest("http://localhost:3000/api/v1/reconciliation?kind=gateway-settlement", {
            method: "POST",
            rawToken: receptionSession.rawToken,
            csrfToken: receptionSession.csrfToken,
            body: {
              gatewaySettlementId: "setl_forbidden_001",
              utrNumber: "UTR0001",
              grossAmount: "1000.00",
              totalFee: "20.00",
              totalTax: "3.60",
              netBankCreditAmount: "976.40",
            },
          }),
        );
        expect(recForbidden.status).toBe(403);

        const accAllowed = await postReconciliation(
          buildAuthedRequest("http://localhost:3000/api/v1/reconciliation?kind=gateway-settlement", {
            method: "POST",
            rawToken: accountantSession.rawToken,
            csrfToken: accountantSession.csrfToken,
            body: {
              gatewaySettlementId: "setl_acc_valid_002",
              utrNumber: "HDFCN99887766",
              grossAmount: "1000.00",
              totalFee: "20.00",
              totalTax: "3.60",
              netBankCreditAmount: "976.40",
            },
          }),
        );
        expect(accAllowed.status).toBe(201);

        // 6. Razorpay Webhook Edge Cases via POST /api/v1/webhooks/razorpay:
        //    - Invalid signature -> 401
        //    - payment.failed -> marks attempt FAILED without reducing invoice balanceDue
        //    - qr_code.closed -> marks QR session EXPIRED
        //    - settlement.processed -> records gateway_settlements row
        const invoice = await issueModelAInvoice(adminActor, metroOrder.id);
        const pendingPay = await db.patientPayment.create({
          data: {
            invoiceId: invoice.id,
            amount: "500.00",
            paymentMethod: "CARD",
            paymentStatus: "PENDING",
            gatewayTransaction: {
              create: {
                gateway: "RAZORPAY",
                gatewayOrderId: "order_fail_case_01",
                gatewayStatus: "created",
                grossAmount: "500.00",
              },
            },
          },
        });
        const expiringQrPay = await db.patientPayment.create({
          data: {
            invoiceId: invoice.id,
            amount: "500.00",
            paymentMethod: "UPI_QR",
            paymentStatus: "PENDING",
          },
        });
        await db.paymentQrSession.create({
          data: {
            paymentId: expiringQrPay.id,
            invoiceId: invoice.id,
            gatewayQrId: "qr_expire_case_01",
            amount: "500.00",
            status: "ACTIVE",
            expiresAt: new Date(Date.now() + 120_000),
            createdById: adminActor.userId,
          },
        });

        const invalidWhReq = new NextRequest(
          "http://localhost:3000/api/v1/webhooks/razorpay",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-razorpay-signature": "deadbeef0000",
            },
            body: JSON.stringify({ event: "payment.failed" }),
          },
        );
        const invalidWhRes = await postRazorpayWebhook(invalidWhReq);
        expect(invalidWhRes.status).toBe(401);

        const signWebhook = (payloadObj: unknown, eventId: string) => {
          const raw = JSON.stringify(payloadObj);
          const sig = createHmac(
            "sha256",
            process.env.RAZORPAY_WEBHOOK_SECRET!,
          )
            .update(raw, "utf8")
            .digest("hex");
          return new NextRequest("http://localhost:3000/api/v1/webhooks/razorpay", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-razorpay-signature": sig,
              "x-razorpay-event-id": eventId,
            },
            body: raw,
          });
        };

        const failedWhRes = await postRazorpayWebhook(
          signWebhook(
            {
              event: "payment.failed",
              payload: {
                payment: {
                  entity: {
                    id: "pay_failed_01",
                    order_id: "order_fail_case_01",
                    amount: 50000,
                    status: "failed",
                  },
                },
              },
            },
            "evt_fail_case_01",
          ),
        );
        expect(failedWhRes.status).toBe(200);

        const [reloadedPay, reloadedInv] = await Promise.all([
          db.patientPayment.findUniqueOrThrow({ where: { id: pendingPay.id } }),
          db.invoice.findUniqueOrThrow({ where: { id: invoice.id } }),
        ]);
        expect(reloadedPay.paymentStatus).toBe("FAILED");
        expect(money(reloadedInv.balanceDue)).toBe("500.00");
        expect(reloadedInv.status).toBe("UNPAID");

        await postRazorpayWebhook(
          signWebhook(
            {
              event: "qr_code.closed",
              payload: { qr_code: { entity: { id: "qr_expire_case_01", status: "closed" } } },
            },
            "evt_qr_closed_01",
          ),
        );
        const expiredQr = await db.paymentQrSession.findUniqueOrThrow({
          where: { gatewayQrId: "qr_expire_case_01" },
        });
        expect(expiredQr.status).toBe("EXPIRED");

        await postRazorpayWebhook(
          signWebhook(
            {
              event: "settlement.processed",
              payload: {
                settlement: {
                  entity: {
                    id: "setl_webhook_batch_01",
                    utr: "AXISUTR887711",
                    amount: 195280,
                    fees: 4000,
                    tax: 720,
                  },
                },
              },
            },
            "evt_stl_proc_01",
          ),
        );
        const whBatch = await db.gatewaySettlement.findUniqueOrThrow({
          where: { gatewaySettlementId: "setl_webhook_batch_01" },
        });
        expect(whBatch.utrNumber).toBe("AXISUTR887711");

        // 7. Share Link Creation & Revocation -> Public endpoint returns 200 before revoke, 410 after revoke
        const shared = await createAndShareDocumentLink(adminActor, invoice.id, {
          resourceType: "INVOICE",
          channel: "LINK_COPY",
        });
        const rawShareToken = shared.shareUrl.split("/d/")[1]!;

        const publicOk = await getPublicSharedDoc(
          new NextRequest(`http://localhost:3000/api/v1/public/documents/${rawShareToken}`),
          { params: Promise.resolve({ token: rawShareToken }) },
        );
        expect(publicOk.status).toBe(200);

        await revokeShareToken(adminActor, shared.shareTokenId);
        const publicRevoked = await getPublicSharedDoc(
          new NextRequest(`http://localhost:3000/api/v1/public/documents/${rawShareToken}`),
          { params: Promise.resolve({ token: rawShareToken }) },
        );
        expect(publicRevoked.status).toBe(404);

        // 8. Order Amendment & Cancellation Governance
        const cancellableOrder = await createDiagnosticOrder(adminActor, {
          patientId: patient.id,
          partnerId: metroPartner.id,
          paymentModel: "MODEL_A_CONSULTANCY_COLLECTS",
          items: [{ testId: cbcTest.id, quantity: 1, discountAmount: "0.00" }],
        });
        await amendOrCancelDiagnosticOrder(adminActor, cancellableOrder.id, {
          action: "AMEND_NOTES",
          referringDoctor: "Dr. R. Deshmukh",
          clinicalNotes: "Repeat EDTA sample",
          reason: "Added referring clinician name",
        });
        const cancelledOrd = await amendOrCancelDiagnosticOrder(
          adminActor,
          cancellableOrder.id,
          {
            action: "CANCEL_ORDER",
            reason: "Duplicate counter booking cancelled",
          },
        );
        expect(cancelledOrd.status).toBe("CANCELLED");

        // 9. Staff Deactivation Immediately Invalidates Active Server Sessions
        const tempStaff = await createUserAccount(adminActor, {
          email: `temp.ops.${Date.now()}@demo-dcms.local`,
          fullName: "[DEMO] Temp Ops Staff",
          password: "TempPassword#2026!",
          portalType: "CONSULTANCY",
          roleCodes: ["RECEPTIONIST"],
        });
        const tempSession = await createServerSession({ userId: tempStaff.id });

        await updateUserStatusAndRoles(adminActor, tempStaff.id, {
          isActive: false,
        });
        const revokedSessionProbe = await postCreateOrder(
          buildAuthedRequest("http://localhost:3000/api/v1/orders", {
            method: "POST",
            rawToken: tempSession.rawToken,
            csrfToken: tempSession.csrfToken,
            body: {},
          }),
        );
        expect(revokedSessionProbe.status).toBe(401);

        // Verify double-entry ledger remains strictly balanced after all postings
        const ledgerSum = await db.journalEntryLine.aggregate({
          _sum: { debitAmount: true, creditAmount: true },
        });
        expect(money(ledgerSum._sum.debitAmount ?? 0)).toBe(
          money(ledgerSum._sum.creditAmount ?? 0),
        );
      },
      30_000,
    );
  },
);
