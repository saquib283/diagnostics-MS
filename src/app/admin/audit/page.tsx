import type { Metadata } from "next";
import { Panel } from "@/components/ui/primitives";
import { requireActor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions/rbac";

export const metadata: Metadata = { title: "Audit Trail" };

export default async function AdminAuditPage() {
  const actor = await requireActor();
  requirePermission(actor, "audit:read");

  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      actor: { select: { fullName: true, email: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1
          id="main-content"
          tabIndex={-1}
          className="text-[22px] font-semibold text-[#0F172A] m-0"
        >
          Append-Only Security & Financial Audit Trail
        </h1>
        <p className="text-xs text-[#475569] m-0 mt-0.5">
          All sensitive reads, status transitions, financial mutations, and security events are logged with automatic secret redaction.
        </p>
      </div>

      <Panel title={`Recent Audit Events (${logs.length})`}>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="audit-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="audit-caption" className="visually-hidden">
              Security and financial audit logs
            </caption>
            <thead>
              <tr>
                <th scope="col">Timestamp (UTC)</th>
                <th scope="col">Action</th>
                <th scope="col">Actor</th>
                <th scope="col">Entity</th>
                <th scope="col">Redacted Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="tabular-nums text-xs">
                    {log.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                  </td>
                  <th scope="row" className="font-mono-code text-xs">
                    {log.action}
                  </th>
                  <td className="text-xs">
                    {log.actor ? `${log.actor.fullName} (${log.actorRoleSnapshot ?? ""})` : "System / Webhook"}
                  </td>
                  <td className="font-mono-code text-xs">
                    {log.entityType}:{log.entityId.slice(0, 12)}
                  </td>
                  <td className="font-mono-code text-[11px] text-[#475569] max-w-md truncate">
                    {JSON.stringify(log.afterJson ?? log.metadataJson ?? {})}
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

