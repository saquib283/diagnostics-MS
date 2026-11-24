export type SystemRoleCode =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "RECEPTIONIST"
  | "ACCOUNTANT"
  | "REPORT_MANAGER"
  | "VIEWER_AUDITOR"
  | "PARTNER_ADMIN"
  | "PARTNER_STAFF"
  | "PARTNER_REPORT_MANAGER";

export type PermissionCode =
  | "org:settings:manage"
  | "users:manage"
  | "patients:read"
  | "patients:write"
  | "catalogue:read"
  | "catalogue:manage"
  | "partners:read"
  | "partners:manage"
  | "pricing:manage"
  | "orders:read"
  | "orders:create"
  | "orders:amend"
  | "orders:status:update"
  | "orders:completion:approve"
  | "invoices:read"
  | "invoices:issue"
  | "invoices:adjust"
  | "invoices:share"
  | "payments:read"
  | "payments:collect"
  | "payments:reconcile"
  | "refunds:read"
  | "refunds:initiate"
  | "refunds:approve"
  | "reports:read"
  | "reports:upload"
  | "reports:download"
  | "reports:share"
  | "settlements:read"
  | "settlements:prepare"
  | "settlements:approve"
  | "settlements:pay"
  | "settlements:reverse"
  | "accounting:manage"
  | "reports:finance"
  | "audit:read"
  | "partner:orders:read"
  | "partner:orders:status"
  | "partner:reports:upload"
  | "partner:settlements:read"
  | "partner:users:manage"
  | "partner:profile:read";

export interface ActorContext {
  readonly userId: string;
  readonly email: string;
  readonly fullName: string;
  readonly portalType: "CONSULTANCY" | "PARTNER";
  readonly roles: readonly SystemRoleCode[];
  readonly permissions: readonly PermissionCode[];
  readonly partnerIds: readonly string[];
  readonly sessionId?: string;
  readonly csrfToken?: string;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
}

export interface PartnerScopeContext {
  readonly portal: "PARTNER";
  readonly userId: string;
  readonly partnerIds: readonly [string, ...string[]];
  readonly roles: readonly SystemRoleCode[];
  readonly permissions: readonly PermissionCode[];
}

