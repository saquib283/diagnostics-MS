import { describe, expect, it } from "vitest";
import {
  computeInvoiceLedgerState,
  assertPaymentAllowedAgainstInvoice,
  assertInvoiceModelEligibility,
} from "@/modules/payments/ledger-math";

describe("Split-Payment Ledger, Overpayment Guard & Billing Rules", () => {
  it("enforces Model A invoice issuance and prohibits consultancy diagnostic invoices for Model B", () => {
    expect(() =>
      assertInvoiceModelEligibility("MODEL_A_CONSULTANCY_COLLECTS"),
    ).not.toThrow();
    expect(() =>
      assertInvoiceModelEligibility("MODEL_B_PATIENT_PAYS_PARTNER"),
    ).toThrow(/MODEL_B_INVOICE_PROHIBITED/);
  });

  it("computes ₹5,000 = ₹2,000 cash + ₹2,000 UPI QR + ₹1,000 card across sessions and never shows partial as PAID", () => {
    // Session 1: ₹2,000 Cash + ₹2,000 Pending QR (QR not yet verified!)
    const afterStep1 = computeInvoiceLedgerState({
      grandTotal: "5000.00",
      creditNoteTotal: "0.00",
      debitNoteTotal: "0.00",
      isVoid: false,
      payments: [
        { amount: "2000.00", status: "SUCCESS" },
        { amount: "2000.00", status: "PENDING" },
        { amount: "1000.00", status: "FAILED" },
      ],
      refunds: [],
    });
    expect(afterStep1.amountPaid).toBe("2000.00");
    expect(afterStep1.balanceDue).toBe("3000.00");
    expect(afterStep1.status).toBe("PARTIALLY_PAID");

    // Session 1b: Webhook confirms ₹2,000 UPI QR
    const afterStep2 = computeInvoiceLedgerState({
      grandTotal: "5000.00",
      creditNoteTotal: "0.00",
      debitNoteTotal: "0.00",
      isVoid: false,
      payments: [
        { amount: "2000.00", status: "SUCCESS" },
        { amount: "2000.00", status: "SUCCESS" },
        { amount: "1000.00", status: "FAILED" },
      ],
      refunds: [],
    });
    expect(afterStep2.amountPaid).toBe("4000.00");
    expect(afterStep2.balanceDue).toBe("1000.00");
    expect(afterStep2.status).toBe("PARTIALLY_PAID");

    // Session 2 (next day): Remaining ₹1,000 paid via Razorpay Card
    const afterStep3 = computeInvoiceLedgerState({
      grandTotal: "5000.00",
      creditNoteTotal: "0.00",
      debitNoteTotal: "0.00",
      isVoid: false,
      payments: [
        { amount: "2000.00", status: "SUCCESS" },
        { amount: "2000.00", status: "SUCCESS" },
        { amount: "1000.00", status: "FAILED" },
        { amount: "1000.00", status: "SUCCESS" },
      ],
      refunds: [],
    });
    expect(afterStep3.amountPaid).toBe("5000.00");
    expect(afterStep3.balanceDue).toBe("0.00");
    expect(afterStep3.status).toBe("PAID");
  });

  it("blocks overpayment by default and recalculates status on partial/full refunds and credit notes", () => {
    expect(() =>
      assertPaymentAllowedAgainstInvoice({
        invoiceStatus: "PARTIALLY_PAID",
        balanceDue: "1000.00",
        attemptedAmount: "1000.01",
        allowOverpayment: false,
      }),
    ).toThrow(/OVERPAYMENT_NOT_ALLOWED/);

    // Partial refund of ₹500 on a ₹5,000 paid invoice + ₹500 Credit Note
    const afterCreditAndRefund = computeInvoiceLedgerState({
      grandTotal: "5000.00",
      creditNoteTotal: "500.00",
      debitNoteTotal: "0.00",
      isVoid: false,
      payments: [{ amount: "5000.00", status: "PARTIALLY_REFUNDED" }],
      refunds: [{ amount: "500.00", status: "PROCESSED" }],
    });
    expect(afterCreditAndRefund.effectiveTotal).toBe("4500.00");
    expect(afterCreditAndRefund.netCollected).toBe("4500.00");
    expect(afterCreditAndRefund.balanceDue).toBe("0.00");
    expect(afterCreditAndRefund.status).toBe("PARTIALLY_REFUNDED");
  });
});

