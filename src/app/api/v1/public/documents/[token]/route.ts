import { NextRequest, NextResponse } from "next/server";
import { getClientIp, handleApiError } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolvePublicShareTokenDocument } from "@/modules/reports/service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const ip = getClientIp(req);
    checkRateLimit({
      bucket: "public:documents",
      identifier: ip,
      limit: 25,
      windowMs: 15 * 60 * 1000,
    });

    const { token } = await context.params;
    const { buffer, mimeType, filename } = await resolvePublicShareTokenDocument({
      rawToken: token,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return handleApiError(err, req);
  }
}

