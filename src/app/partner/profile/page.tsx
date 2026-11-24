import type { Metadata } from "next";
import { Panel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { requirePartnerScope } from "@/lib/permissions/scope";

export const metadata: Metadata = { title: "Centre Profile" };

export default async function PartnerProfilePage() {
  const actor = await requireActor();
  const scope = requirePartnerScope(actor);

  const partner = await db.partner.findUnique({
    where: { id: scope.partnerIds[0] },
    select: {
      partnerCode: true,
      legalName: true,
      displayName: true,
      contactPerson: true,
      phone: true,
      email: true,
      addressLine: true,
      city: true,
      stateName: true,
      pincode: true,
      gstin: true,
      status: true,
    },
  });

  if (!partner) {
    return null;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1
          id="main-content"
          tabIndex={-1}
          className="text-[22px] font-semibold text-[#0F172A] m-0"
        >
          Diagnostic Centre Profile
        </h1>
      </div>

      <Panel title={`${partner.displayName} (${partner.partnerCode})`}>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm m-0">
          <div>
            <dt className="text-xs text-[#475569]">Legal Name</dt>
            <dd className="font-medium m-0 mt-0.5">{partner.legalName}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#475569]">Status</dt>
            <dd className="m-0 mt-0.5">
              <StatusBadge status={partner.status} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#475569]">Primary Contact</dt>
            <dd className="m-0 mt-0.5">
              {partner.contactPerson} ({partner.phone})
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#475569]">GSTIN</dt>
            <dd className="font-mono-code m-0 mt-0.5">
              {partner.gstin ?? "Not registered"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-[#475569]">Address</dt>
            <dd className="m-0 mt-0.5">
              {partner.addressLine}, {partner.city}, {partner.stateName} -{" "}
              {partner.pincode}
            </dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}

