import type { Metadata } from "next";
import {
  PartnerContractAndStatusControls,
  PartnerPricingAndCommissionForms,
} from "@/components/admin/partner-detail-client";
import { Panel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActor } from "@/lib/auth/session";
import { formatInr } from "@/lib/money";
import { hasPermission } from "@/lib/permissions/rbac";
import { listTests } from "@/modules/catalogue/service";
import { getPartnerDetail } from "@/modules/partners/service";

export const metadata: Metadata = { title: "Partner Rates & Contracts" };

export default async function AdminPartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor();
  const { id } = await params;
  const [partner, tests] = await Promise.all([
    getPartnerDetail(actor, id),
    listTests(actor, { activeOnly: true }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1
            id="main-content"
            tabIndex={-1}
            className="text-[22px] font-semibold text-[#0F172A] m-0"
          >
            {partner.displayName}{" "}
            <span className="font-mono-code text-base font-normal text-[#475569]">
              ({partner.partnerCode})
            </span>
          </h1>
          <p className="text-xs text-[#475569] m-0 mt-0.5">
            {partner.legalName} · {partner.city}, {partner.stateName} · GSTIN:{" "}
            {partner.gstin ?? "Not provided"}
          </p>
        </div>
        <StatusBadge status={partner.status} />
      </div>

      {hasPermission(actor, "partners:manage") ? (
        <PartnerContractAndStatusControls
          partnerId={partner.id}
          currentStatus={partner.status}
          csrfToken={actor.csrfToken}
        />
      ) : null}

      {partner.contracts.length > 0 ? (
        <Panel title={`Recorded Commercial Contracts (${partner.contracts.length})`}>
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="partner-contracts-caption"
            className="erp-table-region"
          >
            <table className="erp-table">
              <caption id="partner-contracts-caption" className="visually-hidden">
                Partner commercial contracts
              </caption>
              <thead>
                <tr>
                  <th scope="col">Contract #</th>
                  <th scope="col">Permitted Models</th>
                  <th scope="col">Settlement Cycle</th>
                  <th scope="col">Commission Basis</th>
                  <th scope="col">Effective From</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {partner.contracts.map((c) => (
                  <tr key={c.id}>
                    <th scope="row" className="font-mono-code font-medium">
                      {c.contractNumber}
                    </th>
                    <td className="text-xs">{c.allowedModels}</td>
                    <td className="text-xs">{c.settlementCycle}</td>
                    <td className="text-xs">{c.commissionBasis}</td>
                    <td className="tabular-nums text-xs">
                      {c.effectiveFrom.toISOString().slice(0, 10)}
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {hasPermission(actor, "pricing:manage") ? (
        <PartnerPricingAndCommissionForms
          partnerId={partner.id}
          csrfToken={actor.csrfToken}
          tests={tests.map((t) => ({
            id: t.id,
            code: t.code,
            name: t.name,
            defaultSellingPrice: t.defaultSellingPrice.toString(),
          }))}
        />
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Negotiated Test Prices (Model A — Hidden from Partner Portal)">
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="partner-prices-caption"
            className="erp-table-region"
          >
            <table className="erp-table">
              <caption id="partner-prices-caption" className="visually-hidden">
                Negotiated partner test prices
              </caption>
              <thead>
                <tr>
                  <th scope="col">Test</th>
                  <th scope="col">Effective Window</th>
                  <th scope="col" className="text-right">
                    Sell Price
                  </th>
                  <th scope="col" className="text-right">
                    Agreed Partner Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {partner.testPrices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-[#475569]">
                      No negotiated prices configured yet.
                    </td>
                  </tr>
                ) : (
                  partner.testPrices.map((tp) => (
                    <tr key={tp.id}>
                      <th scope="row">
                        <span className="font-mono-code">{tp.test.code}</span> —{" "}
                        {tp.test.name}
                      </th>
                      <td className="tabular-nums text-xs">
                        {tp.effectiveFrom.toISOString().slice(0, 10)} →{" "}
                        {tp.effectiveTo
                          ? tp.effectiveTo.toISOString().slice(0, 10)
                          : "Open"}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatInr(tp.test.defaultSellingPrice.toString())}
                      </td>
                      <td className="text-right tabular-nums font-semibold">
                        {formatInr(tp.agreedPurchasePrice.toString())}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Commission Rules (Model B — Percentage on Completed Tests)">
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="partner-commissions-caption"
            className="erp-table-region"
          >
            <table className="erp-table">
              <caption id="partner-commissions-caption" className="visually-hidden">
                Partner commission rates
              </caption>
              <thead>
                <tr>
                  <th scope="col">Scope</th>
                  <th scope="col">Basis</th>
                  <th scope="col">Effective Window</th>
                  <th scope="col" className="text-right">
                    Commission %
                  </th>
                </tr>
              </thead>
              <tbody>
                {partner.commissionRates.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-[#475569]">
                      No commission rules configured yet.
                    </td>
                  </tr>
                ) : (
                  partner.commissionRates.map((cr) => (
                    <tr key={cr.id}>
                      <th scope="row">
                        {cr.test
                          ? `${cr.test.code} — ${cr.test.name}`
                          : "Partner Default (All Tests)"}
                      </th>
                      <td className="text-xs">{cr.calculationBasis}</td>
                      <td className="tabular-nums text-xs">
                        {cr.effectiveFrom.toISOString().slice(0, 10)} →{" "}
                        {cr.effectiveTo
                          ? cr.effectiveTo.toISOString().slice(0, 10)
                          : "Open"}
                      </td>
                      <td className="text-right tabular-nums font-semibold">
                        {Number(cr.commissionPercentage.toString()).toFixed(2)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

