import { NextRequest } from "next/server";
import { getRequestId, handleApiError, jsonOk } from "@/lib/http";
import { processRazorpayRawWebhook } from "@/modules/razorpay/service";

/**
 * Razorpay Webhook Endpoint — MUST consume exact raw body via req.text()
 * for HMAC-SHA256 verification before JSON parsing.
 */
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("x-razorpay-signature");
    const eventIdHeader = req.headers.get("x-razorpay-event-id");

    const result = await processRazorpayRawWebhook({
      rawBody,
      signatureHeader,
      eventIdHeader,
    });

    return jsonOk(result, requestId, 200);
  } catch (err) {
    return handleApiError(err, req);
  }
}

