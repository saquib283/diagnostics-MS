import { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/session";
import {
  getRequestId,
  handleApiError,
  jsonOk,
  jsonPaginated,
  verifyCsrfAndOrigin,
} from "@/lib/http";
import { createPatient, listPatients } from "@/modules/patients/service";

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    const sp = req.nextUrl.searchParams;
    const res = await listPatients(actor, {
      q: sp.get("q") ?? undefined,
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

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    verifyCsrfAndOrigin(req, actor);
    const created = await createPatient(actor, await req.json());
    return jsonOk(created, requestId, 201);
  } catch (err) {
    return handleApiError(err, req);
  }
}

