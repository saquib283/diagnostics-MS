import type { Metadata } from "next";
import Link from "next/link";
import { SettlementGeneratorClient } from "@/components/admin/settlements-client";
import { Panel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActor } from "@/lib/auth/session";
import { formatInr } from "@/lib/money";
import { hasPermission } from "@/lib/permissions/rbac";
import { listPartners } from "@/modules/partners/service";
import { listSettlements } from "@/modules/settlements/service";

export const metadata: Metadata = { title: "Partner Settlements" };

export default async function AdminSettlementsPage() {
  const actor = await requireActor();
  const [settlements, partners] = await Promise.all([
    listSettlements(actor),
    listPartners(actor, { activeOnly: true }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1
          id="main-content"
          tabIndex={-1}
          className="text-[22px] font-semibold text-[#0F172A] m-0"
        >
          Partner Payables & Commission Receivables
        </h1>
        <p className="text-xs text-[#475569] m-0 mt-0.5">
          Only COMPLETED order items are eligible. Active item locks guarantee zero duplicate settlement.
        </p>
      </div>

      {hasPermission(actor, "settlements:prepare") ? (
        <SettlementGeneratorClient
          csrfToken={actor.csrfToken}
          partners={partners.map((p) => ({
            id: p.id,
            partnerCode: p.partnerCode,
            displayName: p.displayName,
            defaultPaymentModel: p.defaultPaymentModel,
          }))}
        />
      ) : null}

      <Panel title={`Settlement Statements (${settlements.length})`}>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="settlements-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="settlements-caption" className="visually-hidden">
              Partner settlement statements
            </caption>
            <thead>
              <tr>
                <th scope="col">Statement #</th>
                <th scope="col">Partner</th>
                <th scope="col">Direction</th>
                <th scope="col">Period</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">
                  Net Statement
                </th>
                <th scope="col" className="text-right">
                  Allocated
                </th>
                <th scope="col" className="text-right">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {settlements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-[#475569]">
                    No settlement statements generated yet.
                  </td>
                </tr>
              ) : (
                settlements.map((s) => (
                  <tr key={s.id}>
                    <th scope="row" className="font-mono-code font-medium">
                      <Link
                        href={`/admin/settlements/${s.id}`}
                        className="text-[#1B365D] hover:underline"
                      >
                        {s.settlementNumber}
                      </Link>
                    </th>
                    <td>{s.partner.displayName}</td>
                    <td>
                      <StatusBadge status={s.direction} />
                    </td>
                    <td className="tabular-nums text-xs">
                      {s.periodStart.toISOString().slice(0, 10)} →{" "}
                      {s.periodEnd.toISOString().slice(0, 10)}
                    </td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="text-right tabular-nums">
                      {formatInr(s.netAmount.toString())}
                    </td>
                    <td className="text-right tabular-nums text-[#166534]">
                      {formatInr(s.settledAmount.toString())}
                    </td>
                    <td className="text-right tabular-nums font-semibold">
                      {formatInr(s.balanceAmount.toString())}
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

