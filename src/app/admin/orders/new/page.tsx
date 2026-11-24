import type { Metadata } from "next";
import { OrderBuilderForm } from "@/components/admin/order-builder-client";
import { requireActor } from "@/lib/auth/session";
import { listPackages, listTests } from "@/modules/catalogue/service";
import { listPartners } from "@/modules/partners/service";
import { listPatients } from "@/modules/patients/service";

export const metadata: Metadata = { title: "Create Diagnostic Order" };

export default async function AdminNewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  const actor = await requireActor();
  const sp = await searchParams;

  const [patientsRes, partners, tests, packages] = await Promise.all([
    listPatients(actor, { pageSize: 100 }),
    listPartners(actor, { activeOnly: true }),
    listTests(actor, { activeOnly: true }),
    listPackages(actor, { activeOnly: true }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1
          id="main-content"
          tabIndex={-1}
          className="text-[22px] font-semibold text-[#0F172A] m-0"
        >
          Create Partner Diagnostic Order
        </h1>
        <p className="text-xs text-[#475569] m-0 mt-0.5">
          Catalogue prices, negotiated partner purchase prices, discounts, and commission terms are frozen onto each item at creation.
        </p>
      </div>

      <OrderBuilderForm
        csrfToken={actor.csrfToken}
        preselectedPatientId={sp.patientId}
        patients={patientsRes.items.map((p) => ({
          id: p.id,
          patientCode: p.patientCode,
          fullName: p.fullName,
          mobile: p.mobile,
        }))}
        partners={partners.map((p) => ({
          id: p.id,
          partnerCode: p.partnerCode,
          displayName: p.displayName,
          defaultPaymentModel: p.defaultPaymentModel,
        }))}
        tests={tests.map((t) => ({
          id: t.id,
          code: t.code,
          name: t.name,
          defaultSellingPrice: t.defaultSellingPrice.toString(),
        }))}
        packages={packages.map((pkg) => ({
          id: pkg.id,
          code: pkg.code,
          name: pkg.name,
          defaultSellingPrice: pkg.defaultSellingPrice.toString(),
        }))}
      />
    </div>
  );
}

