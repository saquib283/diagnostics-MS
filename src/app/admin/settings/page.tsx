import type { Metadata } from "next";
import { OrganizationSettingsClientForm } from "@/components/admin/settings-client";
import { requireActor } from "@/lib/auth/session";
import { getOrganizationWithSettings } from "@/modules/organization/service";

export const metadata: Metadata = { title: "Organization & Policy Settings" };

export default async function AdminSettingsPage() {
  const actor = await requireActor();
  const org = await getOrganizationWithSettings(actor);

  return (
    <div className="space-y-5">
      <div>
        <h1
          id="main-content"
          tabIndex={-1}
          className="text-[22px] font-semibold text-[#0F172A] m-0"
        >
          Organization Profile & Open Business Decision Policies
        </h1>
        <p className="text-xs text-[#475569] m-0 mt-0.5">
          Configure CA-confirmed GST treatment, commission calculation basis, completion approval gates, and partner privacy rules.
        </p>
      </div>

      <OrganizationSettingsClientForm
        initial={{
          ...org,
          settings: org.settings!,
        }}
        csrfToken={actor.csrfToken}
      />
    </div>
  );
}

