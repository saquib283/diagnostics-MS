import { NextRequest, NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/session";
import { handleApiError } from "@/lib/http";
import { getInvoiceOrStatementPdfBuffer } from "@/modules/billing/service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor(req);
    const { id } = await context.params;
    const kind =
      req.nextUrl.searchParams.get("kind") === "statement"
        ? "statement"
        : "invoice";
    const { buffer, filename } = await getInvoiceOrStatementPdfBuffer(
      actor,
      id,
      kind,
    );

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

