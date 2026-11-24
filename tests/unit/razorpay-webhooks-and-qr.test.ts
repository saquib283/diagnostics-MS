import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
  extractGatewayFeeBreakdown,
  evaluateQrSessionAvailability,
} from "@/modules/razorpay/signature";

describe("Razorpay Signature Verification, QR Expiry & Fee Separation", () => {
  const keySecret = "rzp_test_secret_key_for_hmac_check";
  const webhookSecret = "whsec_test_raw_body_hmac_secret";

  it("verifies valid Razorpay Checkout order|payment HMAC-SHA256 signatures and rejects tampering", () => {
    const orderId = "order_P9xabc123";
    const paymentId = "pay_P9xdef456";
    const validSig = createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    expect(
      verifyRazorpayCheckoutSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: validSig,
        keySecret,
      }),
    ).toBe(true);

    expect(
      verifyRazorpayCheckoutSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: "pay_TAMPERED",
        razorpaySignature: validSig,
        keySecret,
      }),
    ).toBe(false);
  });

  it("verifies Razorpay Webhook signature strictly against the exact raw request body string", () => {
    const rawBody = JSON.stringify({
      entity: "event",
      event: "qr_code.credited",
      payload: { qr_code: { entity: { id: "qr_123" } } },
    });
    const validSig = createHmac("sha256", webhookSecret)
      .update(rawBody, "utf8")
      .digest("hex");

    expect(
      verifyRazorpayWebhookSignature({
        rawBody,
        signatureHeader: validSig,
        webhookSecret,
      }),
    ).toBe(true);

    // Formatting change in raw body invalidates signature
    expect(
      verifyRazorpayWebhookSignature({
        rawBody: `${rawBody} `,
        signatureHeader: validSig,
        webhookSecret,
      }),
    ).toBe(false);
  });

  it("separates Razorpay fee and GST on fee from gross patient payment", () => {
    // Patient pays ₹2,000.00 (200000 paise); Razorpay charges ₹47.20 incl ₹7.20 GST (4720 paise fee, 720 paise tax)
    const breakdown = extractGatewayFeeBreakdown({
      amountPaise: 200000,
      feePaise: 4720,
      taxPaise: 720,
    });
    expect(breakdown).toEqual({
      grossAmount: "2000.00",
      gatewayFee: "40.00", // Net gateway fee excl tax (47.20 - 7.20)
      gatewayFeeTax: "7.20",
      totalGatewayDeduction: "47.20",
      netSettlementEstimate: "1952.80",
    });
  });

  it("marks expired or already-credited Dynamic UPI QR sessions unavailable for reuse", () => {
    const now = new Date("2026-11-24T10:00:00Z");
    expect(
      evaluateQrSessionAvailability(
        { status: "ACTIVE", expiresAt: new Date("2026-11-24T10:05:00Z") },
        now,
      ),
    ).toBe("USABLE");
    expect(
      evaluateQrSessionAvailability(
        { status: "ACTIVE", expiresAt: new Date("2026-11-24T09:59:00Z") },
        now,
      ),
    ).toBe("EXPIRED");
    expect(
      evaluateQrSessionAvailability(
        { status: "CREDITED", expiresAt: new Date("2026-11-24T10:05:00Z") },
        now,
      ),
    ).toBe("ALREADY_USED");
  });
});

