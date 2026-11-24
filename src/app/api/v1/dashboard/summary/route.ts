import { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/session";
import { getRequestId, handleApiError, jsonOk } from "@/lib/http";
import { getDashboardSummary } from "@/modules/analytics/service";

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    const sp = req.nextUrl.searchParams;
    const from = sp.get("from") ? new Date(sp.get("from")!) : undefined;
    const to = sp.get("to") ? new Date(sp.get("to")!) : undefined;
    return jsonOk(await getDashboardSummary(actor, { from, to }), requestId);
  } catch (err) {
    return handleApiError(err, req);
  }
}

