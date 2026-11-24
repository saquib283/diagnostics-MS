import { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/session";
import {
  getRequestId,
  handleApiError,
  jsonOk,
  verifyCsrfAndOrigin,
} from "@/lib/http";
import { transitionOrderItemStatus } from "@/modules/orders/service";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    verifyCsrfAndOrigin(req, actor);
    const { id, itemId } = await context.params;
    const res = await transitionOrderItemStatus(
      actor,
      id,
      itemId,
      await req.json(),
    );
    return jsonOk(res, requestId);
  } catch (err) {
    return handleApiError(err, req);
  }
}

