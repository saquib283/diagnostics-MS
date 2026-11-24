import type { Metadata } from "next";
import { Download } from "lucide-react";
import { Panel } from "@/components/ui/primitives";
import { requireActor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatInr } from "@/lib/money";
import { requirePermission } from "@/lib/permissions/rbac";
import { SUPPORTED_EXPORT_REPORTS } from "@/modules/analytics/service";

export const metadata: Metadata = { title: "Accounting Ledger & Financial Exports" };

const REPORT_LABELS: Record<(typeof SUPPORTED_EXPORT_REPORTS)[number], string> = {
  "daily-collections": "Daily Collection Report by Method & Cashier",
  "invoice-register": "Model A Invoice Register",
  "patient-outstanding": "Patient Outstanding Balance Report",
  "cashier-closing": "Cashier Shift / Cash Closing Report",
  "razorpay-transactions": "Razorpay Gateway Transaction & Fee Report",
  "razorpay-settlements": "Razorpay Settlement Batch vs Bank Reconciliation Report",
  "refund-register": "Payment Refund Report",
  "partner-payables": "Partner Payable Statement Register (Model A)",
  "partner-commissions": "Partner Commission Receivable Register (Model B)",
  "completed-tests": "Completed Diagnostic Test Register",
  "partner-performance": "Partner Fulfilment Performance Register",
  "patient-order-history": "Patient & Order Consolidated History",
  "gross-margin-analysis":
    "Illustrative Gross Commercial Difference Report (Before Indirect Expenses & Taxes)",
};

export default async function AdminAccountingPage() {
  const actor = await requireActor();
  requirePermission(actor, "reports:finance");

  const entries = await db.journalEntry.findMany({
    orderBy: { postingDate: "desc" },
    take: 30,
    include: {
      lines: { include: { account: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1
          id="main-content"
          tabIndex={-1}
          className="text-[22px] font-semibold text-[#0F172A] m-0"
        >
          Double-Entry Accounting Ledger & Excel Financial Exports
        </h1>
        <p className="text-xs text-[#475569] m-0 mt-0.5">
          Immutable balanced journal postings and downloadable Excel (.xlsx) financial registers. Final tax/COA treatment must be reviewed by a qualified CA.
        </p>
      </div>

      <Panel title="Export Financial & Operational Registers (.xlsx)">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {SUPPORTED_EXPORT_REPORTS.map((key) => (
            <a
              key={key}
              href={`/api/v1/reports/export/${key}`}
              className="flex items-center justify-between gap-2 rounded-[4px] border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-xs font-medium text-[#0F172A] no-underline hover:bg-[#E2E8F0]"
            >
              <span>{REPORT_LABELS[key]}</span>
              <Download className="h-3.5 w-3.5 shrink-0 text-[#1B365D]" aria-hidden="true" />
            </a>
          ))}
        </div>
      </Panel>

      <Panel title={`Recent Balanced Journal Entries (${entries.length})`}>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="journal-caption"
          className="erp-table-region"
        >
          <table className="erp-table">
            <caption id="journal-caption" className="visually-hidden">
              Double-entry accounting journal entries
            </caption>
            <thead>
              <tr>
                <th scope="col">Journal #</th>
                <th scope="col">Date</th>
                <th scope="col">Narration</th>
                <th scope="col">Account Lines (Debit / Credit)</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-[#475569]">
                    No journal entries posted yet.
                  </td>
                </tr>
              ) : (
                entries.map((je) => (
                  <tr key={je.id}>
                    <th scope="row" className="font-mono-code">
                      {je.entryNumber}
                    </th>
                    <td className="tabular-nums text-xs">
                      {je.postingDate.toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="text-xs">{je.narration}</td>
                    <td>
                      <div className="space-y-0.5 text-xs tabular-nums">
                        {je.lines.map((l) => (
                          <div key={l.id}>
                            <span className="font-mono-code">{l.account.code}</span>{" "}
                            {l.account.name}:{" "}
                            {Number(l.debitAmount.toString()) > 0
                              ? `Dr ${formatInr(l.debitAmount.toString())}`
                              : `Cr ${formatInr(l.creditAmount.toString())}`}
                          </div>
                        ))}
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

