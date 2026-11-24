import { AppError } from "@/lib/errors";
import type { ActorContext, PartnerScopeContext } from "./types";

/**
 * Extracts a verified, non-empty PartnerScopeContext for Partner Portal calls.
 * Rejects Consultancy users or Partner users with zero active partner memberships.
 */
export function requirePartnerScope(actor: ActorContext): PartnerScopeContext {
  if (actor.portalType !== "PARTNER" || actor.partnerIds.length === 0) {
    throw new AppError(
      "FORBIDDEN",
      "Active partner diagnostic centre membership is required.",
      403,
    );
  }
  const [firstPartnerId, ...rest] = actor.partnerIds;
  if (!firstPartnerId) {
    throw new AppError("FORBIDDEN", "No active partner scope assigned.", 403);
  }
  return {
    portal: "PARTNER",
    userId: actor.userId,
    partnerIds: [firstPartnerId, ...rest],
    roles: actor.roles,
    permissions: actor.permissions,
  };
}

/**
 * Prevents cross-partner IDOR by verifying ownership and returning 404 NOT_FOUND
 * (never leaking whether a foreign UUID exists in another partner centre).
 */
export function assertPartnerOwnsRecord(
  scope: PartnerScopeContext,
  recordPartnerId: string | null | undefined,
): void {
  if (!recordPartnerId || !scope.partnerIds.includes(recordPartnerId)) {
    throw new AppError("NOT_FOUND", "Requested record was not found.", 404);
  }
}

/**
 * Masks an Indian or international phone string while keeping country prefix
 * (+91) and trailing 4 digits visible for counter/appointment verification.
 */
export function maskIndianMobile(mobile: string): string {
  const trimmed = mobile.trim();
  if (trimmed.length <= 4) {
    return "****";
  }
  if (trimmed.startsWith("+91") && trimmed.length >= 10) {
    const suffix = trimmed.slice(-4);
    const middleLen = Math.max(4, trimmed.length - 3 - 4);
    return `+91${"*".repeat(middleLen)}${suffix}`;
  }
  const suffix = trimmed.slice(-4);
  const maskLen = Math.max(4, trimmed.length - 4);
  return `${"*".repeat(maskLen)}${suffix}`;
}

