import type { Metadata } from "next";
import Link from "next/link";
import {
  InvoiceSplitPaymentAndShareWorkbench,
  PaymentRefundRowAction,
  PrintInvoiceButton,
  RevokeShareLinkButton,
} from "@/components/payments/invoice-payment-workbench";
import { Panel } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireActor } from "@/lib/auth/session";
import { formatInr, money, subMoney, sumMoney } from "@/lib/money";
import { hasPermission } from "@/lib/permissions/rbac";
import { getInvoiceDetail } from "@/modules/billing/service";

export const metadata: Metadata = { title: "Invoice & Split-Payment Ledger" };

export default async function AdminInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor();
  const { id } = await params;
  const invoice = await getInvoiceDetail(actor, id);

  const canRefund = hasPermission(actor, "refunds:initiate");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1
              id="main-content"
              tabIndex={-1}
              className="text-[22px] font-semibold text-[#0F172A] font-mono-code m-0"
            >
              {invoice.invoiceNumber}
            </h1>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="text-xs text-[#475569] m-0 mt-1">
            Order:{" "}
            <Link
              href={`/admin/orders/${invoice.orderId}`}
              className="font-mono-code text-[#1B365D] hover:underline"
            >
              {invoice.order.orderNumber}
            </Link>{" "}
            · Patient: <strong>{invoice.patientNameSnapshot}</strong> (
            {invoice.patientCodeSnapshot}) · Partner:{" "}
            <strong>{invoice.partnerNameSnapshot}</strong>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <PrintInvoiceButton />
          <a
            href={`/api/v1/invoices/${invoice.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center rounded-[4px] border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#0F172A] no-underline hover:bg-[#F8FAFC]"
          >
            Original Issued Invoice PDF
          </a>
          <a
            href={`/api/v1/invoices/${invoice.id}/pdf?kind=statement`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center rounded-[4px] bg-[#1B365D] px-3 text-xs font-medium text-white no-underline hover:bg-[#122644]"
          >
            Updated Account Statement PDF
          </a>
        </div>
      </div>

      {/* Prominent Financial Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-[6px] border border-[#E2E8F0] bg-white px-4 py-3">
          <p className="text-xs text-[#475569] m-0">Effective Invoice Total</p>
          <p className="mt-1 text-lg font-semibold tabular-nums m-0">
            {formatInr(invoice.effectiveTotal.toString())}
          </p>
        </div>
        <div className="rounded-[6px] border border-[#E2E8F0] bg-white px-4 py-3">
          <p className="text-xs text-[#475569] m-0">Successful Collections</p>
          <p className="mt-1 text-lg font-semibold text-[#166534] tabular-nums m-0">
            {formatInr(invoice.amountPaid.toString())}
          </p>
        </div>
        <div className="rounded-[6px] border border-[#E2E8F0] bg-white px-4 py-3">
          <p className="text-xs text-[#475569] m-0">Processed Refunds</p>
          <p className="mt-1 text-lg font-semibold text-[#991B1B] tabular-nums m-0">
            {formatInr(invoice.amountRefunded.toString())}
          </p>
        </div>
        <div className="rounded-[6px] border border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3">
          <p className="text-xs font-semibold text-[#0F172A] m-0">
            Outstanding Balance Due
          </p>
          <p className="mt-1 text-lg font-semibold text-[#0F172A] tabular-nums m-0">
            {formatInr(invoice.balanceDue.toString())}
          </p>
        </div>
      </div>

      {hasPermission(actor, "payments:collect") ? (
        <InvoiceSplitPaymentAndShareWorkbench
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoiceNumber}
          balanceDue={money(invoice.balanceDue.toString())}
          patientMobile={invoice.patientMobileSnapshot}
          patientEmail={invoice.patient.email}
          receipts={invoice.payments
            .filter((p) => Boolean(p.receipt))
            .map((p) => ({
              id: p.receipt!.id,
              receiptNumber: p.receipt!.receiptNumber,
              amount: money(p.amount),
            }))}
          csrfToken={actor.csrfToken}
        />
      ) : null}

      <Panel title="Immutable Issued Invoice Line Items">
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="inv-items-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="inv-items-caption" className="visually-hidden">
              Invoice line items
            </caption>
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Diagnostic Service</th>
                <th scope="col" className="text-right">
                  Qty
                </th>
                <th scope="col" className="text-right">
                  Unit Rate
                </th>
                <th scope="col" className="text-right">
                  Discount
                </th>
                <th scope="col" className="text-right">
                  Taxable
                </th>
                <th scope="col" className="text-right">
                  GST
                </th>
                <th scope="col" className="text-right">
                  Line Total
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <th scope="row" className="font-mono-code">
                    {item.testCodeSnapshot}
                  </th>
                  <td>{item.descriptionSnapshot}</td>
                  <td className="text-right tabular-nums">{item.quantity}</td>
                  <td className="text-right tabular-nums">
                    {formatInr(item.unitPrice.toString())}
                  </td>
                  <td className="text-right tabular-nums">
                    {formatInr(item.discountAmount.toString())}
                  </td>
                  <td className="text-right tabular-nums">
                    {formatInr(item.taxableAmount.toString())}
                  </td>
                  <td className="text-right tabular-nums">
                    {formatInr(
                      sumMoney([
                        item.cgstAmount.toString(),
                        item.sgstAmount.toString(),
                        item.igstAmount.toString(),
                      ]),
                    )}
                  </td>
                  <td className="text-right tabular-nums font-semibold">
                    {formatInr(item.lineTotal.toString())}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={`Split-Payment Transaction Ledger (${invoice.payments.length})`}>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="inv-payments-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="inv-payments-caption" className="visually-hidden">
              Split payment transactions against this invoice
            </caption>
            <thead>
              <tr>
                <th scope="col">Date (UTC)</th>
                <th scope="col">Receipt #</th>
                <th scope="col">Method</th>
                <th scope="col">Status</th>
                <th scope="col">Reference / Gateway Fee</th>
                <th scope="col" className="text-right">
                  Amount
                </th>
                <th scope="col">Receipt & Refund</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-5 text-center text-[#475569]">
                    No payment transactions recorded yet.
                  </td>
                </tr>
              ) : (
                invoice.payments.map((pay) => {
                  const refundedSoFar = sumMoney(
                    pay.refunds
                      .filter((r) => r.status === "PROCESSED")
                      .map((r) => r.amount.toString()),
                  );
                  const refundable = subMoney(pay.amount.toString(), refundedSoFar);
                  return (
                    <tr key={pay.id}>
                      <td className="tabular-nums text-xs">
                        {pay.paymentDate.toISOString().replace("T", " ").slice(0, 19)}
                      </td>
                      <th scope="row" className="font-mono-code">
                        {pay.receipt?.receiptNumber ?? "—"}
                      </th>
                      <td>{pay.paymentMethod}</td>
                      <td>
                        <StatusBadge status={pay.paymentStatus} />
                      </td>
                      <td className="text-xs">
                        <span className="font-mono-code">
                          {pay.externalReference ?? "Counter"}
                        </span>
                        {pay.gatewayTransaction ? (
                          <span className="block text-[#475569] tabular-nums">
                            GW Fee: ₹{pay.gatewayTransaction.gatewayFee.toString()} + GST ₹
                            {pay.gatewayTransaction.gatewayFeeTax.toString()}
                          </span>
                        ) : null}
                      </td>
                      <td className="text-right tabular-nums font-semibold">
                        {formatInr(pay.amount.toString())}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {pay.receipt ? (
                            <a
                              href={`/api/v1/receipts/${pay.receipt.id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-medium text-[#1B365D] underline"
                            >
                              Receipt PDF
                            </a>
                          ) : null}
                          {canRefund &&
                          (pay.paymentStatus === "SUCCESS" ||
                            pay.paymentStatus === "PARTIALLY_REFUNDED") &&
                          Number(refundable) > 0 ? (
                            <PaymentRefundRowAction
                              paymentId={pay.id}
                              maxRefundable={refundable}
                              isGateway={Boolean(
                                pay.gatewayTransaction?.gatewayPaymentId,
                              )}
                              csrfToken={actor.csrfToken}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {invoice.adjustmentNotes.length > 0 ? (
        <Panel title={`Credit & Debit Adjustment Notes (${invoice.adjustmentNotes.length})`}>
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="inv-adj-caption"
            className="erp-table-region"
          >
            <table className="erp-table">
              <caption id="inv-adj-caption" className="visually-hidden">
                Credit and debit adjustment notes
              </caption>
              <thead>
                <tr>
                  <th scope="col">Note #</th>
                  <th scope="col">Type</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Issued At</th>
                  <th scope="col" className="text-right">
                    Total Delta
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.adjustmentNotes.map((n) => (
                  <tr key={n.id}>
                    <th scope="row" className="font-mono-code">
                      {n.noteNumber}
                    </th>
                    <td>
                      <StatusBadge status={n.noteType} />
                    </td>
                    <td>{n.reason}</td>
                    <td className="tabular-nums text-xs">
                      {n.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="text-right tabular-nums font-semibold">
                      {formatInr(n.totalDelta.toString())}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <Panel title={`Document Share Log & Link Revocation (${invoice.shareLogs.length})`}>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="inv-shares-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="inv-shares-caption" className="visually-hidden">
              Shared customer document links and delivery status
            </caption>
            <thead>
              <tr>
                <th scope="col">Shared At (UTC)</th>
                <th scope="col">Channel</th>
                <th scope="col">Destination</th>
                <th scope="col">Delivery</th>
                <th scope="col">Token Expiry / Views</th>
                <th scope="col">Revocation</th>
              </tr>
            </thead>
            <tbody>
              {invoice.shareLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-5 text-center text-[#475569]">
                    No customer share links generated yet.
                  </td>
                </tr>
              ) : (
                invoice.shareLogs.map((log) => {
                  const isRevoked = Boolean(log.shareToken?.revokedAt);
                  const isExpired = log.isTokenExpired;
                  return (
                    <tr key={log.id}>
                      <td className="tabular-nums text-xs">
                        {log.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                      </td>
                      <td>{log.channel}</td>
                      <td className="font-mono-code text-xs">
                        {log.destinationMasked ?? "Manual Link"}
                      </td>
                      <td>
                        <StatusBadge status={log.deliveryStatus} />
                      </td>
                      <td className="text-xs tabular-nums">
                        {log.shareToken ? (
                          <>
                            Exp:{" "}
                            {log.shareToken.expiresAt
                              .toISOString()
                              .slice(0, 16)
                              .replace("T", " ")}{" "}
                            · Views: {log.shareToken.viewCount}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {log.shareToken ? (
                          isRevoked ? (
                            <StatusBadge status="REVOKED" label="Revoked" />
                          ) : isExpired ? (
                            <StatusBadge status="EXPIRED" label="Expired" />
                          ) : hasPermission(actor, "invoices:share") ? (
                            <RevokeShareLinkButton
                              tokenId={log.shareToken.id}
                              csrfToken={actor.csrfToken}
                            />
                          ) : (
                            <span className="text-xs text-[#166534]">Active</span>
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

