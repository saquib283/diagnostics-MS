import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Panel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatInr } from "@/lib/money";
import { getDashboardSummary } from "@/modules/analytics/service";

export const metadata: Metadata = { title: "Operations & Finance Dashboard" };

export default async function AdminDashboardPage() {
  const actor = await requireActor();
  const [summary, orgSettings, recentOrders] = await Promise.all([
    getDashboardSummary(actor),
    db.organizationSettings.findFirst(),
    db.diagnosticOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        patient: { select: { fullName: true, patientCode: true } },
        partner: { select: { displayName: true } },
        invoice: { select: { id: true, invoiceNumber: true, status: true, balanceDue: true } },
      },
    }),
  ]);

  const metrics: Array<{ label: string; value: string; sub?: string }> = [
    {
      label: "Registered Patients",
      value: String(summary.patientCount),
      sub: `${summary.ordersTotal} total diagnostic orders`,
    },
    {
      label: "Completed / Pending Tests",
      value: `${summary.completedTests} / ${summary.pendingTests}`,
      sub: "Only completed items enter settlements",
    },
    {
      label: "Model A Invoice Value",
      value: formatInr(summary.totalInvoiceValue),
      sub: `Outstanding: ${formatInr(summary.outstandingPatientBalances)}`,
    },
    {
      label: "Consultancy Collections",
      value: formatInr(summary.totalSuccessfulCollections),
      sub: `Cash ${formatInr(summary.cashCollected)} · Gateway ${formatInr(summary.razorpayCollected)}`,
    },
    {
      label: "Refunds & Gateway Fees",
      value: formatInr(summary.totalRefunds),
      sub: `Gateway fees+GST: ${formatInr(summary.gatewayFeesTotal)} (${summary.unreconciledGatewayBatches} batches pending bank recon)`,
    },
    {
      label: "Partner Payables (Model A)",
      value: formatInr(summary.partnerPayablesOutstanding),
      sub: "Due to partners for completed tests",
    },
    {
      label: "Commission Receivable (Model B)",
      value: formatInr(summary.partnerCommissionReceivablesOutstanding),
      sub: `Direct partner collections (excl. from cash): ${formatInr(summary.partnerDirectCollectionsInformational)}`,
    },
  ];

  const hasOpenPolicyWarnings =
    orgSettings?.defaultCommissionBasis === "UNCONFIGURED" ||
    !orgSettings?.gstEnabled;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1
            id="main-content"
            tabIndex={-1}
            className="text-[22px] font-semibold text-[#0F172A] m-0"
          >
            Consultancy Operations & Financial Overview
          </h1>
          <p className="text-xs text-[#475569] m-0 mt-0.5">
            Model A consultancy collections and Model B partner direct collections are tracked in strictly separate ledgers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/patients"
            className="inline-flex h-9 items-center rounded-[4px] border border-[#CBD5E1] bg-white px-3 text-sm font-medium text-[#0F172A] no-underline hover:bg-[#F8FAFC]"
          >
            Register Patient
          </Link>
          <Link
            href="/admin/orders/new"
            className="inline-flex h-9 items-center rounded-[4px] bg-[#1B365D] px-3.5 text-sm font-medium text-white no-underline hover:bg-[#122644]"
          >
            Create Partner Order
          </Link>
        </div>
      </div>

      {hasOpenPolicyWarnings ? (
        <div
          role="region"
          aria-label="Open business decisions notice"
          className="flex items-start gap-2.5 rounded-[4px] border border-[#FCD34D] bg-[#FEF3C7] px-3.5 py-2.5 text-xs text-[#92400E]"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <strong className="font-semibold">
              CA / Product Owner Policy Confirmation Gate Active:
            </strong>{" "}
            Default commission basis ({orgSettings?.defaultCommissionBasis}) and GST applicability ({orgSettings?.gstEnabled ? "Enabled" : "Disabled pending CA sign-off"}) use conservative safe defaults until confirmed in{" "}
            <Link href="/admin/settings" className="font-semibold text-[#92400E] underline">
              Settings & Policies
            </Link>
            .
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-[6px] border border-[#E2E8F0] bg-white px-4 py-3"
          >
            <p className="text-xs font-medium text-[#475569] m-0">{m.label}</p>
            <p className="mt-1 text-lg font-semibold text-[#0F172A] tabular-nums m-0">
              {m.value}
            </p>
            {m.sub ? (
              <p className="mt-1 text-[11px] text-[#475569] tabular-nums m-0">
                {m.sub}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <Panel
        title="Recent Diagnostic Orders"
        actions={
          <Link
            href="/admin/orders"
            className="text-xs font-medium text-[#1B365D] hover:underline"
          >
            View all orders
          </Link>
        }
      >
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="recent-orders-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="recent-orders-caption" className="visually-hidden">
              Recent diagnostic orders across partner centres
            </caption>
            <thead>
              <tr>
                <th scope="col">Order #</th>
                <th scope="col">Patient</th>
                <th scope="col">Partner Centre</th>
                <th scope="col">Model</th>
                <th scope="col">Order Status</th>
                <th scope="col">Billing Status</th>
                <th scope="col" className="text-right">
                  Balance Due
                </th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-[#475569]">
                    No diagnostic orders recorded yet.{" "}
                    <Link href="/admin/orders/new" className="text-[#1B365D] underline">
                      Create the first partner order
                    </Link>
                    .
                  </td>
                </tr>
              ) : (
                recentOrders.map((ord) => (
                  <tr key={ord.id}>
                    <th scope="row" className="font-mono-code font-medium">
                      <Link
                        href={`/admin/orders/${ord.id}`}
                        className="text-[#1B365D] hover:underline"
                      >
                        {ord.orderNumber}
                      </Link>
                    </th>
                    <td>
                      {ord.patient.fullName}{" "}
                      <span className="font-mono-code text-xs text-[#475569]">
                        ({ord.patient.patientCode})
                      </span>
                    </td>
                    <td>{ord.partner.displayName}</td>
                    <td>
                      <StatusBadge
                        status={ord.paymentModel}
                        label={
                          ord.paymentModel === "MODEL_A_CONSULTANCY_COLLECTS"
                            ? "Model A"
                            : "Model B"
                        }
                      />
                    </td>
                    <td>
                      <StatusBadge status={ord.status} />
                    </td>
                    <td>
                      {ord.invoice ? (
                        <Link href={`/admin/invoices/${ord.invoice.id}`}>
                          <StatusBadge status={ord.invoice.status} />
                        </Link>
                      ) : ord.paymentModel === "MODEL_B_PATIENT_PAYS_PARTNER" ? (
                        <span className="text-xs text-[#475569]">
                          Partner Direct
                        </span>
                      ) : (
                        <span className="text-xs text-[#92400E]">
                          Invoice Not Issued
                        </span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">
                      {ord.invoice
                        ? formatInr(ord.invoice.balanceDue.toString())
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

