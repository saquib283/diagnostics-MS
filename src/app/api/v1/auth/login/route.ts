import { NextRequest } from "next/server";
import { setSessionCookie } from "@/lib/auth/session";
import {
  getClientIp,
  getRequestId,
  handleApiError,
  jsonOk,
  verifyCsrfAndOrigin,
} from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { authenticateUser, loginSchema } from "@/modules/auth/service";

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    verifyCsrfAndOrigin(req, null);
    const ip = getClientIp(req);
    checkRateLimit({
      bucket: "auth:login",
      identifier: ip,
      limit: 12,
      windowMs: 15 * 60 * 1000,
    });

    const body = loginSchema.parse(await req.json());
    const result = await authenticateUser({
      email: body.email,
      password: body.password,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    await setSessionCookie(result.rawToken, result.expiresAt);

    return jsonOk(
      {
        user: result.user,
        csrfToken: result.csrfToken,
        redirectTo: result.redirectTo,
      },
      requestId,
    );
  } catch (err) {
    return handleApiError(err, req);
  }
}

