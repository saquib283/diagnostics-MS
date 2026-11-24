"use client";

export interface ApiClientError {
  code: string;
  message: string;
  details?: Array<{ field?: string; issue: string }>;
}

export async function apiRequest<T>(
  url: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    body?: unknown;
    csrfToken?: string;
    idempotencyKey?: string;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.csrfToken) {
    headers["X-CSRF-Token"] = options.csrfToken;
  }
  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  let fetchBody: BodyInit | undefined;
  if (options.body instanceof FormData) {
    fetchBody = options.body;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    fetchBody = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: fetchBody,
    credentials: "same-origin",
  });

  const payload = (await res.json()) as {
    data?: T;
    error?: ApiClientError;
  };

  if (!res.ok || payload.error) {
    const detailMsg = payload.error?.details
      ?.map((d) => (d.field ? `${d.field}: ${d.issue}` : d.issue))
      .join("; ");
    throw new Error(
      detailMsg
        ? `${payload.error?.message ?? "Request failed"} (${detailMsg})`
        : (payload.error?.message ?? `Request failed with HTTP ${res.status}`),
    );
  }

  return payload.data as T;
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

