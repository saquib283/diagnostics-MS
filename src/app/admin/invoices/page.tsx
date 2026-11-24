import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActor } from "@/lib/auth/session";
import { formatInr } from "@/lib/money";
import { listInvoices } from "@/modules/billing/service";

export const metadata: Metadata = { title: "Invoices & Bills" };

export default async function AdminInvoicesPage() {
  const actor = await requireActor();
  const { items, totalItems } = await listInvoices(actor, { pageSize: 40 });

  return (
    <div className="space-y-5">
      <div>
        <h1
          id="main-content"
          tabIndex={-1}
          className="text-[22px] font-semibold text-[#0F172A] m-0"
        >
          Model A Patient Invoices ({totalItems})
        </h1>
        <p className="text-xs text-[#475569] m-0 mt-0.5">
          Issued invoices are immutable. Partially paid invoices always display PARTIALLY PAID with exact remaining balance.
        </p>
      </div>

      <Panel title="Invoice Register">
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="invoices-table-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="invoices-table-caption" className="visually-hidden">
              Issued patient invoices
            </caption>
            <thead>
              <tr>
                <th scope="col">Invoice #</th>
                <th scope="col">Order #</th>
                <th scope="col">Patient</th>
                <th scope="col">Partner Centre</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">
                  Effective Total
                </th>
                <th scope="col" className="text-right">
                  Net Collected
                </th>
                <th scope="col" className="text-right">
                  Balance Due
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-[#475569]">
                    No Model A invoices issued yet.
                  </td>
                </tr>
              ) : (
                items.map((inv) => (
                  <tr key={inv.id}>
                    <th scope="row" className="font-mono-code font-medium">
                      <Link
                        href={`/admin/invoices/${inv.id}`}
                        className="text-[#1B365D] hover:underline"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </th>
                    <td className="font-mono-code text-xs">
                      {inv.order.orderNumber}
                    </td>
                    <td>
                      {inv.patientNameSnapshot}{" "}
                      <span className="font-mono-code text-xs text-[#475569]">
                        ({inv.patientCodeSnapshot})
                      </span>
                    </td>
                    <td>{inv.partnerNameSnapshot}</td>
                    <td>
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="text-right tabular-nums">
                      {formatInr(inv.effectiveTotal.toString())}
                    </td>
                    <td className="text-right tabular-nums text-[#166534]">
                      {formatInr(inv.netCollected.toString())}
                    </td>
                    <td className="text-right tabular-nums font-semibold">
                      {formatInr(inv.balanceDue.toString())}
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

