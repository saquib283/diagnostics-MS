import type { Metadata } from "next";
import {
  CreatePackageComposer,
  PackageRowLifecycleActions,
} from "@/components/admin/packages-client";
import { Panel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActor } from "@/lib/auth/session";
import { formatInr, money } from "@/lib/money";
import { hasPermission } from "@/lib/permissions/rbac";
import { listPackages, listTests } from "@/modules/catalogue/service";

export const metadata: Metadata = { title: "Test Packages" };

export default async function AdminPackagesPage() {
  const actor = await requireActor();
  const canManage = hasPermission(actor, "catalogue:manage");
  const [packages, tests] = await Promise.all([
    listPackages(actor),
    listTests(actor, { activeOnly: true }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1
          id="main-content"
          tabIndex={-1}
          className="text-[22px] font-semibold text-[#0F172A] m-0"
        >
          Diagnostic Test Packages
        </h1>
        <p className="text-xs text-[#475569] m-0 mt-0.5">
          Packages expand into individual order items on order creation so each test is fulfilled and settled independently.
        </p>
      </div>

      {canManage ? (
        <CreatePackageComposer
          csrfToken={actor.csrfToken}
          tests={tests.map((t) => ({
            id: t.id,
            code: t.code,
            name: t.name,
            defaultSellingPrice: money(t.defaultSellingPrice),
          }))}
        />
      ) : null}

      <Panel title={`Configured Packages (${packages.length})`}>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="packages-table-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="packages-table-caption" className="visually-hidden">
              Diagnostic test packages
            </caption>
            <thead>
              <tr>
                <th scope="col">Package Code</th>
                <th scope="col">Name</th>
                <th scope="col">Constituent Tests & Weights</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">
                  Selling Price
                </th>
                {canManage ? (
                  <th scope="col" className="text-right">
                    Package Controls
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id}>
                  <th scope="row" className="font-mono-code font-medium">
                    {pkg.code}
                  </th>
                  <td className="font-medium">{pkg.name}</td>
                  <td className="text-xs">
                    {pkg.items
                      .map(
                        (i) =>
                          `${i.test.code} (${i.test.name} ×${i.quantity})`,
                      )
                      .join(", ")}
                  </td>
                  <td>
                    <StatusBadge
                      status={pkg.isActive ? "ACTIVE" : "INACTIVE"}
                    />
                  </td>
                  <td className="text-right tabular-nums font-medium">
                    {formatInr(pkg.defaultSellingPrice.toString())}
                  </td>
                  {canManage ? (
                    <td className="text-right">
                      <PackageRowLifecycleActions
                        packageId={pkg.id}
                        currentPrice={money(pkg.defaultSellingPrice)}
                        isActive={pkg.isActive}
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
