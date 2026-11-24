import type { Metadata } from "next";
import Link from "next/link";
import { EditPatientProfileForm } from "@/components/admin/patient-registry-client";
import { Panel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActor } from "@/lib/auth/session";
import { formatInr } from "@/lib/money";
import { hasPermission } from "@/lib/permissions/rbac";
import { getPatientWithHistory } from "@/modules/patients/service";

export const metadata: Metadata = { title: "Patient History" };

export default async function AdminPatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor();
  const { id } = await params;
  const patient = await getPatientWithHistory(actor, id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1
            id="main-content"
            tabIndex={-1}
            className="text-[22px] font-semibold text-[#0F172A] m-0"
          >
            {patient.fullName}{" "}
            <span className="font-mono-code text-base font-normal text-[#475569]">
              ({patient.patientCode})
            </span>
          </h1>
          <p className="text-xs text-[#475569] m-0 mt-0.5">
            Mobile: <span className="font-mono-code">{patient.mobile}</span> · Gender:{" "}
            {patient.gender} · Age: {patient.ageYearsSnapshot ?? "—"} · City:{" "}
            {patient.city ?? "—"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasPermission(actor, "patients:write") ? (
            <EditPatientProfileForm
              patient={patient}
              csrfToken={actor.csrfToken}
            />
          ) : null}
          <Link
            href={`/admin/orders/new?patientId=${patient.id}`}
            className="inline-flex h-9 items-center rounded-[4px] bg-[#1B365D] px-3.5 text-sm font-medium text-white no-underline hover:bg-[#122644]"
          >
            Create Partner Order for Patient
          </Link>
        </div>
      </div>

      <Panel title={`Diagnostic Orders Across Partner Centres (${patient.orders.length})`}>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="patient-orders-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="patient-orders-caption" className="visually-hidden">
              Patient diagnostic orders and billing history
            </caption>
            <thead>
              <tr>
                <th scope="col">Order #</th>
                <th scope="col">Partner Centre</th>
                <th scope="col">Commercial Model</th>
                <th scope="col">Tests & Reports</th>
                <th scope="col">Order Status</th>
                <th scope="col">Invoice / Ref</th>
                <th scope="col" className="text-right">
                  Order Value
                </th>
              </tr>
            </thead>
            <tbody>
              {patient.orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[#475569]">
                    No orders created for this patient yet.
                  </td>
                </tr>
              ) : (
                patient.orders.map((ord) => (
                  <tr key={ord.id}>
                    <th scope="row" className="font-mono-code">
                      <Link
                        href={`/admin/orders/${ord.id}`}
                        className="text-[#1B365D] hover:underline"
                      >
                        {ord.orderNumber}
                      </Link>
                    </th>
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
                    <td>
                      <div className="space-y-0.5 text-xs">
                        {ord.items.map((item) => (
                          <div key={item.id}>
                            {item.testNameSnapshot} —{" "}
                            <span className="font-medium">{item.status}</span>
                            {item.reportFiles[0] ? (
                              <>
                                {" "}
                                ·{" "}
                                <a
                                  href={`/api/v1/reports/${item.reportFiles[0].id}/download`}
                                  className="text-[#1B365D] underline"
                                >
                                  Report PDF
                                </a>
                              </>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={ord.status} />
                    </td>
                    <td>
                      {ord.invoice ? (
                        <Link
                          href={`/admin/invoices/${ord.invoice.id}`}
                          className="font-mono-code text-xs text-[#1B365D] hover:underline"
                        >
                          {ord.invoice.invoiceNumber} ({ord.invoice.status})
                        </Link>
                      ) : ord.partnerInvoiceReference ? (
                        <span className="font-mono-code text-xs text-[#334155]">
                          Partner Inv: {ord.partnerInvoiceReference.partnerInvoiceNumber}
                        </span>
                      ) : (
                        <span className="text-xs text-[#475569]">Pending</span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">
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

