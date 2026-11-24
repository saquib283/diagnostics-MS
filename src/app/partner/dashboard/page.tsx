import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActor } from "@/lib/auth/session";
import { formatInr } from "@/lib/money";
import { hasPermission } from "@/lib/permissions/rbac";
import { listOrdersForPartnerPortal } from "@/modules/orders/service";
import { listPartnerPortalSettlements } from "@/modules/settlements/service";

export const metadata: Metadata = { title: "Partner Centre Overview" };

export default async function PartnerDashboardPage() {
  const actor = await requireActor();
  const ordersRes = await listOrdersForPartnerPortal(actor, { pageSize: 15 });
  const settlements = hasPermission(actor, "partner:settlements:read")
    ? await listPartnerPortalSettlements(actor)
    : [];

  const pendingItemsCount = ordersRes.items.reduce(
    (acc, o) =>
      acc +
      o.items.filter(
        (i) =>
          i.status === "PENDING" ||
          i.status === "CONFIRMED" ||
          i.status === "IN_PROGRESS",
      ).length,
    0,
  );
  const completedItemsCount = ordersRes.items.reduce(
    (acc, o) => acc + o.items.filter((i) => i.status === "COMPLETED").length,
    0,
  );

  return (
    <div className="space-y-5">
      <div>
        <h1
          id="main-content"
          tabIndex={-1}
          className="text-[22px] font-semibold text-[#0F172A] m-0"
        >
          Partner Diagnostic Centre Queue
        </h1>
        <p className="text-xs text-[#475569] m-0 mt-0.5">
          Scoped strictly to orders assigned to your centre. Update test progress and upload diagnostic reports.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-[6px] border border-[#E2E8F0] bg-white px-4 py-3">
          <p className="text-xs text-[#475569] m-0">Assigned Orders</p>
          <p className="mt-1 text-lg font-semibold tabular-nums m-0">
            {ordersRes.totalItems}
          </p>
        </div>
        <div className="rounded-[6px] border border-[#E2E8F0] bg-white px-4 py-3">
          <p className="text-xs text-[#475569] m-0">Tests Pending Fulfilment</p>
          <p className="mt-1 text-lg font-semibold text-[#92400E] tabular-nums m-0">
            {pendingItemsCount}
          </p>
        </div>
        <div className="rounded-[6px] border border-[#E2E8F0] bg-white px-4 py-3">
          <p className="text-xs text-[#475569] m-0">Tests Completed</p>
          <p className="mt-1 text-lg font-semibold text-[#166534] tabular-nums m-0">
            {completedItemsCount}
          </p>
        </div>
      </div>

      <Panel
        title="Assigned Diagnostic Orders"
        actions={
          <Link
            href="/partner/orders"
            className="text-xs font-medium text-[#1B365D] hover:underline"
          >
            View all assigned orders
          </Link>
        }
      >
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="partner-dash-orders-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="partner-dash-orders-caption" className="visually-hidden">
              Assigned partner diagnostic orders
            </caption>
            <thead>
              <tr>
                <th scope="col">Order #</th>
                <th scope="col">Patient</th>
                <th scope="col">Patient Contact</th>
                <th scope="col">Tests</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {ordersRes.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#475569]">
                    No diagnostic orders assigned to your centre yet.
                  </td>
                </tr>
              ) : (
                ordersRes.items.map((ord) => (
                  <tr key={ord.id}>
                    <th scope="row" className="font-mono-code font-medium">
                      <Link
                        href={`/partner/orders/${ord.id}`}
                        className="text-[#1B365D] hover:underline"
                      >
                        {ord.orderNumber}
                      </Link>
                    </th>
                    <td>
                      {ord.patient.fullName} ({ord.patient.gender}
                      {ord.patient.ageYears !== null
                        ? `, ${ord.patient.ageYears}Y`
                        : ""}
                      )
                    </td>
                    <td className="font-mono-code text-xs">
                      {ord.patient.mobileDisplay}
                    </td>
                    <td className="text-xs">
                      {ord.items.map((i) => i.testName).join(", ")}
                    </td>
                    <td>
                      <StatusBadge status={ord.status} />
                    </td>
                    <td>
                      <Link
                        href={`/partner/orders/${ord.id}`}
                        className="text-xs font-medium text-[#1B365D] hover:underline"
                      >
                        Update Status / Upload Report
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {settlements.length > 0 ? (
        <Panel title="Recent Settlement Statements">
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="partner-dash-settlements-caption"
            className="erp-table-region"
          >
            <table className="erp-table">
              <caption
                id="partner-dash-settlements-caption"
                className="visually-hidden"
              >
                Recent partner settlement statements
              </caption>
              <thead>
                <tr>
                  <th scope="col">Statement #</th>
                  <th scope="col">Period</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {settlements.slice(0, 5).map((s) => (
                  <tr key={s.id}>
                    <th scope="row" className="font-mono-code font-medium">
                      {s.settlementNumber}
                    </th>
                    <td className="tabular-nums text-xs">
                      {s.periodStart} → {s.periodEnd}
                    </td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="text-right tabular-nums font-medium">
                      {formatInr(s.balanceAmount)}
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

