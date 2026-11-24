import { AppError } from "@/lib/errors";

interface WindowEntry {
  timestamps: number[];
}

const buckets = new Map<string, WindowEntry>();

export function checkRateLimit(params: {
  bucket: string;
  identifier: string;
  limit: number;
  windowMs: number;
}): { remaining: number } {
  const compositeKey = `${params.bucket}:${params.identifier}`;
  const now = Date.now();
  const cutoff = now - params.windowMs;
  const entry = buckets.get(compositeKey) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);

  if (entry.timestamps.length >= params.limit) {
    buckets.set(compositeKey, entry);
    throw new AppError(
      "RATE_LIMITED",
      "Too many requests. Please wait before trying again.",
      429,
    );
  }

  entry.timestamps.push(now);
  buckets.set(compositeKey, entry);
  return { remaining: Math.max(0, params.limit - entry.timestamps.length) };
}

export function resetRateLimitBucketsForTests(): void {
  buckets.clear();
}

