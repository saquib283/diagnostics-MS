import type { Metadata } from "next";
import Link from "next/link";
import { CreatePartnerForm } from "@/components/admin/partners-client";
import { Panel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActor } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/rbac";
import { listPartners } from "@/modules/partners/service";

export const metadata: Metadata = { title: "Partner Diagnostic Centres" };

export default async function AdminPartnersPage() {
  const actor = await requireActor();
  const partners = await listPartners(actor);

  return (
    <div className="space-y-5">
      <div>
        <h1
          id="main-content"
          tabIndex={-1}
          className="text-[22px] font-semibold text-[#0F172A] m-0"
        >
          Partner Diagnostic Centres
        </h1>
        <p className="text-xs text-[#475569] m-0 mt-0.5">
          Manage partner profiles, commercial contracts, negotiated Model A purchase prices, and Model B commission rules.
        </p>
      </div>

      {hasPermission(actor, "partners:manage") ? (
        <CreatePartnerForm csrfToken={actor.csrfToken} />
      ) : null}

      <Panel title={`Partner Network (${partners.length})`}>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="partners-table-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="partners-table-caption" className="visually-hidden">
              Partner diagnostic centres
            </caption>
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Diagnostic Centre</th>
                <th scope="col">Default Model</th>
                <th scope="col">City / State</th>
                <th scope="col">Contact</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">
                  Orders
                </th>
                <th scope="col">Manage</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <tr key={p.id}>
                  <th scope="row" className="font-mono-code font-medium">
                    {p.partnerCode}
                  </th>
                  <td className="font-medium">{p.displayName}</td>
                  <td>
                    <StatusBadge
                      status={p.defaultPaymentModel}
                      label={
                        p.defaultPaymentModel === "MODEL_A_CONSULTANCY_COLLECTS"
                          ? "Model A (Collect)"
                          : "Model B (Commission)"
                      }
                    />
                  </td>
                  <td>
                    {p.city}, {p.stateName}
                  </td>
                  <td>
                    {p.contactPerson} ({p.phone})
                  </td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="text-right tabular-nums">{p._count.orders}</td>
                  <td>
                    <Link
                      href={`/admin/partners/${p.id}`}
                      className="text-xs font-medium text-[#1B365D] hover:underline"
                    >
                      Rates & Contracts
                    </Link>
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

