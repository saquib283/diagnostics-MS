import { AppError } from "@/lib/errors";
import {
  compareMoney,
  isNonNegativeMoney,
  isPositiveMoney,
  sumMoney,
  type MoneyInput,
} from "@/lib/money";

export interface DraftJournalLine {
  accountCode: string;
  debitAmount: MoneyInput;
  creditAmount: MoneyInput;
  partnerId?: string | null;
  memo?: string;
}

export function validateBalancedJournalLines(
  lines: readonly DraftJournalLine[],
): { totalDebit: string; totalCredit: string } {
  if (lines.length < 2) {
    throw new AppError(
      "BAD_REQUEST",
      "UNBALANCED_JOURNAL: Journal entry requires at least two lines.",
      400,
    );
  }

  for (const line of lines) {
    if (
      !isNonNegativeMoney(line.debitAmount) ||
      !isNonNegativeMoney(line.creditAmount)
    ) {
      throw new AppError(
        "BAD_REQUEST",
        "UNBALANCED_JOURNAL: Journal amounts cannot be negative.",
        400,
      );
    }
    if (isPositiveMoney(line.debitAmount) && isPositiveMoney(line.creditAmount)) {
      throw new AppError(
        "BAD_REQUEST",
        "UNBALANCED_JOURNAL: A single journal line cannot carry both debit and credit.",
        400,
      );
    }
  }

  const totalDebit = sumMoney(lines.map((l) => l.debitAmount));
  const totalCredit = sumMoney(lines.map((l) => l.creditAmount));

  if (!isPositiveMoney(totalDebit) || compareMoney(totalDebit, totalCredit) !== 0) {
    throw new AppError(
      "BAD_REQUEST",
      `UNBALANCED_JOURNAL: Debits (${totalDebit}) must equal Credits (${totalCredit}) and exceed 0.00.`,
      400,
    );
  }

  return { totalDebit, totalCredit };
}

