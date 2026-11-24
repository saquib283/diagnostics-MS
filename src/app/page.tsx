import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const actor = await getCurrentActor();
  if (!actor) {
    redirect("/login");
  }
  if (actor.portalType === "PARTNER") {
    redirect("/partner/dashboard");
  }
  redirect("/admin/dashboard");
}
