import { NextRequest } from "next/server";
import {
  getClientIp,
  getRequestId,
  handleApiError,
  jsonOk,
  verifyCsrfAndOrigin,
} from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  resetPasswordSchema,
  resetPasswordWithToken,
} from "@/modules/auth/service";

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    verifyCsrfAndOrigin(req, null);
    const ip = getClientIp(req);
    checkRateLimit({
      bucket: "auth:reset",
      identifier: ip,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    const body = resetPasswordSchema.parse(await req.json());
    await resetPasswordWithToken({
      rawToken: body.token,
      newPassword: body.newPassword,
      ipAddress: ip,
    });

    return jsonOk({ reset: true }, requestId);
  } catch (err) {
    return handleApiError(err, req);
  }
}

