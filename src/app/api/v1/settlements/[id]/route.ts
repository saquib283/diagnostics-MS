import { NextRequest } from "next/server";
import { z } from "zod";
import { requireActor } from "@/lib/auth/session";
import {
  getRequestId,
  handleApiError,
  jsonOk,
  verifyCsrfAndOrigin,
} from "@/lib/http";
import {
  addPartnerSettlementAdjustment,
  approvePartnerSettlement,
  getSettlementDetail,
  recordAndAllocateSettlementPayment,
  reversePartnerSettlement,
} from "@/modules/settlements/service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    const { id } = await context.params;
    return jsonOk(await getSettlementDetail(actor, id), requestId);
  } catch (err) {
    return handleApiError(err, req);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    verifyCsrfAndOrigin(req, actor);
    const { id } = await context.params;
    const action = req.nextUrl.searchParams.get("action");

    if (action === "approve") {
      return jsonOk(await approvePartnerSettlement(actor, id), requestId);
    }

    if (action === "adjustment") {
      const adj = await addPartnerSettlementAdjustment(
        actor,
        id,
        await req.json(),
      );
      return jsonOk(adj, requestId, 201);
    }

    if (action === "reverse") {
      const { reason } = z
        .object({ reason: z.string().min(5) })
        .parse(await req.json());
      return jsonOk(
        await reversePartnerSettlement(actor, id, reason),
        requestId,
      );
    }

    const allocated = await recordAndAllocateSettlementPayment(
      actor,
      id,
      await req.json(),
    );
    return jsonOk(allocated, requestId, 201);
  } catch (err) {
    return handleApiError(err, req);
  }
}
