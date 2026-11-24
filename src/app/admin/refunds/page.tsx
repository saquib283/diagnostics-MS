import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatInr } from "@/lib/money";
import { requirePermission } from "@/lib/permissions/rbac";

export const metadata: Metadata = { title: "Refunds Register" };

export default async function AdminRefundsPage() {
  const actor = await requireActor();
  requirePermission(actor, "refunds:read");

  const refunds = await db.refund.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      invoice: { select: { id: true, invoiceNumber: true, patientNameSnapshot: true } },
      requestedBy: { select: { fullName: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1
          id="main-content"
          tabIndex={-1}
          className="text-[22px] font-semibold text-[#0F172A] m-0"
        >
          Payment Refunds Register ({refunds.length})
        </h1>
        <p className="text-xs text-[#475569] m-0 mt-0.5">
          All refunds reference the original payment transaction without overwriting historical collection records.
        </p>
      </div>

      <Panel title="Processed & Pending Refunds">
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="refunds-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="refunds-caption" className="visually-hidden">
              Payment refunds register
            </caption>
            <thead>
              <tr>
                <th scope="col">Refund #</th>
                <th scope="col">Invoice #</th>
                <th scope="col">Patient</th>
                <th scope="col">Method</th>
                <th scope="col">Reason</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {refunds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[#475569]">
                    No refunds recorded.
                  </td>
                </tr>
              ) : (
                refunds.map((r) => (
                  <tr key={r.id}>
                    <th scope="row" className="font-mono-code">
                      {r.refundNumber}
                    </th>
                    <td className="font-mono-code">
                      <Link
                        href={`/admin/invoices/${r.invoice.id}`}
                        className="text-[#1B365D] hover:underline"
                      >
                        {r.invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td>{r.invoice.patientNameSnapshot}</td>
                    <td>{r.refundMethod}</td>
                    <td className="text-xs">{r.reason}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="text-right tabular-nums font-medium">
                      {formatInr(r.amount.toString())}
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

