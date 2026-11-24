import { redirect } from "next/navigation";
import { PortalShell } from "@/components/layout/portal-shell";
import { getCurrentActor } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await getCurrentActor();
  if (!actor) {
    redirect("/login");
  }
  if (actor.portalType === "PARTNER") {
    redirect("/partner/dashboard");
  }

  return (
    <PortalShell
      portal="CONSULTANCY"
      actorName={actor.fullName}
      actorRoles={actor.roles}
      csrfToken={actor.csrfToken}
    >
      {children}
    </PortalShell>
  );
}
