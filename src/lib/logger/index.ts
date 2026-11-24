const SENSITIVE_KEY_PATTERN =
  /password|secret|token|authorization|cookie|signature|card|cvv|cvc|otp|aadhaar|private_key/i;

export function redactSensitiveData(input: unknown, depth = 0): unknown {
  if (depth > 8 || input === null || input === undefined) {
    return input;
  }
  if (typeof input === "function") {
    return undefined;
  }
  if (typeof input === "bigint") {
    return input.toString();
  }
  if (typeof input !== "object") {
    return input;
  }
  if (input instanceof Date) {
    return input.toISOString();
  }
  if (typeof (input as { toJSON?: unknown }).toJSON === "function") {
    return redactSensitiveData(
      (input as { toJSON: () => unknown }).toJSON(),
      depth + 1,
    );
  }
  if (Array.isArray(input)) {
    return input.map((item) => redactSensitiveData(item, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (key === "constructor" || typeof value === "function") {
      continue;
    }
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      out[key] = "[REDACTED]";
    } else {
      out[key] = redactSensitiveData(value, depth + 1);
    }
  }
  return out;
}

export type LogLevel = "info" | "warn" | "error";

export function logEvent(
  level: LogLevel,
  event: string,
  context: Record<string, unknown> = {},
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(redactSensitiveData(context) as Record<string, unknown>),
  };
  const serialized = JSON.stringify(entry);
  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else if (process.env.NODE_ENV !== "test") {
    console.info(serialized);
  }
}

export const logger = {
  info: (event: string, ctx?: Record<string, unknown>) => logEvent("info", event, ctx),
  warn: (event: string, ctx?: Record<string, unknown>) => logEvent("warn", event, ctx),
  error: (event: string, ctx?: Record<string, unknown>) => logEvent("error", event, ctx),
};

