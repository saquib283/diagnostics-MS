import { redirect } from "next/navigation";
import { PortalShell } from "@/components/layout/portal-shell";
import { getCurrentActor } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await getCurrentActor();
  if (!actor) {
    redirect("/login");
  }
  if (actor.portalType !== "PARTNER" || actor.partnerIds.length === 0) {
    redirect("/admin/dashboard");
  }

  const partner = await db.partner.findUnique({
    where: { id: actor.partnerIds[0] },
    select: { displayName: true, partnerCode: true },
  });

  return (
    <PortalShell
      portal="PARTNER"
      actorName={actor.fullName}
      actorRoles={actor.roles}
      csrfToken={actor.csrfToken}
      partnerBanner={
        partner
          ? `${partner.displayName} (${partner.partnerCode})`
          : "Partner Diagnostic Centre"
      }
    >
      {children}
    </PortalShell>
  );
}
