import type { Metadata } from "next";
import { SettlementDetailActionsClient } from "@/components/admin/settlements-client";
import { Panel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActor } from "@/lib/auth/session";
import { formatInr } from "@/lib/money";
import { hasPermission } from "@/lib/permissions/rbac";
import { getSettlementDetail } from "@/modules/settlements/service";

export const metadata: Metadata = { title: "Settlement Statement Detail" };

export default async function AdminSettlementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor();
  const { id } = await params;
  const settlement = await getSettlementDetail(actor, id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1
              id="main-content"
              tabIndex={-1}
              className="text-[22px] font-semibold text-[#0F172A] font-mono-code m-0"
            >
              {settlement.settlementNumber}
            </h1>
            <StatusBadge status={settlement.direction} />
            <StatusBadge status={settlement.status} />
          </div>
          <p className="text-xs text-[#475569] m-0 mt-1">
            Partner: <strong>{settlement.partner.displayName}</strong> · Period:{" "}
            {settlement.periodStart.toISOString().slice(0, 10)} to{" "}
            {settlement.periodEnd.toISOString().slice(0, 10)}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <a
            href={`/api/v1/settlements/${settlement.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center rounded-[4px] border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#0F172A] no-underline hover:bg-[#F8FAFC]"
          >
            Download Statement PDF
          </a>
          <div className="text-right">
            <p className="text-xs text-[#475569] m-0">Remaining Balance</p>
            <p className="text-xl font-semibold tabular-nums m-0">
              {formatInr(settlement.balanceAmount.toString())}
            </p>
          </div>
        </div>
      </div>

      <SettlementDetailActionsClient
        settlementId={settlement.id}
        status={settlement.status}
        balanceAmount={settlement.balanceAmount.toString()}
        direction={settlement.direction}
        canApprove={hasPermission(actor, "settlements:approve")}
        canPay={hasPermission(actor, "settlements:pay")}
        csrfToken={actor.csrfToken}
      />

      <Panel title={`Locked Completed Order Items (${settlement.items.length})`}>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="stl-items-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="stl-items-caption" className="visually-hidden">
              Settlement line items
            </caption>
            <thead>
              <tr>
                <th scope="col">Order #</th>
                <th scope="col">Completed Test</th>
                <th scope="col">Completed At</th>
                <th scope="col" className="text-right">
                  Base Value
                </th>
                <th scope="col" className="text-right">
                  Commission %
                </th>
                <th scope="col" className="text-right">
                  Settlement Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {settlement.items.map((item) => (
                <tr key={item.id}>
                  <th scope="row" className="font-mono-code">
                    {item.order.orderNumber}
                  </th>
                  <td>{item.testNameSnapshot}</td>
                  <td className="tabular-nums text-xs">
                    {item.completedAtSnapshot.toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="text-right tabular-nums">
                    {formatInr(item.baseAmount.toString())}
                  </td>
                  <td className="text-right tabular-nums">
                    {item.commissionRateSnapshot
                      ? `${Number(item.commissionRateSnapshot.toString()).toFixed(2)}%`
                      : "—"}
                  </td>
                  <td className="text-right tabular-nums font-semibold">
                    {formatInr(item.settlementAmount.toString())}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {settlement.adjustments.length > 0 ? (
        <Panel title={`Partner Statement Adjustments (${settlement.adjustments.length})`}>
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="stl-adj-caption"
            className="erp-table-region"
          >
            <table className="erp-table">
              <caption id="stl-adj-caption" className="visually-hidden">
                Partner settlement adjustments
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Type</th>
                  <th scope="col">Reason</th>
                  <th scope="col" className="text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {settlement.adjustments.map((adj) => (
                  <tr key={adj.id}>
                    <td className="tabular-nums text-xs">
                      {adj.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                    <th scope="row">
                      <StatusBadge status={adj.adjustmentType} />
                    </th>
                    <td>{adj.reason}</td>
                    <td className="text-right tabular-nums font-medium">
                      {formatInr(adj.amount.toString())}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {settlement.paymentAllocations.length > 0 ? (
        <Panel title={`Allocated Payouts / Remittances (${settlement.paymentAllocations.length})`}>
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="stl-alloc-caption"
            className="erp-table-region"
          >
            <table className="erp-table">
              <caption id="stl-alloc-caption" className="visually-hidden">
                Allocated partner payouts and commission remittances
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Mode</th>
                  <th scope="col">UTR / Reference</th>
                  <th scope="col" className="text-right">
                    Allocated Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {settlement.paymentAllocations.map((pa) => (
                  <tr key={pa.id}>
                    <td className="tabular-nums text-xs">
                      {pa.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                    <td>{pa.partnerPayment.paymentMethod}</td>
                    <th scope="row" className="font-mono-code">
                      {pa.partnerPayment.utrOrReference}
                    </th>
                    <td className="text-right tabular-nums font-semibold">
                      {formatInr(pa.allocatedAmount.toString())}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

