import { NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import {
  getClientIp,
  getRequestId,
  handleApiError,
  jsonOk,
  verifyCsrfAndOrigin,
} from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  forgotPasswordSchema,
  issuePasswordResetToken,
} from "@/modules/auth/service";
import { sendTransactionalEmail } from "@/modules/notifications/service";

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    verifyCsrfAndOrigin(req, null);
    const ip = getClientIp(req);
    checkRateLimit({
      bucket: "auth:forgot",
      identifier: ip,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    const { email } = forgotPasswordSchema.parse(await req.json());
    const result = await issuePasswordResetToken(email);

    if (result.issued && result.rawTokenForNotification && result.userId) {
      const env = getEnv();
      const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/reset-password?token=${encodeURIComponent(result.rawTokenForNotification)}`;
      await sendTransactionalEmail({
        recipientEmail: email,
        subject: "DCMS Password Reset Request",
        textBody: `A password reset was requested for your DCMS account.\n\nReset link (valid for 30 minutes):\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
        eventType: "PASSWORD_RESET",
        referenceType: "User",
        referenceId: result.userId,
      });
    }

    return jsonOk(
      {
        accepted: true,
        message:
          "If an active account matches that email, a password reset link has been dispatched.",
      },
      requestId,
    );
  } catch (err) {
    return handleApiError(err, req);
  }
}

