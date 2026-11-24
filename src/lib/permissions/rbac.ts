import { AppError } from "@/lib/errors";
import type { ActorContext, PermissionCode, SystemRoleCode } from "./types";

export const ALL_PERMISSIONS: readonly PermissionCode[] = [
  "org:settings:manage",
  "users:manage",
  "patients:read",
  "patients:write",
  "catalogue:read",
  "catalogue:manage",
  "partners:read",
  "partners:manage",
  "pricing:manage",
  "orders:read",
  "orders:create",
  "orders:amend",
  "orders:status:update",
  "orders:completion:approve",
  "invoices:read",
  "invoices:issue",
  "invoices:adjust",
  "invoices:share",
  "payments:read",
  "payments:collect",
  "payments:reconcile",
  "refunds:read",
  "refunds:initiate",
  "refunds:approve",
  "reports:read",
  "reports:upload",
  "reports:download",
  "reports:share",
  "settlements:read",
  "settlements:prepare",
  "settlements:approve",
  "settlements:pay",
  "settlements:reverse",
  "accounting:manage",
  "reports:finance",
  "audit:read",
  "partner:orders:read",
  "partner:orders:status",
  "partner:reports:upload",
  "partner:settlements:read",
  "partner:users:manage",
  "partner:profile:read",
] as const;

const CONSULTANCY_SUPER_ADMIN_PERMS: readonly PermissionCode[] = ALL_PERMISSIONS.filter(
  (p) => !p.startsWith("partner:"),
);

export const ROLE_PERMISSIONS: Record<SystemRoleCode, readonly PermissionCode[]> = {
  SUPER_ADMIN: CONSULTANCY_SUPER_ADMIN_PERMS,
  ADMIN: [
    "patients:read",
    "patients:write",
    "catalogue:read",
    "catalogue:manage",
    "partners:read",
    "partners:manage",
    "pricing:manage",
    "orders:read",
    "orders:create",
    "orders:amend",
    "orders:status:update",
    "orders:completion:approve",
    "invoices:read",
    "invoices:issue",
    "invoices:adjust",
    "invoices:share",
    "payments:read",
    "payments:collect",
    "payments:reconcile",
    "refunds:read",
    "refunds:approve",
    "reports:read",
    "reports:upload",
    "reports:download",
    "reports:share",
    "settlements:read",
    "settlements:approve",
    "settlements:reverse",
    "reports:finance",
    "audit:read",
  ],
  RECEPTIONIST: [
    "patients:read",
    "patients:write",
    "catalogue:read",
    "partners:read",
    "orders:read",
    "orders:create",
    "orders:status:update",
    "invoices:read",
    "invoices:issue",
    "invoices:share",
    "payments:read",
    "payments:collect",
    "reports:read",
    "reports:download",
    "reports:share",
  ],
  ACCOUNTANT: [
    "patients:read",
    "catalogue:read",
    "partners:read",
    "orders:read",
    "invoices:read",
    "invoices:issue",
    "invoices:adjust",
    "invoices:share",
    "payments:read",
    "payments:collect",
    "payments:reconcile",
    "refunds:read",
    "refunds:initiate",
    "settlements:read",
    "settlements:prepare",
    "settlements:pay",
    "accounting:manage",
    "reports:finance",
  ],
  REPORT_MANAGER: [
    "patients:read",
    "catalogue:read",
    "partners:read",
    "orders:read",
    "orders:status:update",
    "orders:completion:approve",
    "reports:read",
    "reports:upload",
    "reports:download",
    "reports:share",
  ],
  VIEWER_AUDITOR: [
    "patients:read",
    "catalogue:read",
    "partners:read",
    "orders:read",
    "invoices:read",
    "payments:read",
    "refunds:read",
    "reports:read",
    "settlements:read",
    "reports:finance",
    "audit:read",
  ],
  PARTNER_ADMIN: [
    "partner:orders:read",
    "partner:orders:status",
    "partner:reports:upload",
    "partner:settlements:read",
    "partner:users:manage",
    "partner:profile:read",
  ],
  PARTNER_STAFF: [
    "partner:orders:read",
    "partner:orders:status",
    "partner:profile:read",
  ],
  PARTNER_REPORT_MANAGER: [
    "partner:orders:read",
    "partner:orders:status",
    "partner:reports:upload",
    "partner:profile:read",
  ],
};

export function resolvePermissionsForRoles(
  roles: readonly SystemRoleCode[],
): PermissionCode[] {
  const set = new Set<PermissionCode>();
  for (const role of roles) {
    const perms = ROLE_PERMISSIONS[role] ?? [];
    for (const perm of perms) {
      set.add(perm);
    }
  }
  return Array.from(set);
}

export function hasPermission(actor: ActorContext, permission: PermissionCode): boolean {
  return actor.permissions.includes(permission);
}

export function requirePermission(
  actor: ActorContext,
  permission: PermissionCode,
): void {
  if (!hasPermission(actor, permission)) {
    throw new AppError(
      "FORBIDDEN",
      `Actor lacks required permission: ${permission}`,
      403,
    );
  }
}

export function requireAnyPermission(
  actor: ActorContext,
  permissions: readonly PermissionCode[],
): void {
  if (!permissions.some((p) => hasPermission(actor, p))) {
    throw new AppError(
      "FORBIDDEN",
      `Actor lacks required permissions: ${permissions.join(", ")}`,
      403,
    );
  }
}

export function requireConsultancyPortal(actor: ActorContext): void {
  if (actor.portalType !== "CONSULTANCY") {
    throw new AppError(
      "FORBIDDEN",
      "Endpoint is restricted to consultancy staff accounts.",
      403,
    );
  }
}

