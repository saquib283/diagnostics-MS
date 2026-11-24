import { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/session";
import {
  getRequestId,
  handleApiError,
  jsonOk,
  verifyCsrfAndOrigin,
} from "@/lib/http";
import {
  amendOrCancelDiagnosticOrder,
  getOrderDetail,
} from "@/modules/orders/service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    const { id } = await context.params;
    return jsonOk(await getOrderDetail(actor, id), requestId);
  } catch (err) {
    return handleApiError(err, req);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    verifyCsrfAndOrigin(req, actor);
    const { id } = await context.params;
    const updated = await amendOrCancelDiagnosticOrder(
      actor,
      id,
      await req.json(),
    );
    return jsonOk(updated, requestId);
  } catch (err) {
    return handleApiError(err, req);
  }
}
