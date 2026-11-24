import { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/session";
import {
  getRequestId,
  handleApiError,
  jsonOk,
  verifyCsrfAndOrigin,
} from "@/lib/http";
import {
  getOrganizationWithSettings,
  updateOrganizationWithSettings,
} from "@/modules/organization/service";

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    const data = await getOrganizationWithSettings(actor);
    return jsonOk(data, requestId);
  } catch (err) {
    return handleApiError(err, req);
  }
}

export async function PATCH(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    verifyCsrfAndOrigin(req, actor);
    const updated = await updateOrganizationWithSettings(actor, await req.json());
    return jsonOk(updated, requestId);
  } catch (err) {
    return handleApiError(err, req);
  }
}

