import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    APP_TIMEZONE: z.string().default("Asia/Kolkata"),
    DATABASE_URL: z
      .string()
      .min(1, "DATABASE_URL is required")
      .default("postgresql://postgres:postgres@127.0.0.1:5432/dcms?schema=public"),
    SESSION_SECRET: z
      .string()
      .min(32, "SESSION_SECRET must be at least 32 characters")
      .default("dev-only-session-secret-minimum-32-chars-change-in-prod"),
    SESSION_COOKIE_NAME: z.string().default("dcms_session"),
    SESSION_IDLE_TIMEOUT_HOURS: z.coerce.number().int().positive().default(12),
    SESSION_ABSOLUTE_TIMEOUT_DAYS: z.coerce.number().int().positive().default(7),

    STORAGE_DRIVER: z.enum(["s3", "local_private"]).default("local_private"),
    LOCAL_PRIVATE_STORAGE_DIR: z.string().default(".private-storage"),
    S3_REGION: z.string().default("ap-south-1"),
    S3_ENDPOINT: z.string().optional(),
    S3_BUCKET_NAME: z.string().default("dcms-private-documents"),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: z
      .string()
      .transform((v) => v === "true")
      .default("false"),
    S3_PRESIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),
    MAX_REPORT_UPLOAD_MB: z.coerce.number().int().positive().max(100).default(20),

    RAZORPAY_ENABLED: z
      .string()
      .transform((v) => v === "true")
      .default("false"),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
    RAZORPAY_DYNAMIC_QR_ENABLED: z
      .string()
      .transform((v) => v === "true")
      .default("false"),
    RAZORPAY_QR_TTL_SECONDS: z.coerce.number().int().min(120).max(3600).default(600),

    WHATSAPP_PROVIDER: z.enum(["disabled", "meta_cloud"]).default("disabled"),
    WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
    WHATSAPP_ACCESS_TOKEN: z.string().optional(),
    WHATSAPP_API_BASE_URL: z.string().default("https://graph.facebook.com/v21.0"),

    EMAIL_PROVIDER: z.enum(["disabled", "smtp"]).default("disabled"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: z
      .string()
      .transform((v) => v === "true")
      .default("false"),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    EMAIL_FROM_ADDRESS: z.string().default("billing@example-diagnostics.in"),
    EMAIL_FROM_NAME: z.string().default("Diagnostic Consultancy Billing"),

    CLAMAV_ENABLED: z
      .string()
      .transform((v) => v === "true")
      .default("false"),
    CLAMAV_HOST: z.string().default("127.0.0.1"),
    CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
  })
  .superRefine((val, ctx) => {
    const isNextBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
    const isLoopbackPreview =
      val.NEXT_PUBLIC_APP_URL.startsWith("http://localhost") ||
      val.NEXT_PUBLIC_APP_URL.startsWith("http://127.0.0.1");
    if (val.NODE_ENV === "production" && !isNextBuildPhase) {
      if (val.SESSION_SECRET.includes("dev-only") || val.SESSION_SECRET.includes("CHANGE_ME")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SESSION_SECRET"],
          message: "Production requires a strong non-placeholder SESSION_SECRET.",
        });
      }
      if (!isLoopbackPreview && val.STORAGE_DRIVER !== "s3") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STORAGE_DRIVER"],
          message: "Production requires STORAGE_DRIVER=s3 for private object storage.",
        });
      }
      if (val.RAZORPAY_ENABLED && (!val.RAZORPAY_KEY_ID || !val.RAZORPAY_KEY_SECRET || !val.RAZORPAY_WEBHOOK_SECRET)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["RAZORPAY_KEY_SECRET"],
          message: "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET are required when RAZORPAY_ENABLED=true.",
        });
      }
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }
  return cachedEnv;
}

export function resetEnvCacheForTests(): void {
  cachedEnv = null;
}
