import { NextRequest, NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/session";
import { handleApiError } from "@/lib/http";
import { getSettlementPdfBuffer } from "@/modules/settlements/service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor(req);
    const { id } = await context.params;
    const { buffer, filename } = await getSettlementPdfBuffer(actor, id);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return handleApiError(err, req);
  }
}

