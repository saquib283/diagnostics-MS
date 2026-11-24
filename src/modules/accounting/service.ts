import { AccountType } from "@prisma/client";
import type { DbClient } from "@/lib/db";
import { nextDocumentNumber } from "@/lib/db/sequences";
import { money } from "@/lib/money";
import {
  validateBalancedJournalLines,
  type DraftJournalLine,
} from "./ledger-math";

export const SYSTEM_ACCOUNTS: ReadonlyArray<{
  code: string;
  name: string;
  accountType: AccountType;
}> = [
  { code: "1100", name: "Cash on Hand", accountType: "ASSET" },
  { code: "1110", name: "Operating Bank Account", accountType: "ASSET" },
  { code: "1120", name: "Razorpay Gateway Clearing", accountType: "ASSET" },
  { code: "1200", name: "Patient Accounts Receivable (Model A)", accountType: "ASSET" },
  { code: "1210", name: "Partner Commission Receivable (Model B)", accountType: "ASSET" },
  { code: "2100", name: "Partner Diagnostic Payables (Model A)", accountType: "LIABILITY" },
  { code: "2200", name: "Output GST Liability", accountType: "LIABILITY" },
  { code: "4100", name: "Diagnostic Service Revenue (Model A)", accountType: "REVENUE" },
  { code: "4200", name: "Partner Commission Revenue (Model B)", accountType: "REVENUE" },
  { code: "5100", name: "Partner Diagnostic Service Cost (Model A)", accountType: "EXPENSE" },
  { code: "5200", name: "Payment Gateway Fees & Taxes", accountType: "EXPENSE" },
];

export async function ensureSystemChartOfAccounts(tx: DbClient): Promise<Map<string, string>> {
  const codeToId = new Map<string, string>();
  for (const acct of SYSTEM_ACCOUNTS) {
    const row = await tx.chartOfAccount.upsert({
      where: { code: acct.code },
      create: {
        code: acct.code,
        name: acct.name,
        accountType: acct.accountType,
        isSystem: true,
      },
      update: {},
    });
    codeToId.set(acct.code, row.id);
  }
  return codeToId;
}

export async function postJournalEntry(
  tx: DbClient,
  params: {
    referenceType: string;
    referenceId: string;
    narration: string;
    postedById?: string | null;
    reversalOfEntryId?: string | null;
    lines: readonly DraftJournalLine[];
  },
) {
  validateBalancedJournalLines(params.lines);
  const codeMap = await ensureSystemChartOfAccounts(tx);
  const entryNumber = await nextDocumentNumber(tx, "JOURNAL");

  return tx.journalEntry.create({
    data: {
      entryNumber,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      narration: params.narration,
      postedById: params.postedById ?? null,
      reversalOfEntryId: params.reversalOfEntryId ?? null,
      lines: {
        create: params.lines.map((line) => {
          const accountId = codeMap.get(line.accountCode);
          if (!accountId) {
            throw new Error(`Unknown Chart of Account code: ${line.accountCode}`);
          }
          return {
            accountId,
            debitAmount: money(line.debitAmount),
            creditAmount: money(line.creditAmount),
            partnerId: line.partnerId ?? null,
            memo: line.memo ?? null,
          };
        }),
      },
    },
    include: { lines: true },
  });
}

