import type { Metadata } from "next";
import { OrderItemRowControls } from "@/components/admin/order-detail-client";
import { Panel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActor } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/rbac";
import { getPartnerPortalOrderDetail } from "@/modules/orders/service";

export const metadata: Metadata = { title: "Partner Order Fulfilment" };

export default async function PartnerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor();
  const { id } = await params;
  const order = await getPartnerPortalOrderDetail(actor, id);
  const canUpload = hasPermission(actor, "partner:reports:upload");

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
              {order.orderNumber}
            </h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-xs text-[#475569] m-0 mt-1">
            Patient: <strong>{order.patient.fullName}</strong> (
            {order.patient.patientCode}) · {order.patient.gender} · Contact:{" "}
            <span className="font-mono-code">{order.patient.mobileDisplay}</span>
          </p>
        </div>
      </div>

      {order.clinicalNotes || order.referringDoctor ? (
        <Panel title="Clinical & Preparation Details">
          <p className="text-xs text-[#334155] m-0">
            <strong>Referring Doctor:</strong> {order.referringDoctor ?? "—"} ·{" "}
            <strong>Clinical Notes:</strong> {order.clinicalNotes ?? "None"}
          </p>
        </Panel>
      ) : null}

      <Panel title="Assigned Diagnostic Tests & Report Upload">
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="prt-order-items-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="prt-order-items-caption" className="visually-hidden">
              Assigned test items for partner fulfilment
            </caption>
            <thead>
              <tr>
                <th scope="col">Test Code & Name</th>
                <th scope="col" className="text-right">
                  Qty
                </th>
                <th scope="col">Test Status</th>
                <th scope="col">Report Status</th>
                <th scope="col">Update Progress / Upload PDF</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <th scope="row">
                    <span className="font-mono-code font-medium">
                      {item.testCode}
                    </span>{" "}
                    — {item.testName}
                  </th>
                  <td className="text-right tabular-nums">{item.quantity}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>
                    {item.latestReportFile ? (
                      <a
                        href={`/api/v1/reports/${item.latestReportFile.id}/download`}
                        className="text-xs font-medium text-[#1B365D] underline"
                      >
                        v{item.latestReportFile.versionNumber} (
                        {item.latestReportFile.originalFilename})
                      </a>
                    ) : (
                      <StatusBadge status={item.reportStatus} />
                    )}
                  </td>
                  <td>
                    <OrderItemRowControls
                      orderId={order.id}
                      itemId={item.id}
                      currentStatus={item.status}
                      apiPrefix="/api/v1/partner/orders"
                      canUploadReport={canUpload}
                      csrfToken={actor.csrfToken}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

