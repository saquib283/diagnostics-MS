import type { Metadata } from "next";
import { Panel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActor } from "@/lib/auth/session";
import { formatInr } from "@/lib/money";
import { listPartnerPortalSettlements } from "@/modules/settlements/service";

export const metadata: Metadata = { title: "Partner Settlement Statements" };

export default async function PartnerSettlementsPage() {
  const actor = await requireActor();
  const statements = await listPartnerPortalSettlements(actor);

  return (
    <div className="space-y-5">
      <div>
        <h1
          id="main-content"
          tabIndex={-1}
          className="text-[22px] font-semibold text-[#0F172A] m-0"
        >
          Partner Settlement & Commission Statements ({statements.length})
        </h1>
        <p className="text-xs text-[#475569] m-0 mt-0.5">
          Statements reflect completed diagnostic tests fulfilled by your centre.
        </p>
      </div>

      <Panel title="Statements">
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="prt-stl-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="prt-stl-caption" className="visually-hidden">
              Partner settlement statements
            </caption>
            <thead>
              <tr>
                <th scope="col">Statement #</th>
                <th scope="col">Type</th>
                <th scope="col">Period</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">
                  Net Amount
                </th>
                <th scope="col" className="text-right">
                  Settled
                </th>
                <th scope="col" className="text-right">
                  Balance
                </th>
                <th scope="col">Document</th>
              </tr>
            </thead>
            <tbody>
              {statements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-[#475569]">
                    No settlement statements issued for your centre yet.
                  </td>
                </tr>
              ) : (
                statements.map((s) => (
                  <tr key={s.id}>
                    <th scope="row" className="font-mono-code font-medium">
                      {s.settlementNumber}
                    </th>
                    <td>
                      <StatusBadge
                        status={s.direction}
                        label={
                          s.direction === "PAYABLE_TO_PARTNER"
                            ? "Receivable from Consultancy"
                            : "Commission Payable to Consultancy"
                        }
                      />
                    </td>
                    <td className="tabular-nums text-xs">
                      {s.periodStart} → {s.periodEnd}
                    </td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="text-right tabular-nums">
                      {formatInr(s.netAmount)}
                    </td>
                    <td className="text-right tabular-nums text-[#166534]">
                      {formatInr(s.settledAmount)}
                    </td>
                    <td className="text-right tabular-nums font-semibold">
                      {formatInr(s.balanceAmount)}
                    </td>
                    <td>
                      <a
                        href={`/api/v1/settlements/${s.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-[#1B365D] underline"
                      >
                        Statement PDF
                      </a>
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

