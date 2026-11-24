import type { Metadata } from "next";
import { PartnerStaffFormClient } from "@/components/partner/partner-users-client";
import { Panel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActor } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/rbac";
import { listOwnPartnerUsers } from "@/modules/users/service";

export const metadata: Metadata = { title: "Centre Staff Users" };

export default async function PartnerUsersPage() {
  const actor = await requireActor();
  if (!hasPermission(actor, "partner:users:manage")) {
    return (
      <Panel title="Restricted">
        <p className="text-xs text-[#991B1B] m-0">
          Only Partner Administrators can manage staff accounts for this diagnostic centre.
        </p>
      </Panel>
    );
  }

  const members = await listOwnPartnerUsers(actor);

  return (
    <div className="space-y-5">
      <div>
        <h1
          id="main-content"
          tabIndex={-1}
          className="text-[22px] font-semibold text-[#0F172A] m-0"
        >
          Centre Staff & Access Control
        </h1>
        <p className="text-xs text-[#475569] m-0 mt-0.5">
          All staff provisioned here are strictly scoped to your diagnostic centre.
        </p>
      </div>

      <PartnerStaffFormClient csrfToken={actor.csrfToken} />

      <Panel title={`Assigned Staff (${members.length})`}>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="prt-users-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="prt-users-caption" className="visually-hidden">
              Partner centre staff accounts
            </caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Centre Role</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <th scope="row" className="font-medium">
                    {m.user.fullName}
                  </th>
                  <td className="font-mono-code text-xs">{m.user.email}</td>
                  <td className="text-xs">{m.partnerRole}</td>
                  <td>
                    <StatusBadge
                      status={m.user.isActive && m.isActive ? "ACTIVE" : "INACTIVE"}
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

