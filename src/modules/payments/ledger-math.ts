import type {
  CommercialModel,
  InvoiceStatus,
  PaymentStatus,
  RefundStatus,
} from "@prisma/client";
import { AppError } from "@/lib/errors";
import {
  addMoney,
  compareMoney,
  isPositiveMoney,
  money,
  subMoney,
  sumMoney,
  type MoneyInput,
} from "@/lib/money";

export function assertInvoiceModelEligibility(model: CommercialModel): void {
  if (model !== "MODEL_A_CONSULTANCY_COLLECTS") {
    throw new AppError(
      "MODEL_B_INVOICE_PROHIBITED",
      "Model B orders are collected directly by the partner diagnostic centre; do not issue a consultancy patient diagnostic invoice.",
      422,
    );
  }
}

export function assertPartnerRefModelEligibility(model: CommercialModel): void {
  if (model !== "MODEL_B_PATIENT_PAYS_PARTNER") {
    throw new AppError(
      "MODEL_A_PARTNER_REF_PROHIBITED",
      "Partner direct patient invoice references apply only to Model B orders.",
      422,
    );
  }
}

const COLLECTED_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "SUCCESS",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
];

export interface InvoiceLedgerComputationInput {
  grandTotal: MoneyInput;
  creditNoteTotal: MoneyInput;
  debitNoteTotal: MoneyInput;
  isVoid: boolean;
  payments: ReadonlyArray<{ amount: MoneyInput; status: PaymentStatus }>;
  refunds: ReadonlyArray<{ amount: MoneyInput; status: RefundStatus }>;
}

export interface InvoiceLedgerState {
  effectiveTotal: string;
  amountPaid: string;
  amountRefunded: string;
  netCollected: string;
  balanceDue: string;
  status: InvoiceStatus;
}

/**
 * Authoritative split-payment ledger state calculator.
 * - PENDING, FAILED, CANCELLED, and EXPIRED payment rows NEVER reduce balanceDue.
 * - Partially paid invoices (netCollected > 0 && balanceDue > 0) ALWAYS return PARTIALLY_PAID.
 */
export function computeInvoiceLedgerState(
  input: InvoiceLedgerComputationInput,
): InvoiceLedgerState {
  const effectiveTotal = subMoney(
    addMoney(input.grandTotal, input.debitNoteTotal),
    input.creditNoteTotal,
  );

  const amountPaid = sumMoney(
    input.payments
      .filter((p) => COLLECTED_PAYMENT_STATUSES.includes(p.status))
      .map((p) => p.amount),
  );

  const amountRefunded = sumMoney(
    input.refunds
      .filter((r) => r.status === "PROCESSED")
      .map((r) => r.amount),
  );

  const netCollected = subMoney(amountPaid, amountRefunded);
  const rawBalance = subMoney(effectiveTotal, netCollected);
  const balanceDue = compareMoney(rawBalance, "0.00") > 0 ? rawBalance : "0.00";

  let status: InvoiceStatus;
  if (input.isVoid) {
    status = "VOID";
  } else if (
    isPositiveMoney(amountRefunded) &&
    compareMoney(netCollected, "0.00") <= 0
  ) {
    status = "REFUNDED";
  } else if (
    isPositiveMoney(amountRefunded) &&
    compareMoney(balanceDue, "0.00") === 0
  ) {
    status = "PARTIALLY_REFUNDED";
  } else if (compareMoney(balanceDue, "0.00") === 0) {
    status = "PAID";
  } else if (isPositiveMoney(netCollected)) {
    status = "PARTIALLY_PAID";
  } else {
    status = "UNPAID";
  }

  return {
    effectiveTotal,
    amountPaid,
    amountRefunded,
    netCollected,
    balanceDue,
    status,
  };
}

export function assertPaymentAllowedAgainstInvoice(params: {
  invoiceStatus: InvoiceStatus;
  balanceDue: MoneyInput;
  attemptedAmount: MoneyInput;
  allowOverpayment: boolean;
}): void {
  if (params.invoiceStatus === "VOID" || params.invoiceStatus === "DRAFT") {
    throw new AppError(
      "BAD_REQUEST",
      `Payments cannot be collected against a ${params.invoiceStatus} invoice.`,
      422,
    );
  }

  const amount = money(params.attemptedAmount);
  if (!isPositiveMoney(amount)) {
    throw new AppError(
      "BAD_REQUEST",
      "Payment amount must be strictly greater than ₹0.00.",
      400,
    );
  }

  const due = money(params.balanceDue);
  if (compareMoney(due, "0.00") <= 0 && !params.allowOverpayment) {
    throw new AppError(
      "OVERPAYMENT_NOT_ALLOWED",
      "Invoice has zero outstanding balance; additional payment is blocked.",
      422,
    );
  }

  if (compareMoney(amount, due) > 0 && !params.allowOverpayment) {
    throw new AppError(
      "OVERPAYMENT_NOT_ALLOWED",
      `Payment amount (₹${amount}) exceeds invoice outstanding balance (₹${due}).`,
      422,
    );
  }
}

