import { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/session";
import { withIdempotency } from "@/lib/db/sequences";
import {
  getRequestId,
  handleApiError,
  jsonOk,
  verifyCsrfAndOrigin,
} from "@/lib/http";
import { createDynamicInvoiceUpiQr } from "@/modules/razorpay/service";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    verifyCsrfAndOrigin(req, actor);
    const { id } = await context.params;
    const body = await req.json();

    const idem = await withIdempotency({
      key: req.headers.get("idempotency-key"),
      actorId: actor.userId,
      route: `POST:/invoices/${id}/payments/qr`,
      requestPayload: body,
      statusCode: 201,
      execute: () => createDynamicInvoiceUpiQr(actor, id, body),
    });

    return jsonOk(idem.data, requestId, idem.statusCode);
  } catch (err) {
    return handleApiError(err, req);
  }
}

