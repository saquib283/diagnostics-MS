import { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  getRequestId,
  handleApiError,
  jsonOk,
  verifyCsrfAndOrigin,
} from "@/lib/http";
import { requirePermission } from "@/lib/permissions/rbac";
import { closeDynamicUpiQrSession } from "@/modules/razorpay/service";
import { evaluateQrSessionAvailability } from "@/modules/razorpay/signature";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ qrSessionId: string }> },
) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    requirePermission(actor, "payments:collect");
    const { qrSessionId } = await context.params;

    const qrSession = await db.paymentQrSession.findUnique({
      where: { id: qrSessionId },
      include: {
        payment: { include: { receipt: true } },
      },
    });
    if (!qrSession) {
      throw new AppError("NOT_FOUND", "QR session not found.", 404);
    }

    const availability = evaluateQrSessionAvailability(qrSession, new Date());
    return jsonOk({ qrSession, availability }, requestId);
  } catch (err) {
    return handleApiError(err, req);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ qrSessionId: string }> },
) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    verifyCsrfAndOrigin(req, actor);
    const { qrSessionId } = await context.params;
    const closed = await closeDynamicUpiQrSession(actor, qrSessionId);
    return jsonOk(closed, requestId);
  } catch (err) {
    return handleApiError(err, req);
  }
}

