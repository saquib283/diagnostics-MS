import type { Metadata } from "next";
import Link from "next/link";
import { OrderItemRowControls } from "@/components/admin/order-detail-client";
import { Panel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActor } from "@/lib/auth/session";
import { listAllReportItems } from "@/modules/reports/service";

export const metadata: Metadata = { title: "Diagnostic Reports" };

export default async function AdminReportsPage() {
  const actor = await requireActor();
  const items = await listAllReportItems(actor);

  return (
    <div className="space-y-5">
      <div>
        <h1
          id="main-content"
          tabIndex={-1}
          className="text-[22px] font-semibold text-[#0F172A] m-0"
        >
          Diagnostic Report Tracking & Private Delivery
        </h1>
        <p className="text-xs text-[#475569] m-0 mt-0.5">
          Reports are linked to individual order items, stored privately, validated by binary magic bytes, and audited on every download.
        </p>
      </div>

      <Panel title={`Test Fulfilment & Report Queue (${items.length})`}>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="reports-queue-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="reports-queue-caption" className="visually-hidden">
              Diagnostic report queue
            </caption>
            <thead>
              <tr>
                <th scope="col">Order #</th>
                <th scope="col">Patient</th>
                <th scope="col">Partner Centre</th>
                <th scope="col">Test</th>
                <th scope="col">Test Status</th>
                <th scope="col">Report File</th>
                <th scope="col">Upload / Update</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[#475569]">
                    No active diagnostic test items.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <th scope="row" className="font-mono-code">
                      <Link
                        href={`/admin/orders/${item.order.id}`}
                        className="text-[#1B365D] hover:underline"
                      >
                        {item.order.orderNumber}
                      </Link>
                    </th>
                    <td>
                      {item.order.patient.fullName} ({item.order.patient.patientCode})
                    </td>
                    <td>{item.order.partner.displayName}</td>
                    <td>
                      <span className="font-mono-code">{item.testCodeSnapshot}</span> —{" "}
                      {item.testNameSnapshot}
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
                          v{item.reportFiles[0].versionNumber} ({item.reportFiles[0].originalFilename})
                        </a>
                      ) : (
                        <StatusBadge
                          status={item.reportTracking?.status ?? "AWAITING"}
                        />
                      )}
                    </td>
                    <td>
                      <OrderItemRowControls
                        orderId={item.order.id}
                        itemId={item.id}
                        currentStatus={item.status}
                        csrfToken={actor.csrfToken}
                      />
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

