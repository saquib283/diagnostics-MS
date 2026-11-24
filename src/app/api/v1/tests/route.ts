import { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/session";
import {
  getRequestId,
  handleApiError,
  jsonOk,
  verifyCsrfAndOrigin,
} from "@/lib/http";
import { createTest, listTests } from "@/modules/catalogue/service";

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    const sp = req.nextUrl.searchParams;
    const items = await listTests(actor, {
      q: sp.get("q") ?? undefined,
      categoryId: sp.get("categoryId") ?? undefined,
      activeOnly: sp.get("activeOnly") === "true",
    });
    return jsonOk(items, requestId);
  } catch (err) {
    return handleApiError(err, req);
  }
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    verifyCsrfAndOrigin(req, actor);
    const created = await createTest(actor, await req.json());
    return jsonOk(created, requestId, 201);
  } catch (err) {
    return handleApiError(err, req);
  }
}

