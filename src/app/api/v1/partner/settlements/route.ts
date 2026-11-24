import { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/session";
import { getRequestId, handleApiError, jsonOk } from "@/lib/http";
import { listPartnerPortalSettlements } from "@/modules/settlements/service";

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    return jsonOk(await listPartnerPortalSettlements(actor), requestId);
  } catch (err) {
    return handleApiError(err, req);
  }
}

