import { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/session";
import {
  getRequestId,
  handleApiError,
  jsonOk,
  verifyCsrfAndOrigin,
} from "@/lib/http";
import { revokeShareToken } from "@/modules/billing/service";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ tokenId: string }> },
) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    verifyCsrfAndOrigin(req, actor);
    const { tokenId } = await context.params;
    const res = await revokeShareToken(actor, tokenId);
    return jsonOk(res, requestId);
  } catch (err) {
    return handleApiError(err, req);
  }
}

