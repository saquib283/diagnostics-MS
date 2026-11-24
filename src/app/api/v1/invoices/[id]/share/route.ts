import { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/session";
import {
  getRequestId,
  handleApiError,
  jsonOk,
  verifyCsrfAndOrigin,
} from "@/lib/http";
import { createAndShareDocumentLink } from "@/modules/billing/service";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    verifyCsrfAndOrigin(req, actor);
    const { id } = await context.params;
    const shared = await createAndShareDocumentLink(actor, id, await req.json());
    return jsonOk(shared, requestId, 201);
  } catch (err) {
    return handleApiError(err, req);
  }
}

