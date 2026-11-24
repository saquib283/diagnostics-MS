import { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/session";
import { getRequestId, handleApiError, jsonOk } from "@/lib/http";
import { getInvoiceDetail } from "@/modules/billing/service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    const { id } = await context.params;
    return jsonOk(await getInvoiceDetail(actor, id), requestId);
  } catch (err) {
    return handleApiError(err, req);
  }
}

