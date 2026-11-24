"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Building2,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { apiRequest } from "@/lib/client/api";
import { Button, cn } from "@/components/ui/primitives";

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

const ADMIN_NAV_GROUPS: Array<{ heading: string; items: NavItem[] }> = [
  {
    heading: "Operations",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", Icon: LayoutDashboard },
      { href: "/admin/patients", label: "Patients", Icon: Users },
      { href: "/admin/orders", label: "Diagnostic Orders", Icon: ClipboardList },
      { href: "/admin/invoices", label: "Invoices & Bills", Icon: Receipt },
      { href: "/admin/payments", label: "Payments & QR", Icon: CreditCard },
      { href: "/admin/reports", label: "Lab Reports", Icon: FileText },
    ],
  },
  {
    heading: "Catalogue & Network",
    items: [
      { href: "/admin/tests", label: "Test Catalogue", Icon: FlaskConical },
      { href: "/admin/packages", label: "Test Packages", Icon: Package },
      { href: "/admin/partners", label: "Partner Centres", Icon: Building2 },
    ],
  },
  {
    heading: "Finance & Governance",
    items: [
      { href: "/admin/settlements", label: "Partner Settlements", Icon: Landmark },
      { href: "/admin/accounting", label: "Accounting & Exports", Icon: FileSpreadsheet },
      { href: "/admin/users", label: "Users & Roles", Icon: ShieldCheck },
      { href: "/admin/audit", label: "Audit Trail", Icon: Activity },
      { href: "/admin/settings", label: "Settings & Policies", Icon: Settings },
    ],
  },
];

const PARTNER_NAV_ITEMS: NavItem[] = [
  { href: "/partner/dashboard", label: "Centre Overview", Icon: LayoutDashboard },
  { href: "/partner/orders", label: "Assigned Orders", Icon: ClipboardList },
  { href: "/partner/reports", label: "Report Uploads", Icon: FileText },
  { href: "/partner/settlements", label: "Settlement Statements", Icon: Landmark },
  { href: "/partner/users", label: "Centre Staff", Icon: Users },
  { href: "/partner/profile", label: "Centre Profile", Icon: Building2 },
];

export function PortalShell({
  portal,
  actorName,
  actorRoles,
  csrfToken,
  partnerBanner,
  children,
}: {
  portal: "CONSULTANCY" | "PARTNER";
  actorName: string;
  actorRoles: readonly string[];
  csrfToken?: string;
  partnerBanner?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  async function handleSignOut() {
    try {
      await apiRequest("/api/v1/auth/logout", {
        method: "POST",
        csrfToken,
      });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      <a href="#main-content" className="skip-link visually-hidden">
        Skip to main content
      </a>

      <header className="sticky top-0 z-30 flex h-13 items-center justify-between gap-2 border-b border-[#CBD5E1] bg-white px-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            aria-expanded={mobileNavOpen}
            aria-controls="primary-sidebar-nav"
            aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMobileNavOpen((prev) => !prev)}
            className="inline-flex lg:hidden h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer"
          >
            {mobileNavOpen ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Menu className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <span className="inline-flex h-7 shrink-0 items-center rounded-[4px] bg-[#1B365D] px-2 text-xs font-semibold text-white">
            {portal === "PARTNER" ? "DCMS PARTNER" : "DCMS ERP"}
          </span>
          <span className="truncate text-sm font-semibold text-[#0F172A]">
            {portal === "PARTNER"
              ? (partnerBanner ?? "Partner Diagnostic Centre Portal")
              : "Diagnostic Consultancy Operations & Finance"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-xs font-semibold text-[#0F172A]">
              {actorName}
            </span>
            <span className="text-[11px] text-[#475569]">
              {actorRoles.join(", ").replace(/_/g, " ")}
            </span>
          </div>
          <Button variant="secondary" size="sm" onClick={handleSignOut}>
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Sign out</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <nav
          id="primary-sidebar-nav"
          aria-label="Primary"
          className={cn(
            "w-full lg:w-58 shrink-0 border-b lg:border-b-0 lg:border-r border-[#CBD5E1] bg-[#F1F5F9] p-3",
            mobileNavOpen ? "block" : "hidden lg:block",
          )}
        >
          {portal === "CONSULTANCY" ? (
            <div className="space-y-4">
              {ADMIN_NAV_GROUPS.map((group) => (
                <div key={group.heading}>
                  <p className="px-2 pb-1 text-xs font-semibold text-[#475569] m-0">
                    {group.heading}
                  </p>
                  <ul className="space-y-0.5 list-none p-0 m-0" role="list">
                    {group.items.map(({ href, label, Icon }) => {
                      const active =
                        pathname === href || pathname.startsWith(`${href}/`);
                      return (
                        <li key={href}>
                          <Link
                            href={href}
                            onClick={() => setMobileNavOpen(false)}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "flex items-center gap-2 rounded-[4px] px-2.5 py-1.5 text-[13px] font-medium no-underline transition-colors",
                              active
                                ? "bg-[#1B365D] text-white"
                                : "text-[#334155] hover:bg-[#E2E8F0] hover:text-[#0F172A]",
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" aria-hidden={true} />
                            <span>{label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="space-y-0.5 list-none p-0 m-0" role="list">
              {PARTNER_NAV_ITEMS.map(({ href, label, Icon }) => {
                const active =
                  pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setMobileNavOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-[4px] px-2.5 py-1.5 text-[13px] font-medium no-underline",
                        active
                          ? "bg-[#1B365D] text-white"
                          : "text-[#334155] hover:bg-[#E2E8F0] hover:text-[#0F172A]",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden={true} />
                      <span>{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        <main className="flex-1 min-w-0 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

