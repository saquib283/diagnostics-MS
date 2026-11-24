import { NextRequest, NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/session";
import { handleApiError } from "@/lib/http";
import { downloadAuthorizedReportFile } from "@/modules/reports/service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ fileId: string }> },
) {
  try {
    const actor = await requireActor(req);
    const { fileId } = await context.params;
    const { buffer, mimeType, filename } = await downloadAuthorizedReportFile(
      actor,
      fileId,
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return handleApiError(err, req);
  }
}

