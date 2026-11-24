import { NextRequest } from "next/server";
import { requireActor } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import {
  getRequestId,
  handleApiError,
  jsonOk,
  verifyCsrfAndOrigin,
} from "@/lib/http";
import { uploadDiagnosticReportForOrderItem } from "@/modules/reports/service";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ itemId: string }> },
) {
  const requestId = getRequestId(req);
  try {
    const actor = await requireActor(req);
    verifyCsrfAndOrigin(req, actor);
    const { itemId } = await context.params;

    const formData = await req.formData();
    const file = formData.get("file");
    const notes = formData.get("notes")?.toString() ?? null;

    if (!(file instanceof File)) {
      throw new AppError("BAD_REQUEST", "Attach a report file under the 'file' field.", 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const created = await uploadDiagnosticReportForOrderItem({
      actor,
      orderItemId: itemId,
      filename: file.name,
      declaredMimeType: file.type,
      buffer: Buffer.from(arrayBuffer),
      notes,
    });

    return jsonOk(created, requestId, 201);
  } catch (err) {
    return handleApiError(err, req);
  }
}

