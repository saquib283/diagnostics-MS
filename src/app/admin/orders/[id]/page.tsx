import type { Metadata } from "next";
import Link from "next/link";
import {
  OrderAmendAndCancelPanel,
  OrderDetailActionsClient,
  OrderItemRowControls,
} from "@/components/admin/order-detail-client";
import { Panel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActor } from "@/lib/auth/session";
import { formatInr } from "@/lib/money";
import { hasPermission } from "@/lib/permissions/rbac";
import { getOrderDetail } from "@/modules/orders/service";

export const metadata: Metadata = { title: "Order Detail" };

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor();
  const { id } = await params;
  const order = await getOrderDetail(actor, id);
  const canAmend = hasPermission(actor, "orders:amend");
  const canApproveCompletion = hasPermission(actor, "orders:completion:approve");
  const canShareReport = hasPermission(actor, "reports:share");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1
              id="main-content"
              tabIndex={-1}
              className="text-[22px] font-semibold text-[#0F172A] font-mono-code m-0"
            >
              {order.orderNumber}
            </h1>
            <StatusBadge status={order.status} />
            <StatusBadge
              status={order.paymentModel}
              label={
                order.paymentModel === "MODEL_A_CONSULTANCY_COLLECTS"
                  ? "Model A — Consultancy Collects"
                  : "Model B — Patient Pays Partner"
              }
            />
          </div>
          <p className="text-xs text-[#475569] m-0 mt-1">
            Patient:{" "}
            <Link
              href={`/admin/patients/${order.patientId}`}
              className="font-medium text-[#1B365D] hover:underline"
            >
              {order.patient.fullName} ({order.patient.patientCode})
            </Link>{" "}
            · Partner Centre:{" "}
            <Link
              href={`/admin/partners/${order.partnerId}`}
              className="font-medium text-[#1B365D] hover:underline"
            >
              {order.partner.displayName}
            </Link>
          </p>
        </div>

        {order.invoice ? (
          <Link
            href={`/admin/invoices/${order.invoice.id}`}
            className="inline-flex h-9 items-center rounded-[4px] bg-[#1B365D] px-3.5 text-sm font-medium text-white no-underline hover:bg-[#122644]"
          >
            Open Invoice {order.invoice.invoiceNumber} ({order.invoice.status})
          </Link>
        ) : null}
      </div>

      <OrderDetailActionsClient
        orderId={order.id}
        paymentModel={order.paymentModel}
        hasInvoice={Boolean(order.invoice)}
        netSellingTotal={order.netSellingTotal.toString()}
        csrfToken={actor.csrfToken}
      />

      {order.partnerInvoiceReference ? (
        <div className="rounded-[6px] border border-[#86EFAC] bg-[#DCFCE7] px-4 py-2.5 text-xs text-[#166534]">
          <strong>Model B Partner Invoice Reference Recorded:</strong> Invoice #
          <span className="font-mono-code ml-1">
            {order.partnerInvoiceReference.partnerInvoiceNumber}
          </span>{" "}
          · Patient Paid Partner:{" "}
          <strong className="tabular-nums">
            {formatInr(
              order.partnerInvoiceReference.netAmountPaidByPatient.toString(),
            )}
          </strong>
        </div>
      ) : null}

      <Panel title="Diagnostic Test Items & Commercial Snapshots">
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="order-items-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="order-items-caption" className="visually-hidden">
              Order test items and snapshots
            </caption>
            <thead>
              <tr>
                <th scope="col">Test</th>
                <th scope="col" className="text-right">
                  Qty
                </th>
                <th scope="col" className="text-right">
                  Selling Snapshot
                </th>
                <th scope="col" className="text-right">
                  {order.paymentModel === "MODEL_A_CONSULTANCY_COLLECTS"
                    ? "Partner Payable (If Completed)"
                    : "Commission Snapshot (If Completed)"}
                </th>
                <th scope="col">Test Status</th>
                <th scope="col">Report</th>
                <th scope="col">Fulfilment & Report Actions</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <th scope="row">
                    <span className="font-mono-code font-medium">
                      {item.testCodeSnapshot}
                    </span>{" "}
                    — {item.testNameSnapshot}
                  </th>
                  <td className="text-right tabular-nums">{item.quantity}</td>
                  <td className="text-right tabular-nums">
                    {formatInr(item.netSellingAmountSnapshot.toString())}
                  </td>
                  <td className="text-right tabular-nums font-medium">
                    {order.paymentModel === "MODEL_A_CONSULTANCY_COLLECTS"
                      ? formatInr(item.partnerNetPayableSnapshot.toString())
                      : item.commissionAmountSnapshot
                        ? `${formatInr(item.commissionAmountSnapshot.toString())} (${Number(item.commissionPercentageSnapshot?.toString() ?? 0).toFixed(1)}%)`
                        : "Basis Unconfigured"}
                  </td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>
                    {item.reportFiles[0] ? (
                      <a
                        href={`/api/v1/reports/${item.reportFiles[0].id}/download`}
                        className="text-xs font-medium text-[#1B365D] underline"
                      >
                        v{item.reportFiles[0].versionNumber} — Download
                      </a>
                    ) : (
                      <StatusBadge
                        status={item.reportTracking?.status ?? "AWAITING"}
                      />
                    )}
                  </td>
                  <td>
                    <OrderItemRowControls
                      orderId={order.id}
                      itemId={item.id}
                      currentStatus={item.status}
                      canApproveCompletion={canApproveCompletion}
                      isCompletionApproved={Boolean(item.completionApprovedAt)}
                      canShareReport={canShareReport}
                      latestReportFileId={item.reportFiles[0]?.id ?? null}
                      patientMobile={order.patient.mobile}
                      patientEmail={order.patient.email}
                      csrfToken={actor.csrfToken}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {canAmend ? (
        <OrderAmendAndCancelPanel
          orderId={order.id}
          orderStatus={order.status}
          initialReferringDoctor={order.referringDoctor}
          initialClinicalNotes={order.clinicalNotes}
          csrfToken={actor.csrfToken}
        />
      ) : null}

      <Panel title="Status Audit Timeline">
        <ul className="space-y-1.5 text-xs text-[#334155] list-none p-0 m-0" role="list">
          {order.statusHistory.map((h) => (
            <li key={h.id} className="border-b border-[#E2E8F0] pb-1.5 last:border-b-0">
              <span className="tabular-nums text-[#475569]">
                {h.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC
              </span>{" "}
              — <strong>{h.actor.fullName}</strong> ({h.actorPortal}):{" "}
              <span className="font-mono-code">
                {h.previousStatus} → {h.newStatus}
              </span>
              {h.reason ? ` (${h.reason})` : ""}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

