import { db } from "@/lib/db";
import { buildExcelReportBuffer } from "@/lib/excel/exporter";
import { AppError } from "@/lib/errors";
import { addMoney, subMoney, sumMoney } from "@/lib/money";
import {
  requireConsultancyPortal,
  requirePermission,
} from "@/lib/permissions/rbac";
import type { ActorContext } from "@/lib/permissions/types";
import { aggregateConsultancyCollections } from "./collection-aggregator";

export async function getDashboardSummary(
  actor: ActorContext,
  params?: { from?: Date; to?: Date },
) {
  requireConsultancyPortal(actor);

  const dateFilter =
    params?.from || params?.to
      ? {
          gte: params.from,
          lte: params.to,
        }
      : undefined;

  const [
    patientCount,
    orders,
    orderItems,
    invoices,
    payments,
    refunds,
    gatewayTxs,
    gatewaySettlements,
    settlements,
    modelBDirectRecords,
  ] = await Promise.all([
    db.patient.count({ where: dateFilter ? { createdAt: dateFilter } : undefined }),
    db.diagnosticOrder.findMany({
      where: dateFilter ? { createdAt: dateFilter } : undefined,
      select: { status: true, paymentModel: true },
    }),
    db.orderItem.findMany({
      where: dateFilter ? { createdAt: dateFilter } : undefined,
      select: { status: true },
    }),
    db.invoice.findMany({
      where: {
        status: { not: "VOID" },
        ...(dateFilter ? { issueDate: dateFilter } : {}),
      },
      select: { effectiveTotal: true, balanceDue: true },
    }),
    db.patientPayment.findMany({
      where: dateFilter ? { paymentDate: dateFilter } : undefined,
      select: { paymentMethod: true, paymentStatus: true, amount: true },
    }),
    db.refund.findMany({
      where: {
        status: "PROCESSED",
        ...(dateFilter ? { processedAt: dateFilter } : {}),
      },
      select: { amount: true },
    }),
    db.paymentGatewayTransaction.findMany({
      where: dateFilter ? { createdAt: dateFilter } : undefined,
      select: { gatewayFee: true, gatewayFeeTax: true, settlementStatus: true },
    }),
    db.gatewaySettlement.findMany({
      select: { bankReconciledAt: true, netAmount: true },
    }),
    db.settlement.findMany({
      where: { status: { notIn: ["CANCELLED", "REVERSED"] } },
      select: { direction: true, balanceAmount: true },
    }),
    db.collectionRecord.findMany({
      where: {
        recordType: "MODEL_B_PARTNER_DIRECT",
        ...(dateFilter ? { collectedAt: dateFilter } : {}),
      },
      select: { amount: true },
    }),
  ]);

  const collections = aggregateConsultancyCollections({
    patientPayments: payments.map((p) => ({
      method: p.paymentMethod,
      status: p.paymentStatus,
      amount: p.amount.toString(),
    })),
    modelBDirectCollections: modelBDirectRecords.map((c) => ({
      amount: c.amount.toString(),
    })),
  });

  const ordersByStatus: Record<string, number> = {};
  for (const ord of orders) {
    ordersByStatus[ord.status] = (ordersByStatus[ord.status] ?? 0) + 1;
  }

  const completedTests = orderItems.filter((i) => i.status === "COMPLETED").length;
  const pendingTests = orderItems.filter(
    (i) => i.status === "PENDING" || i.status === "CONFIRMED" || i.status === "IN_PROGRESS",
  ).length;

  const totalInvoiceValue = sumMoney(invoices.map((i) => i.effectiveTotal.toString()));
  const outstandingPatientBalances = sumMoney(
    invoices.map((i) => i.balanceDue.toString()),
  );
  const totalRefunds = sumMoney(refunds.map((r) => r.amount.toString()));

  const gatewayFeesTotal = sumMoney(
    gatewayTxs.map((g) =>
      addMoney(g.gatewayFee.toString(), g.gatewayFeeTax.toString()),
    ),
  );

  const partnerPayablesOutstanding = sumMoney(
    settlements
      .filter((s) => s.direction === "PAYABLE_TO_PARTNER")
      .map((s) => s.balanceAmount.toString()),
  );

  const partnerCommissionReceivablesOutstanding = sumMoney(
    settlements
      .filter((s) => s.direction === "RECEIVABLE_FROM_PARTNER")
      .map((s) => s.balanceAmount.toString()),
  );

  const unreconciledGatewayBatches = gatewaySettlements.filter(
    (g) => !g.bankReconciledAt,
  ).length;

  return {
    patientCount,
    ordersTotal: orders.length,
    ordersByStatus,
    completedTests,
    pendingTests,
    totalInvoiceValue,
    cashCollected: collections.cashCollected,
    razorpayCollected: collections.razorpayCollected,
    otherBankCollected: collections.otherBankCollected,
    totalSuccessfulCollections: collections.totalConsultancyCollections,
    netCollectionsAfterRefunds: subMoney(
      collections.totalConsultancyCollections,
      totalRefunds,
    ),
    partnerDirectCollectionsInformational:
      collections.partnerDirectCollectionsTrackedSeparately,
    outstandingPatientBalances,
    totalRefunds,
    gatewayFeesTotal,
    unreconciledGatewayBatches,
    partnerPayablesOutstanding,
    partnerCommissionReceivablesOutstanding,
  };
}

export const SUPPORTED_EXPORT_REPORTS = [
  "daily-collections",
  "invoice-register",
  "patient-outstanding",
  "cashier-closing",
  "razorpay-transactions",
  "razorpay-settlements",
  "refund-register",
  "partner-payables",
  "partner-commissions",
  "completed-tests",
  "partner-performance",
  "patient-order-history",
  "gross-margin-analysis",
] as const;

export type SupportedExportReportType = (typeof SUPPORTED_EXPORT_REPORTS)[number];

export async function generateFinancialExcelExport(
  actor: ActorContext,
  reportType: string,
): Promise<{ buffer: Buffer; filename: string }> {
  requireConsultancyPortal(actor);
  requirePermission(actor, "reports:finance");

  if (!SUPPORTED_EXPORT_REPORTS.includes(reportType as SupportedExportReportType)) {
    throw new AppError("BAD_REQUEST", `Unsupported report type: ${reportType}`, 400);
  }

  const typed = reportType as SupportedExportReportType;
  const dateStamp = new Date().toISOString().slice(0, 10);

  switch (typed) {
    case "daily-collections":
    case "cashier-closing": {
      const rows = await db.patientPayment.findMany({
        where: { paymentStatus: { in: ["SUCCESS", "PARTIALLY_REFUNDED", "REFUNDED"] } },
        orderBy: { paymentDate: "desc" },
        include: {
          invoice: { select: { invoiceNumber: true, patientNameSnapshot: true } },
          receipt: { select: { receiptNumber: true } },
          collectedBy: { select: { fullName: true } },
        },
      });
      const buffer = await buildExcelReportBuffer({
        sheetName: "Collections",
        title:
          typed === "cashier-closing"
            ? "Cashier Shift & Closing Collection Register"
            : "Daily Patient Collection Report (Model A Only)",
        subtitle: "Excludes Model B direct patient-to-partner collections.",
        columns: [
          { header: "Date (UTC)", key: "date", width: 22 },
          { header: "Receipt #", key: "receipt", width: 20 },
          { header: "Invoice #", key: "invoice", width: 20 },
          { header: "Patient", key: "patient", width: 24 },
          { header: "Method", key: "method", width: 16 },
          { header: "Collector", key: "collector", width: 20 },
          { header: "Reference", key: "reference", width: 22 },
          { header: "Amount (INR)", key: "amount", width: 16, isCurrency: true },
        ],
        rows: rows.map((r) => ({
          date: r.paymentDate.toISOString(),
          receipt: r.receipt?.receiptNumber ?? "-",
          invoice: r.invoice.invoiceNumber,
          patient: r.invoice.patientNameSnapshot,
          method: r.paymentMethod,
          collector: r.collectedBy?.fullName ?? "Gateway Webhook",
          reference: r.externalReference ?? "",
          amount: r.amount.toString(),
        })),
      });
      return { buffer, filename: `${typed}-${dateStamp}.xlsx` };
    }

    case "invoice-register":
    case "patient-outstanding": {
      const rows = await db.invoice.findMany({
        where:
          typed === "patient-outstanding"
            ? { balanceDue: { gt: 0 }, status: { not: "VOID" } }
            : undefined,
        orderBy: { issueDate: "desc" },
      });
      const buffer = await buildExcelReportBuffer({
        sheetName: "Invoices",
        title:
          typed === "patient-outstanding"
            ? "Patient Outstanding Balance Register"
            : "Model A Invoice Register",
        columns: [
          { header: "Invoice #", key: "invoiceNumber", width: 20 },
          { header: "Issue Date", key: "issueDate", width: 20 },
          { header: "Patient", key: "patient", width: 24 },
          { header: "Partner Centre", key: "partner", width: 24 },
          { header: "Status", key: "status", width: 18 },
          { header: "Effective Total", key: "total", width: 16, isCurrency: true },
          { header: "Net Collected", key: "collected", width: 16, isCurrency: true },
          { header: "Balance Due", key: "due", width: 16, isCurrency: true },
        ],
        rows: rows.map((i) => ({
          invoiceNumber: i.invoiceNumber,
          issueDate: i.issueDate.toISOString().slice(0, 10),
          patient: `${i.patientNameSnapshot} (${i.patientCodeSnapshot})`,
          partner: i.partnerNameSnapshot,
          status: i.status,
          total: i.effectiveTotal.toString(),
          collected: i.netCollected.toString(),
          due: i.balanceDue.toString(),
        })),
      });
      return { buffer, filename: `${typed}-${dateStamp}.xlsx` };
    }

    case "razorpay-transactions": {
      const rows = await db.paymentGatewayTransaction.findMany({
        orderBy: { createdAt: "desc" },
        include: { payment: { include: { invoice: { select: { invoiceNumber: true } } } } },
      });
      const buffer = await buildExcelReportBuffer({
        sheetName: "RazorpayTxs",
        title: "Razorpay Gateway Transaction & Fee Register",
        columns: [
          { header: "Date", key: "date", width: 20 },
          { header: "Invoice #", key: "invoice", width: 20 },
          { header: "Gateway Order ID", key: "orderId", width: 22 },
          { header: "Gateway Payment ID", key: "paymentId", width: 22 },
          { header: "Method", key: "method", width: 14 },
          { header: "Status", key: "status", width: 14 },
          { header: "Gross (INR)", key: "gross", width: 16, isCurrency: true },
          { header: "Fee Excl GST", key: "fee", width: 15, isCurrency: true },
          { header: "Fee GST", key: "tax", width: 15, isCurrency: true },
        ],
        rows: rows.map((g) => ({
          date: g.createdAt.toISOString(),
          invoice: g.payment.invoice.invoiceNumber,
          orderId: g.gatewayOrderId ?? "",
          paymentId: g.gatewayPaymentId ?? "",
          method: g.gatewayMethod ?? "",
          status: g.gatewayStatus,
          gross: g.grossAmount.toString(),
          fee: g.gatewayFee.toString(),
          tax: g.gatewayFeeTax.toString(),
        })),
      });
      return { buffer, filename: `${typed}-${dateStamp}.xlsx` };
    }

    case "razorpay-settlements": {
      const rows = await db.gatewaySettlement.findMany({
        orderBy: { settledAt: "desc" },
      });
      const buffer = await buildExcelReportBuffer({
        sheetName: "GatewaySettlements",
        title: "Razorpay Settlement Batch vs Bank Credit Reconciliation",
        columns: [
          { header: "Settlement ID", key: "id", width: 22 },
          { header: "UTR", key: "utr", width: 22 },
          { header: "Settled Date", key: "settledAt", width: 20 },
          { header: "Bank Reconciled", key: "bankReconciled", width: 20 },
          { header: "Gross", key: "gross", width: 16, isCurrency: true },
          { header: "Fee", key: "fee", width: 14, isCurrency: true },
          { header: "Tax", key: "tax", width: 14, isCurrency: true },
          { header: "Net Bank Credit", key: "net", width: 16, isCurrency: true },
        ],
        rows: rows.map((s) => ({
          id: s.gatewaySettlementId,
          utr: s.utrNumber ?? "",
          settledAt: s.settledAt.toISOString().slice(0, 10),
          bankReconciled: s.bankReconciledAt
            ? s.bankReconciledAt.toISOString().slice(0, 10)
            : "UNRECONCILED",
          gross: s.grossAmount.toString(),
          fee: s.totalFee.toString(),
          tax: s.totalTax.toString(),
          net: s.netAmount.toString(),
        })),
      });
      return { buffer, filename: `${typed}-${dateStamp}.xlsx` };
    }

    case "refund-register": {
      const rows = await db.refund.findMany({
        orderBy: { createdAt: "desc" },
        include: { invoice: { select: { invoiceNumber: true, patientNameSnapshot: true } } },
      });
      const buffer = await buildExcelReportBuffer({
        sheetName: "Refunds",
        title: "Patient Payment Refund Register",
        columns: [
          { header: "Refund #", key: "num", width: 20 },
          { header: "Invoice #", key: "inv", width: 20 },
          { header: "Patient", key: "patient", width: 24 },
          { header: "Method", key: "method", width: 18 },
          { header: "Status", key: "status", width: 14 },
          { header: "Reason", key: "reason", width: 32 },
          { header: "Amount", key: "amount", width: 16, isCurrency: true },
        ],
        rows: rows.map((r) => ({
          num: r.refundNumber,
          inv: r.invoice.invoiceNumber,
          patient: r.invoice.patientNameSnapshot,
          method: r.refundMethod,
          status: r.status,
          reason: r.reason,
          amount: r.amount.toString(),
        })),
      });
      return { buffer, filename: `${typed}-${dateStamp}.xlsx` };
    }

    case "partner-payables":
    case "partner-commissions": {
      const direction =
        typed === "partner-payables"
          ? "PAYABLE_TO_PARTNER"
          : "RECEIVABLE_FROM_PARTNER";
      const rows = await db.settlement.findMany({
        where: { direction },
        orderBy: { periodEnd: "desc" },
        include: { partner: { select: { displayName: true, partnerCode: true } } },
      });
      const buffer = await buildExcelReportBuffer({
        sheetName: "Settlements",
        title:
          typed === "partner-payables"
            ? "Model A Partner Diagnostic Payable Statements"
            : "Model B Partner Commission Receivable Statements",
        columns: [
          { header: "Settlement #", key: "num", width: 22 },
          { header: "Partner", key: "partner", width: 26 },
          { header: "Period", key: "period", width: 24 },
          { header: "Status", key: "status", width: 18 },
          { header: "Net Statement", key: "net", width: 16, isCurrency: true },
          { header: "Settled / Received", key: "settled", width: 16, isCurrency: true },
          { header: "Balance", key: "balance", width: 16, isCurrency: true },
        ],
        rows: rows.map((s) => ({
          num: s.settlementNumber,
          partner: `${s.partner.displayName} (${s.partner.partnerCode})`,
          period: `${s.periodStart.toISOString().slice(0, 10)} to ${s.periodEnd.toISOString().slice(0, 10)}`,
          status: s.status,
          net: s.netAmount.toString(),
          settled: s.settledAmount.toString(),
          balance: s.balanceAmount.toString(),
        })),
      });
      return { buffer, filename: `${typed}-${dateStamp}.xlsx` };
    }

    case "completed-tests":
    case "partner-performance":
    case "patient-order-history":
    case "gross-margin-analysis": {
      const items = await db.orderItem.findMany({
        where: typed === "completed-tests" ? { status: "COMPLETED" } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          order: {
            select: {
              orderNumber: true,
              paymentModel: true,
              patient: { select: { fullName: true, patientCode: true } },
              partner: { select: { displayName: true } },
            },
          },
        },
      });
      const buffer = await buildExcelReportBuffer({
        sheetName: "OrderItems",
        title:
          typed === "gross-margin-analysis"
            ? "Illustrative Gross Commercial Difference Report (Before Indirect Expenses, Gateway Fees & Taxes)"
            : `Operational Register — ${typed}`,
        subtitle:
          typed === "gross-margin-analysis"
            ? "NOTE: Gross commercial difference (Model A Selling Excl Tax minus Partner Rate, or Model B Accrued Commission) is NOT Net Accounting Profit."
            : undefined,
        columns: [
          { header: "Order #", key: "order", width: 20 },
          { header: "Model", key: "model", width: 26 },
          { header: "Patient", key: "patient", width: 24 },
          { header: "Partner", key: "partner", width: 24 },
          { header: "Test", key: "test", width: 26 },
          { header: "Status", key: "status", width: 16 },
          { header: "Taxable Selling", key: "selling", width: 16, isCurrency: true },
          { header: "Partner Cost (Mod A)", key: "cost", width: 18, isCurrency: true },
          { header: "Commission (Mod B)", key: "comm", width: 18, isCurrency: true },
          { header: "Gross Commercial Diff", key: "grossDiff", width: 20, isCurrency: true },
        ],
        rows: items.map((i) => {
          const isCompleted = i.status === "COMPLETED";
          const grossDiff = !isCompleted
            ? "0.00"
            : i.order.paymentModel === "MODEL_A_CONSULTANCY_COLLECTS"
              ? subMoney(
                  i.taxableAmountSnapshot.toString(),
                  i.partnerNetPayableSnapshot.toString(),
                )
              : (i.commissionAmountSnapshot?.toString() ?? "0.00");
          return {
            order: i.order.orderNumber,
            model: i.order.paymentModel,
            patient: `${i.order.patient.fullName} (${i.order.patient.patientCode})`,
            partner: i.order.partner.displayName,
            test: `${i.testCodeSnapshot} — ${i.testNameSnapshot}`,
            status: i.status,
            selling: i.taxableAmountSnapshot.toString(),
            cost: i.partnerNetPayableSnapshot.toString(),
            comm: i.commissionAmountSnapshot?.toString() ?? "0.00",
            grossDiff,
          };
        }),
      });
      return { buffer, filename: `${typed}-${dateStamp}.xlsx` };
    }
  }
}

