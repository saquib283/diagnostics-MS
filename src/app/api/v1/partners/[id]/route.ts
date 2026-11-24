import { NextRequest } from "next/server";
import { z } from "zod";
import { PartnerStatus } from "@prisma/client";
import { requireActor } from "@/lib/auth/session";
import {
  getRequestId,
  handleApiError,
  jsonOk,
  verifyCsrfAndOrigin,
} from "@/lib/http";
import {
  getPartnerDetail,
  updatePartnerStatus,
} from "@/modules/partners/service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    const { id } = await context.params;
    return jsonOk(await getPartnerDetail(actor, id), requestId);
  } catch (err) {
    return handleApiError(err, req);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    verifyCsrfAndOrigin(req, actor);
    const { id } = await context.params;
    const { status } = z
      .object({ status: z.nativeEnum(PartnerStatus) })
      .parse(await req.json());
    return jsonOk(await updatePartnerStatus(actor, id, status), requestId);
  } catch (err) {
    return handleApiError(err, req);
  }
}

