import { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/session";
import {
  getRequestId,
  handleApiError,
  jsonOk,
  verifyCsrfAndOrigin,
} from "@/lib/http";
import {
  createTestCategory,
  listTestCategories,
} from "@/modules/catalogue/service";

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    return jsonOk(await listTestCategories(actor), requestId);
  } catch (err) {
    return handleApiError(err, req);
  }
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    verifyCsrfAndOrigin(req, actor);
    const created = await createTestCategory(actor, await req.json());
    return jsonOk(created, requestId, 201);
  } catch (err) {
    return handleApiError(err, req);
  }
}

