import type { Metadata } from "next";
import Link from "next/link";
import { ReconciliationWorkbenchClient } from "@/components/payments/reconciliation-workbench-client";
import { Panel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActor } from "@/lib/auth/session";
import { formatInr } from "@/lib/money";
import { hasPermission } from "@/lib/permissions/rbac";
import { listPayments } from "@/modules/payments/service";
import { listReconciliationOverview } from "@/modules/razorpay/service";

export const metadata: Metadata = { title: "Payments & Gateway Ledger" };

export default async function AdminPaymentsPage() {
  const actor = await requireActor();
  const canReconcile = hasPermission(actor, "payments:reconcile");
  const [{ items, totalItems }, reconciliation] = await Promise.all([
    listPayments(actor, { pageSize: 50 }),
    canReconcile ? listReconciliationOverview(actor) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1
            id="main-content"
            tabIndex={-1}
            className="text-[22px] font-semibold text-[#0F172A] m-0"
          >
            Patient Payments & Gateway Transactions ({totalItems})
          </h1>
          <p className="text-xs text-[#475569] m-0 mt-0.5">
            Every cash, UPI QR, card, and netbanking transaction is stored individually with receipt traceability.
          </p>
        </div>
        <Link
          href="/admin/refunds"
          className="inline-flex h-9 items-center rounded-[4px] border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#0F172A] no-underline hover:bg-[#F8FAFC]"
        >
          View Refunds Register
        </Link>
      </div>

      {canReconcile && reconciliation ? (
        <ReconciliationWorkbenchClient
          staticQrFallbackEnabled={reconciliation.staticQrFallbackEnabled}
          openInvoices={reconciliation.openInvoices}
          csrfToken={actor.csrfToken}
        />
      ) : null}

      <Panel title="Transaction Ledger">
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="payments-reg-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="payments-reg-caption" className="visually-hidden">
              All patient payment transactions
            </caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Receipt #</th>
                <th scope="col">Invoice #</th>
                <th scope="col">Patient</th>
                <th scope="col">Method</th>
                <th scope="col">Status</th>
                <th scope="col">Gateway Settlement</th>
                <th scope="col" className="text-right">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-[#475569]">
                    No payment transactions recorded yet.
                  </td>
                </tr>
              ) : (
                items.map((p) => (
                  <tr key={p.id}>
                    <td className="tabular-nums text-xs">
                      {p.paymentDate.toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                    <th scope="row" className="font-mono-code">
                      {p.receipt ? (
                        <a
                          href={`/api/v1/receipts/${p.receipt.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#1B365D] underline"
                        >
                          {p.receipt.receiptNumber}
                        </a>
                      ) : (
                        "—"
                      )}
                    </th>
                    <td className="font-mono-code">
                      <Link
                        href={`/admin/invoices/${p.invoice.id}`}
                        className="text-[#1B365D] hover:underline"
                      >
                        {p.invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td>{p.invoice.patientNameSnapshot}</td>
                    <td>{p.paymentMethod}</td>
                    <td>
                      <StatusBadge status={p.paymentStatus} />
                    </td>
                    <td>
                      {p.gatewayTransaction ? (
                        <StatusBadge
                          status={p.gatewayTransaction.settlementStatus}
                        />
                      ) : (
                        <span className="text-xs text-[#475569]">Direct Counter</span>
                      )}
                    </td>
                    <td className="text-right tabular-nums font-medium">
                      {formatInr(p.amount.toString())}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {canReconcile && reconciliation ? (
        <Panel
          title={`Razorpay Settlement Batches vs Bank Credit (${reconciliation.gatewaySettlements.length})`}
        >
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="gw-batches-caption"
            className="erp-table-region"
          >
            <table className="erp-table">
              <caption id="gw-batches-caption" className="visually-hidden">
                Razorpay settlement batches and bank reconciliation status
              </caption>
              <thead>
                <tr>
                  <th scope="col">Settled At</th>
                  <th scope="col">Gateway Settlement ID</th>
                  <th scope="col">Bank UTR #</th>
                  <th scope="col" className="text-right">
                    Gross
                  </th>
                  <th scope="col" className="text-right">
                    GW Fee + GST
                  </th>
                  <th scope="col" className="text-right">
                    Net Bank Credit
                  </th>
                  <th scope="col">Bank Reconciliation</th>
                </tr>
              </thead>
              <tbody>
                {reconciliation.gatewaySettlements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-5 text-center text-[#475569]">
                      No Razorpay settlement batches recorded yet.
                    </td>
                  </tr>
                ) : (
                  reconciliation.gatewaySettlements.map((batch) => (
                    <tr key={batch.id}>
                      <td className="tabular-nums text-xs">
                        {batch.settledAt
                          .toISOString()
                          .slice(0, 16)
                          .replace("T", " ")}
                      </td>
                      <th scope="row" className="font-mono-code">
                        {batch.gatewaySettlementId}
                      </th>
                      <td className="font-mono-code text-xs">
                        {batch.utrNumber ?? "Pending UTR"}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatInr(batch.grossAmount.toString())}
                      </td>
                      <td className="text-right tabular-nums text-xs">
                        {formatInr(batch.totalFee.toString())} +{" "}
                        {formatInr(batch.totalTax.toString())}
                      </td>
                      <td className="text-right tabular-nums font-semibold">
                        {formatInr(batch.netAmount.toString())}
                      </td>
                      <td>
                        {batch.bankReconciledAt ? (
                          <StatusBadge status="PAID" label="Bank Reconciled" />
                        ) : (
                          <StatusBadge
                            status="UNSETTLED"
                            label="Awaiting Bank Match"
                          />
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

