import { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/session";
import {
  getRequestId,
  handleApiError,
  jsonOk,
  verifyCsrfAndOrigin,
} from "@/lib/http";
import {
  reconcileGatewayBatchToBank,
  reconcileStaticQrCollectionToInvoice,
} from "@/modules/razorpay/service";

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    verifyCsrfAndOrigin(req, actor);
    const kind = req.nextUrl.searchParams.get("kind");
    const body = await req.json();

    if (kind === "gateway-settlement") {
      const batch = await reconcileGatewayBatchToBank(actor, body);
      return jsonOk(batch, requestId, 201);
    }

    const res = await reconcileStaticQrCollectionToInvoice(actor, body);
    return jsonOk(res, requestId, 201);
  } catch (err) {
    return handleApiError(err, req);
  }
}

