import { createHmac, timingSafeEqual } from "node:crypto";
import type { QrSessionStatus } from "@prisma/client";
import { fromPaise, subMoney } from "@/lib/money";

function constantTimeHexMatch(expectedHex: string, providedHex: string): boolean {
  if (!expectedHex || !providedHex) {
    return false;
  }
  const cleanProvided = providedHex.trim().toLowerCase();
  if (expectedHex.length !== cleanProvided.length) {
    return false;
  }
  const a = Buffer.from(expectedHex, "utf8");
  const b = Buffer.from(cleanProvided, "utf8");
  return timingSafeEqual(a, b);
}

/**
 * Verifies Razorpay Checkout signature: HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, keySecret)
 */
export function verifyRazorpayCheckoutSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  keySecret: string;
}): boolean {
  const payload = `${params.razorpayOrderId}|${params.razorpayPaymentId}`;
  const expected = createHmac("sha256", params.keySecret)
    .update(payload, "utf8")
    .digest("hex");
  return constantTimeHexMatch(expected, params.razorpaySignature);
}

/**
 * Verifies Razorpay Webhook signature strictly against the unparsed raw request body string.
 */
export function verifyRazorpayWebhookSignature(params: {
  rawBody: string;
  signatureHeader: string | null | undefined;
  webhookSecret: string;
}): boolean {
  if (!params.signatureHeader) {
    return false;
  }
  const expected = createHmac("sha256", params.webhookSecret)
    .update(params.rawBody, "utf8")
    .digest("hex");
  return constantTimeHexMatch(expected, params.signatureHeader);
}

/**
 * Razorpay's `fee` field on Payment entities is total fee inclusive of `tax` (GST) in paise.
 * Separates net gateway fee, GST on fee, and net settlement estimate from patient gross payment.
 */
export function extractGatewayFeeBreakdown(params: {
  amountPaise: number;
  feePaise?: number | null;
  taxPaise?: number | null;
}) {
  const grossAmount = fromPaise(params.amountPaise);
  const totalGatewayDeduction = fromPaise(params.feePaise ?? 0);
  const gatewayFeeTax = fromPaise(params.taxPaise ?? 0);
  const gatewayFee = subMoney(totalGatewayDeduction, gatewayFeeTax);
  const netSettlementEstimate = subMoney(grossAmount, totalGatewayDeduction);

  return {
    grossAmount,
    gatewayFee,
    gatewayFeeTax,
    totalGatewayDeduction,
    netSettlementEstimate,
  };
}

export function evaluateQrSessionAvailability(
  session: { status: QrSessionStatus; expiresAt: Date },
  now: Date = new Date(),
): "USABLE" | "EXPIRED" | "ALREADY_USED" | "CLOSED" {
  if (session.status === "CREDITED") {
    return "ALREADY_USED";
  }
  if (session.status === "CLOSED" || session.status === "CANCELLED") {
    return "CLOSED";
  }
  if (session.status === "EXPIRED" || session.expiresAt <= now) {
    return "EXPIRED";
  }
  return "USABLE";
}

