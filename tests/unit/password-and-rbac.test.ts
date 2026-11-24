import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  hasPermission,
  requirePermission,
  ROLE_PERMISSIONS,
} from "@/lib/permissions/rbac";
import {
  requirePartnerScope,
  assertPartnerOwnsRecord,
  maskIndianMobile,
} from "@/lib/permissions/scope";
import type { ActorContext } from "@/lib/permissions/types";

describe("Password Cryptography (scrypt + constant-time compare)", () => {
  it("hashes passwords with unique random salts and verifies accurately", async () => {
    const hash1 = await hashPassword("Clinical#Erp2026!");
    const hash2 = await hashPassword("Clinical#Erp2026!");
    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword("Clinical#Erp2026!", hash1)).toBe(true);
    expect(await verifyPassword("WrongPassword123!", hash1)).toBe(false);
  });
});

describe("RBAC Permission Matrix & Partner Row-Level Scope Guards", () => {
  const receptionist: ActorContext = {
    userId: "00000000-0000-0000-0000-000000000001",
    email: "reception@demo.local",
    fullName: "Demo Receptionist",
    portalType: "CONSULTANCY",
    roles: ["RECEPTIONIST"],
    permissions: ROLE_PERMISSIONS.RECEPTIONIST,
    partnerIds: [],
  };

  const partnerAUser: ActorContext = {
    userId: "00000000-0000-0000-0000-000000000002",
    email: "lab-a@demo.local",
    fullName: "Partner A Lab Manager",
    portalType: "PARTNER",
    roles: ["PARTNER_REPORT_MANAGER"],
    permissions: ROLE_PERMISSIONS.PARTNER_REPORT_MANAGER,
    partnerIds: ["11111111-1111-1111-1111-111111111111"],
  };

  it("permits Receptionist to register patients, issue invoices, and collect payments, but blocks settlements & refunds", () => {
    expect(hasPermission(receptionist, "patients:write")).toBe(true);
    expect(hasPermission(receptionist, "orders:create")).toBe(true);
    expect(hasPermission(receptionist, "invoices:issue")).toBe(true);
    expect(hasPermission(receptionist, "payments:collect")).toBe(true);
    expect(hasPermission(receptionist, "settlements:approve")).toBe(false);
    expect(hasPermission(receptionist, "refunds:initiate")).toBe(false);
    expect(() => requirePermission(receptionist, "settlements:approve")).toThrow(
      /FORBIDDEN/,
    );
  });

  it("blocks Partner users from global consultancy permissions (invoices, pricing, global patients)", () => {
    expect(hasPermission(partnerAUser, "invoices:issue")).toBe(false);
    expect(hasPermission(partnerAUser, "pricing:manage")).toBe(false);
    expect(hasPermission(partnerAUser, "patients:write")).toBe(false);
    expect(hasPermission(partnerAUser, "partner:reports:upload")).toBe(true);
  });

  it("enforces strict PartnerScopeContext and prevents cross-partner IDOR with 404 semantics", () => {
    const scope = requirePartnerScope(partnerAUser);
    expect(scope.partnerIds).toEqual(["11111111-1111-1111-1111-111111111111"]);

    expect(() =>
      assertPartnerOwnsRecord(scope, "11111111-1111-1111-1111-111111111111"),
    ).not.toThrow();

    expect(() =>
      assertPartnerOwnsRecord(scope, "22222222-2222-2222-2222-222222222222"),
    ).toThrow(/NOT_FOUND/);

    expect(() => requirePartnerScope(receptionist)).toThrow(/FORBIDDEN/);
  });

  it("masks patient mobile numbers for partner portal when MASKED policy is active", () => {
    expect(maskIndianMobile("+919876543210")).toBe("+91******3210");
    expect(maskIndianMobile("09820112233")).toBe("*******2233");
  });
});

