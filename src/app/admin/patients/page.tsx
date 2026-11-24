import type { Metadata } from "next";
import Link from "next/link";
import { QuickRegisterPatientForm } from "@/components/admin/patient-registry-client";
import { Button, Input, Panel } from "@/components/ui/primitives";
import { requireActor } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/rbac";
import { listPatients } from "@/modules/patients/service";

export const metadata: Metadata = { title: "Patient Registry" };

export default async function AdminPatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const actor = await requireActor();
  const sp = await searchParams;
  const q = sp.q ?? "";
  const page = sp.page ? Number(sp.page) : 1;

  const { items, totalItems } = await listPatients(actor, {
    q,
    page,
    pageSize: 30,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1
            id="main-content"
            tabIndex={-1}
            className="text-[22px] font-semibold text-[#0F172A] m-0"
          >
            Central Patient Registry
          </h1>
          <p className="text-xs text-[#475569] m-0 mt-0.5">
            Search by patient name, mobile number, or patient code ({totalItems} records).
          </p>
        </div>
      </div>

      {hasPermission(actor, "patients:write") ? (
        <QuickRegisterPatientForm csrfToken={actor.csrfToken} />
      ) : null}

      <Panel title="Patient Directory">
        <search className="mb-3">
          <form method="get" action="/admin/patients" className="flex flex-wrap gap-2">
            <label htmlFor="patient-search-q" className="visually-hidden">
              Search patients by name, mobile, or code
            </label>
            <Input
              id="patient-search-q"
              name="q"
              type="search"
              defaultValue={q}
              spellCheck={false}
              autoCorrect="off"
              placeholder="Search name, +91 mobile, or PAT-2026-..."
              className="max-w-sm"
            />
            <Button type="submit" variant="secondary">
              Search
            </Button>
            {q ? (
              <Link
                href="/admin/patients"
                className="inline-flex h-9 items-center px-2.5 text-xs text-[#475569] hover:underline"
              >
                Clear
              </Link>
            ) : null}
          </form>
        </search>

        <div
          tabIndex={0}
          role="region"
          aria-labelledby="patients-table-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="patients-table-caption" className="visually-hidden">
              Registered patients
            </caption>
            <thead>
              <tr>
                <th scope="col">Patient Code</th>
                <th scope="col">Full Name</th>
                <th scope="col">Mobile</th>
                <th scope="col">Age / Gender</th>
                <th scope="col">City</th>
                <th scope="col" className="text-right">
                  Orders
                </th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[#475569]">
                    No patients matched your search. Register a new patient above.
                  </td>
                </tr>
              ) : (
                items.map((pat) => (
                  <tr key={pat.id}>
                    <th scope="row" className="font-mono-code font-medium">
                      <Link
                        href={`/admin/patients/${pat.id}`}
                        className="text-[#1B365D] hover:underline"
                      >
                        {pat.patientCode}
                      </Link>
                    </th>
                    <td className="font-medium">{pat.fullName}</td>
                    <td className="font-mono-code">{pat.mobile}</td>
                    <td>
                      {pat.ageYearsSnapshot !== null
                        ? `${pat.ageYearsSnapshot}Y · `
                        : ""}
                      {pat.gender}
                    </td>
                    <td>{pat.city ?? "—"}</td>
                    <td className="text-right tabular-nums">
                      {pat._count.orders}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/patients/${pat.id}`}
                          className="text-xs font-medium text-[#1B365D] hover:underline"
                        >
                          History
                        </Link>
                        <Link
                          href={`/admin/orders/new?patientId=${pat.id}`}
                          className="text-xs font-medium text-[#166534] hover:underline"
                        >
                          + Order
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

