import type { Metadata } from "next";
import {
  CreateUserClientForm,
  UserRowStatusToggle,
} from "@/components/admin/users-client";
import { Panel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActor } from "@/lib/auth/session";
import { listPartners } from "@/modules/partners/service";
import { listUsers } from "@/modules/users/service";

export const metadata: Metadata = { title: "Users & RBAC" };

export default async function AdminUsersPage() {
  const actor = await requireActor();
  const [users, partners] = await Promise.all([
    listUsers(actor),
    listPartners(actor),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1
          id="main-content"
          tabIndex={-1}
          className="text-[22px] font-semibold text-[#0F172A] m-0"
        >
          Users, Roles & Partner Scoping
        </h1>
        <p className="text-xs text-[#475569] m-0 mt-0.5">
          Deactivating a user or changing roles immediately revokes all active server sessions.
        </p>
      </div>

      <CreateUserClientForm
        csrfToken={actor.csrfToken}
        partners={partners.map((p) => ({
          id: p.id,
          displayName: p.displayName,
          partnerCode: p.partnerCode,
        }))}
      />

      <Panel title={`System Accounts (${users.length})`}>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="users-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="users-caption" className="visually-hidden">
              User accounts and assigned roles
            </caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Portal</th>
                <th scope="col">Roles</th>
                <th scope="col">Partner Scope</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">
                  Session & Access Control
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <th scope="row" className="font-medium">
                    {u.fullName}
                  </th>
                  <td className="font-mono-code text-xs">{u.email}</td>
                  <td>{u.portalType}</td>
                  <td className="text-xs">
                    {u.userRoles.map((ur) => ur.role.code).join(", ")}
                  </td>
                  <td className="text-xs">
                    {u.partnerMemberships.length > 0
                      ? u.partnerMemberships
                          .map((pm) => pm.partner.displayName)
                          .join(", ")
                      : "Consultancy Global"}
                  </td>
                  <td>
                    <StatusBadge status={u.isActive ? "ACTIVE" : "INACTIVE"} />
                  </td>
                  <td className="text-right">
                    <UserRowStatusToggle
                      userId={u.id}
                      currentUserId={actor.userId}
                      isActive={u.isActive}
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

