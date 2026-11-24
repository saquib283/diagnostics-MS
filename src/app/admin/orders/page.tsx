import type { Metadata } from "next";
import Link from "next/link";
import { CommercialModel, OrderStatus } from "@prisma/client";
import { Button, Panel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActor } from "@/lib/auth/session";
import { formatInr } from "@/lib/money";
import { listOrders } from "@/modules/orders/service";

export const metadata: Metadata = { title: "Diagnostic Orders" };

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; paymentModel?: string; page?: string }>;
}) {
  const actor = await requireActor();
  const sp = await searchParams;
  const { items, totalItems } = await listOrders(actor, {
    status: (sp.status as OrderStatus | undefined) || undefined,
    paymentModel: (sp.paymentModel as CommercialModel | undefined) || undefined,
    page: sp.page ? Number(sp.page) : 1,
    pageSize: 30,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1
            id="main-content"
            tabIndex={-1}
            className="text-[22px] font-semibold text-[#0F172A] m-0"
          >
            Diagnostic Orders ({totalItems})
          </h1>
          <p className="text-xs text-[#475569] m-0 mt-0.5">
            One diagnostic order per manually selected partner centre, supporting multiple tests per order.
          </p>
        </div>

        <Link
          href="/admin/orders/new"
          className="inline-flex h-9 items-center rounded-[4px] bg-[#1B365D] px-3.5 text-sm font-medium text-white no-underline hover:bg-[#122644]"
        >
          Create Partner Order
        </Link>
      </div>

      <Panel title="Order Register">
        <search className="mb-3">
          <form method="get" action="/admin/orders" className="flex flex-wrap items-center gap-2">
            <label htmlFor="ord-filter-status" className="text-xs font-medium text-[#334155]">
              Status:
            </label>
            <select
              id="ord-filter-status"
              name="status"
              defaultValue={sp.status ?? ""}
              className="h-8 rounded-[4px] border border-[#64748B] bg-white px-2 text-xs"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="PARTIALLY_COMPLETED">PARTIALLY_COMPLETED</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>

            <label htmlFor="ord-filter-model" className="text-xs font-medium text-[#334155] ml-2">
              Model:
            </label>
            <select
              id="ord-filter-model"
              name="paymentModel"
              defaultValue={sp.paymentModel ?? ""}
              className="h-8 rounded-[4px] border border-[#64748B] bg-white px-2 text-xs"
            >
              <option value="">All Models</option>
              <option value="MODEL_A_CONSULTANCY_COLLECTS">Model A (Consultancy Collects)</option>
              <option value="MODEL_B_PATIENT_PAYS_PARTNER">Model B (Patient Pays Partner)</option>
            </select>

            <Button type="submit" variant="secondary" size="sm">
              Apply Filters
            </Button>
          </form>
        </search>

        <div
          tabIndex={0}
          role="region"
          aria-labelledby="orders-table-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="orders-table-caption" className="visually-hidden">
              Diagnostic orders register
            </caption>
            <thead>
              <tr>
                <th scope="col">Order #</th>
                <th scope="col">Patient</th>
                <th scope="col">Partner Centre</th>
                <th scope="col">Model</th>
                <th scope="col">Tests</th>
                <th scope="col">Status</th>
                <th scope="col">Billing</th>
                <th scope="col" className="text-right">
                  Order Total
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-[#475569]">
                    No orders match the current filter.
                  </td>
                </tr>
              ) : (
                items.map((ord) => (
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
                    <td className="text-xs">
                      {ord.items.map((i) => i.testNameSnapshot).join(", ")}
                    </td>
                    <td>
                      <StatusBadge status={ord.status} />
                    </td>
                    <td>
                      {ord.invoice ? (
                        <Link href={`/admin/invoices/${ord.invoice.id}`}>
                          <StatusBadge status={ord.invoice.status} />
                        </Link>
                      ) : ord.partnerInvoiceReference ? (
                        <span className="font-mono-code text-xs text-[#166534]">
                          Ref: {ord.partnerInvoiceReference.partnerInvoiceNumber}
                        </span>
                      ) : (
                        <span className="text-xs text-[#92400E]">Action Needed</span>
                      )}
                    </td>
                    <td className="text-right tabular-nums font-medium">
                      {formatInr(ord.netSellingTotal.toString())}
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

