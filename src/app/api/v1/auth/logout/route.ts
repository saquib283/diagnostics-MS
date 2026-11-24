import { NextRequest } from "next/server";
import { clearSessionCookie, requireActor } from "@/lib/auth/session";
import {
  getRequestId,
  handleApiError,
  jsonOk,
  verifyCsrfAndOrigin,
} from "@/lib/http";
import { logoutActor } from "@/modules/auth/service";

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    verifyCsrfAndOrigin(req, actor);
    await logoutActor(actor);
    await clearSessionCookie();
    return jsonOk({ loggedOut: true }, requestId);
  } catch (err) {
    return handleApiError(err, req);
  }
}

