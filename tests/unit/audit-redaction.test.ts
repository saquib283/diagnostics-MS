import { describe, expect, it } from "vitest";
import { redactSensitiveData } from "@/lib/logger";

describe("Structured Log & Audit Payload Redaction", () => {
  it("recursively redacts passwords, API secrets, signatures, tokens, and card fields while preserving business IDs", () => {
    const raw = {
      orderId: "ORD-2026-00012",
      amount: "2000.00",
      password: "SuperSecretPassword!",
      passwordHash: "scrypt$...",
      razorpay_signature: "abcdef123456",
      headers: {
        authorization: "Bearer secret-jwt",
        "x-razorpay-signature": "hmac_sig_value",
      },
      nested: {
        apiSecret: "rzp_secret_999",
        cardNumber: "4111222233334444",
        status: "CAPTURED",
      },
    };

    const clean = redactSensitiveData(raw) as Record<string, unknown>;
    expect(clean.orderId).toBe("ORD-2026-00012");
    expect(clean.amount).toBe("2000.00");
    expect(clean.password).toBe("[REDACTED]");
    expect(clean.passwordHash).toBe("[REDACTED]");
    expect(clean.razorpay_signature).toBe("[REDACTED]");
    expect((clean.headers as Record<string, unknown>).authorization).toBe("[REDACTED]");
    expect((clean.headers as Record<string, unknown>)["x-razorpay-signature"]).toBe(
      "[REDACTED]",
    );
    expect((clean.nested as Record<string, unknown>).apiSecret).toBe("[REDACTED]");
    expect((clean.nested as Record<string, unknown>).cardNumber).toBe("[REDACTED]");
    expect((clean.nested as Record<string, unknown>).status).toBe("CAPTURED");
  });
});

