import { NextRequest, NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/session";
import { handleApiError } from "@/lib/http";
import { generateFinancialExcelExport } from "@/modules/analytics/service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ reportType: string }> },
) {
  try {
    const actor = await requireActor(req);
    const { reportType } = await context.params;
    const { buffer, filename } = await generateFinancialExcelExport(
      actor,
      reportType,
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return handleApiError(err, req);
  }
}

