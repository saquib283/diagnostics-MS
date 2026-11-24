import { NextRequest } from "next/server";
import { CommercialModel } from "@prisma/client";
import { requireActor } from "@/lib/auth/session";
import { withIdempotency } from "@/lib/db/sequences";
import { AppError } from "@/lib/errors";
import {
  getRequestId,
  handleApiError,
  jsonOk,
  verifyCsrfAndOrigin,
} from "@/lib/http";
import {
  createPartnerSettlement,
  listSettlements,
  previewEligibleSettlementItems,
} from "@/modules/settlements/service";

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    const sp = req.nextUrl.searchParams;

    if (sp.get("preview") === "true") {
      const partnerId = sp.get("partnerId");
      const commercialModel = sp.get("commercialModel") as CommercialModel | null;
      const periodStart = sp.get("periodStart");
      const periodEnd = sp.get("periodEnd");
      if (!partnerId || !commercialModel || !periodStart || !periodEnd) {
        throw new AppError(
          "BAD_REQUEST",
          "partnerId, commercialModel, periodStart, and periodEnd are required for eligibility preview.",
          400,
        );
      }
      const items = await previewEligibleSettlementItems(actor, {
        partnerId,
        commercialModel,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
      });
      return jsonOk(items, requestId);
    }

    return jsonOk(await listSettlements(actor), requestId);
  } catch (err) {
    return handleApiError(err, req);
  }
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    verifyCsrfAndOrigin(req, actor);
    const body = await req.json();

    const idem = await withIdempotency({
      key: req.headers.get("idempotency-key"),
      actorId: actor.userId,
      route: "POST:/settlements",
      requestPayload: body,
      statusCode: 201,
      execute: () => createPartnerSettlement(actor, body),
    });

    return jsonOk(idem.data, requestId, idem.statusCode);
  } catch (err) {
    return handleApiError(err, req);
  }
}

