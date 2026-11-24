import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { ActorContext } from "@/lib/permissions/types";

export function getRequestId(req?: NextRequest): string {
  return req?.headers.get("x-request-id")?.trim() || `req_${randomUUID()}`;
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.headers.get("x-real-ip")?.trim() || "127.0.0.1";
}

export function verifyCsrfAndOrigin(req: NextRequest, actor?: ActorContext | null): void {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return;
  }

  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new AppError("FORBIDDEN", "Malformed Origin header.", 403);
    }
    if (originHost !== host) {
      throw new AppError("FORBIDDEN", "Cross-origin state-changing request blocked.", 403);
    }
  }

  if (actor?.csrfToken) {
    const headerToken = req.headers.get("x-csrf-token") ?? "";
    const a = Buffer.from(headerToken, "utf8");
    const b = Buffer.from(actor.csrfToken, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new AppError("FORBIDDEN", "Invalid or missing X-CSRF-Token header.", 403);
    }
  }
}

export function jsonOk<T>(data: T, requestId?: string, status = 200): NextResponse {
  return NextResponse.json(
    {
      data,
      meta: { requestId: requestId ?? `req_${randomUUID()}` },
    },
    { status },
  );
}

export function jsonPaginated<T>(params: {
  data: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  requestId?: string;
}): NextResponse {
  const totalPages = Math.max(1, Math.ceil(params.totalItems / params.pageSize));
  return NextResponse.json({
    data: params.data,
    meta: {
      page: params.page,
      pageSize: params.pageSize,
      totalItems: params.totalItems,
      totalPages,
      requestId: params.requestId ?? `req_${randomUUID()}`,
    },
  });
}

export function handleApiError(err: unknown, req?: NextRequest): NextResponse {
  const requestId = getRequestId(req);

  if (err instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: err.code,
          message: err.cleanMessage,
          details: err.details,
          requestId,
        },
      },
      { status: err.statusCode },
    );
  }

  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
          details: err.issues.map((issue) => ({
            field: issue.path.join("."),
            issue: issue.message,
          })),
          requestId,
        },
      },
      { status: 422 },
    );
  }

  logger.error("unhandled_api_error", {
    requestId,
    path: req?.nextUrl.pathname,
    errorMessage: err instanceof Error ? err.message : String(err),
  });

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected server error occurred.",
        requestId,
      },
    },
    { status: 500 },
  );
}

