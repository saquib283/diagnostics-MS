import { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/session";
import { withIdempotency } from "@/lib/db/sequences";
import {
  getClientIp,
  getRequestId,
  handleApiError,
  jsonOk,
  verifyCsrfAndOrigin,
} from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { initiateRazorpayOrderForInvoice } from "@/modules/razorpay/service";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    verifyCsrfAndOrigin(req, actor);
    checkRateLimit({
      bucket: "payments:initiate",
      identifier: getClientIp(req),
      limit: 30,
      windowMs: 5 * 60 * 1000,
    });
    const { id } = await context.params;
    const body = await req.json();

    const idem = await withIdempotency({
      key: req.headers.get("idempotency-key"),
      actorId: actor.userId,
      route: `POST:/invoices/${id}/payments/razorpay/order`,
      requestPayload: body,
      statusCode: 201,
      execute: () => initiateRazorpayOrderForInvoice(actor, id, body),
    });

    return jsonOk(idem.data, requestId, idem.statusCode);
  } catch (err) {
    return handleApiError(err, req);
  }
}

