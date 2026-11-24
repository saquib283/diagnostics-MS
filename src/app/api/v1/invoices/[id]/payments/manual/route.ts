import { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/session";
import { withIdempotency } from "@/lib/db/sequences";
import {
  getRequestId,
  handleApiError,
  jsonOk,
  verifyCsrfAndOrigin,
} from "@/lib/http";
import { recordManualSplitPayment } from "@/modules/payments/service";

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
    const idemKey = req.headers.get("idempotency-key");

    const idem = await withIdempotency({
      key: idemKey,
      actorId: actor.userId,
      route: `POST:/invoices/${id}/payments/manual`,
      requestPayload: body,
      statusCode: 201,
      execute: () => recordManualSplitPayment(actor, id, body, idemKey),
    });

    return jsonOk(idem.data, requestId, idem.statusCode);
  } catch (err) {
    return handleApiError(err, req);
  }
}

