import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatus } from "@prisma/client";
import { Panel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActor } from "@/lib/auth/session";
import { listOrdersForPartnerPortal } from "@/modules/orders/service";

export const metadata: Metadata = { title: "Assigned Partner Orders" };

export default async function PartnerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const actor = await requireActor();
  const sp = await searchParams;
  const res = await listOrdersForPartnerPortal(actor, {
    status: (sp.status as OrderStatus | undefined) || undefined,
    page: sp.page ? Number(sp.page) : 1,
    pageSize: 30,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1
          id="main-content"
          tabIndex={-1}
          className="text-[22px] font-semibold text-[#0F172A] m-0"
        >
          Assigned Diagnostic Orders ({res.totalItems})
        </h1>
        <p className="text-xs text-[#475569] m-0 mt-0.5">
          Minimum required patient demographics and clinical instructions for order fulfilment.
        </p>
      </div>

      <Panel title="Centre Orders">
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="partner-orders-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="partner-orders-caption" className="visually-hidden">
              Partner assigned orders
            </caption>
            <thead>
              <tr>
                <th scope="col">Order #</th>
                <th scope="col">Patient</th>
                <th scope="col">Contact</th>
                <th scope="col">Model</th>
                <th scope="col">Tests</th>
                <th scope="col">Status</th>
                <th scope="col">Fulfil</th>
              </tr>
            </thead>
            <tbody>
              {res.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[#475569]">
                    No assigned orders found.
                  </td>
                </tr>
              ) : (
                res.items.map((ord) => (
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
                      {ord.patient.fullName} ({ord.patient.patientCode})
                    </td>
                    <td className="font-mono-code text-xs">
                      {ord.patient.mobileDisplay}
                    </td>
                    <td>
                      <StatusBadge
                        status={ord.paymentModel}
                        label={
                          ord.paymentModel === "MODEL_A_CONSULTANCY_COLLECTS"
                            ? "Consultancy Billed"
                            : "Collect Directly"
                        }
                      />
                    </td>
                    <td className="text-xs">
                      {ord.items
                        .map((i) => `${i.testName} (${i.status})`)
                        .join(", ")}
                    </td>
                    <td>
                      <StatusBadge status={ord.status} />
                    </td>
                    <td>
                      <Link
                        href={`/partner/orders/${ord.id}`}
                        className="text-xs font-medium text-[#1B365D] hover:underline"
                      >
                        Open Order
                      </Link>
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

