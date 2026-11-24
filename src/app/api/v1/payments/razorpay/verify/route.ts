import { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/session";
import {
  getRequestId,
  handleApiError,
  jsonOk,
  verifyCsrfAndOrigin,
} from "@/lib/http";
import { verifyAndCaptureRazorpayCheckout } from "@/modules/razorpay/service";

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    verifyCsrfAndOrigin(req, actor);
    const res = await verifyAndCaptureRazorpayCheckout(actor, await req.json());
    return jsonOk(res, requestId);
  } catch (err) {
    return handleApiError(err, req);
  }
}

