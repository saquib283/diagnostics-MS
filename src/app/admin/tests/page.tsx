import type { Metadata } from "next";
import {
  CreateTestAndCategoryForms,
  TestRowLifecycleActions,
} from "@/components/admin/catalogue-client";
import { Panel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActor } from "@/lib/auth/session";
import { formatInr, money } from "@/lib/money";
import { hasPermission } from "@/lib/permissions/rbac";
import { listTestCategories, listTests } from "@/modules/catalogue/service";
import { listTaxCodes } from "@/modules/organization/service";

export const metadata: Metadata = { title: "Diagnostic Test Catalogue" };

export default async function AdminTestsPage() {
  const actor = await requireActor();
  const canManage = hasPermission(actor, "catalogue:manage");
  const [categories, tests, taxCodes] = await Promise.all([
    listTestCategories(actor),
    listTests(actor, {}),
    listTaxCodes(actor),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1
          id="main-content"
          tabIndex={-1}
          className="text-[22px] font-semibold text-[#0F172A] m-0"
        >
          Diagnostic Test Catalogue
        </h1>
        <p className="text-xs text-[#475569] m-0 mt-0.5">
          Catalogue updates and deactivation apply only to new orders; historical order and invoice snapshots remain immutable.
        </p>
      </div>

      {canManage ? (
        <CreateTestAndCategoryForms
          csrfToken={actor.csrfToken}
          categories={categories}
          taxCodes={taxCodes}
        />
      ) : null}

      <Panel title={`Master Tests (${tests.length})`}>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="tests-table-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="tests-table-caption" className="visually-hidden">
              Diagnostic tests catalogue
            </caption>
            <thead>
              <tr>
                <th scope="col">Test Code</th>
                <th scope="col">Name</th>
                <th scope="col">Category</th>
                <th scope="col">Sample / Modality</th>
                <th scope="col">Tax Code</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">
                  Default Selling Price
                </th>
                {canManage ? (
                  <th scope="col" className="text-right">
                    Catalogue Controls
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {tests.map((test) => (
                <tr key={test.id}>
                  <th scope="row" className="font-mono-code font-medium">
                    {test.code}
                  </th>
                  <td className="font-medium">{test.name}</td>
                  <td>{test.category.name}</td>
                  <td>{test.sampleType ?? "—"}</td>
                  <td className="font-mono-code text-xs">
                    {test.taxCode?.code ?? "EXEMPT"}
                  </td>
                  <td>
                    <StatusBadge
                      status={test.isActive ? "ACTIVE" : "INACTIVE"}
                    />
                  </td>
                  <td className="text-right tabular-nums font-medium">
                    {formatInr(test.defaultSellingPrice.toString())}
                  </td>
                  {canManage ? (
                    <td className="text-right">
                      <TestRowLifecycleActions
                        testId={test.id}
                        currentPrice={money(test.defaultSellingPrice)}
                        isActive={test.isActive}
                        csrfToken={actor.csrfToken}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
