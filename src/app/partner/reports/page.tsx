import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActor } from "@/lib/auth/session";
import { listOrdersForPartnerPortal } from "@/modules/orders/service";

export const metadata: Metadata = { title: "Partner Report Uploads" };

export default async function PartnerReportsPage() {
  const actor = await requireActor();
  const res = await listOrdersForPartnerPortal(actor, { pageSize: 40 });
  const flatItems = res.items.flatMap((ord) =>
    ord.items.map((item) => ({
      orderId: ord.id,
      orderNumber: ord.orderNumber,
      patientName: ord.patient.fullName,
      ...item,
    })),
  );

  return (
    <div className="space-y-5">
      <div>
        <h1
          id="main-content"
          tabIndex={-1}
          className="text-[22px] font-semibold text-[#0F172A] m-0"
        >
          Report Upload Queue ({flatItems.length})
        </h1>
        <p className="text-xs text-[#475569] m-0 mt-0.5">
          Upload diagnostic PDFs or images per test item for your centre&apos;s orders.
        </p>
      </div>

      <Panel title="Centre Test Items">
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="prt-reports-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="prt-reports-caption" className="visually-hidden">
              Partner report upload queue
            </caption>
            <thead>
              <tr>
                <th scope="col">Order #</th>
                <th scope="col">Patient</th>
                <th scope="col">Test</th>
                <th scope="col">Test Status</th>
                <th scope="col">Report Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {flatItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#475569]">
                    No assigned test items.
                  </td>
                </tr>
              ) : (
                flatItems.map((row) => (
                  <tr key={row.id}>
                    <th scope="row" className="font-mono-code">
                      {row.orderNumber}
                    </th>
                    <td>{row.patientName}</td>
                    <td>
                      <span className="font-mono-code">{row.testCode}</span> —{" "}
                      {row.testName}
                    </td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>
                      <StatusBadge status={row.reportStatus} />
                    </td>
                    <td>
                      <Link
                        href={`/partner/orders/${row.orderId}`}
                        className="text-xs font-medium text-[#1B365D] hover:underline"
                      >
                        Manage Report
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

