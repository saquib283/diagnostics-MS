import { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/session";
import { getRequestId, handleApiError, jsonOk } from "@/lib/http";
import { getPartnerPortalOrderDetail } from "@/modules/orders/service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    const { id } = await context.params;
    return jsonOk(await getPartnerPortalOrderDetail(actor, id), requestId);
  } catch (err) {
    return handleApiError(err, req);
  }
}

