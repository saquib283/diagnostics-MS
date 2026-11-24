import { NextRequest } from "next/server";
import { InvoiceStatus } from "@prisma/client";
import { requireActor } from "@/lib/auth/session";
import {
  getRequestId,
  handleApiError,
  jsonPaginated,
} from "@/lib/http";
import { listInvoices } from "@/modules/billing/service";

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    const sp = req.nextUrl.searchParams;
    const res = await listInvoices(actor, {
      status: (sp.get("status") as InvoiceStatus | null) ?? undefined,
      partnerId: sp.get("partnerId") ?? undefined,
      patientId: sp.get("patientId") ?? undefined,
      page: sp.get("page") ? Number(sp.get("page")) : 1,
      pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : 25,
    });
    return jsonPaginated({
      data: res.items,
      page: res.page,
      pageSize: res.pageSize,
      totalItems: res.totalItems,
      requestId,
    });
  } catch (err) {
    return handleApiError(err, req);
  }
}

