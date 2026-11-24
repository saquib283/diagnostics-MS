import { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/session";
import {
  getRequestId,
  handleApiError,
  jsonOk,
  verifyCsrfAndOrigin,
} from "@/lib/http";
import {
  createOwnPartnerStaffUser,
  listOwnPartnerUsers,
} from "@/modules/users/service";

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    return jsonOk(await listOwnPartnerUsers(actor), requestId);
  } catch (err) {
    return handleApiError(err, req);
  }
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    verifyCsrfAndOrigin(req, actor);
    const created = await createOwnPartnerStaffUser(actor, await req.json());
    return jsonOk(created, requestId, 201);
  } catch (err) {
    return handleApiError(err, req);
  }
}

