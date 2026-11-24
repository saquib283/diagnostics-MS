export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "IDEMPOTENCY_PAYLOAD_MISMATCH"
  | "OVERPAYMENT_NOT_ALLOWED"
  | "PRICE_WINDOW_OVERLAP"
  | "MODEL_B_INVOICE_PROHIBITED"
  | "MODEL_A_PARTNER_REF_PROHIBITED"
  | "INVOICE_IMMUTABLE"
  | "SETTLEMENT_LOCKED"
  | "POLICY_UNCONFIGURED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface ErrorDetail {
  field?: string;
  issue: string;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: readonly ErrorDetail[];

  constructor(
    code: ErrorCode,
    message: string,
    statusCode = 400,
    details?: readonly ErrorDetail[],
  ) {
    super(`${code}: ${message}`);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  public get cleanMessage(): string {
    return this.message.replace(`${this.code}: `, "");
  }
}

