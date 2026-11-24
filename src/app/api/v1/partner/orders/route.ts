import { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";
import { requireActor } from "@/lib/auth/session";
import {
  getRequestId,
  handleApiError,
  jsonPaginated,
} from "@/lib/http";
import { listOrdersForPartnerPortal } from "@/modules/orders/service";

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    const sp = req.nextUrl.searchParams;
    const res = await listOrdersForPartnerPortal(actor, {
      status: (sp.get("status") as OrderStatus | null) ?? undefined,
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

