"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowDownToLine,
  Award,
  CheckSquare,
  ClipboardList,
  GitBranch,
  Home,
  Layers,
  Scale,
  Settings,
  Shield,
  User,
  Users,
  Wallet,
} from "lucide-react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { LocaleToggle } from "./LocaleToggle";
import { Roll10Logo } from "./Roll10Logo";
import { SignOutButton } from "./SignOutButton";

interface AppShellProps {
  children: React.ReactNode;
  member: {
    memberCode: string;
    displayName: string;
    role: "MEMBER" | "ADMIN";
    currentPackageCode: string | null;
  };
  locale: Locale;
  t: Dictionary;
  sgtTimeLabel: string;
  mode?: "member" | "admin";
}

export function AppShell({
  children,
  member,
  locale,
  t,
  sgtTimeLabel,
  mode = "member",
}: AppShellProps) {
  const pathname = usePathname();
  const isAdmin = member.role === "ADMIN";

  const memberLinks = [
    { href: "/dashboard", label: t.nav.home, icon: Home },
    { href: "/tree", label: t.nav.team, icon: GitBranch },
    { href: "/packages", label: t.nav.packages, icon: Layers },
    { href: "/ledgers", label: t.nav.ledgers, icon: Award },
    { href: "/wallet", label: t.nav.wallet, icon: Wallet },
    { href: "/account", label: t.nav.account, icon: User },
  ];

  const adminLinks = [
    { href: "/admin/deposits", label: t.adminNav.deposits, icon: ArrowDownToLine },
    { href: "/admin/orders", label: t.adminNav.orders, icon: CheckSquare },
    { href: "/admin/upgrades", label: t.adminNav.upgrades, icon: Layers },
    { href: "/admin/ledgers", label: t.adminNav.ledgers, icon: Award },
    { href: "/admin/members", label: t.adminNav.members, icon: Users },
    { href: "/admin/withdrawals", label: t.adminNav.withdrawals, icon: Wallet },
    { href: "/admin/settlements", label: t.adminNav.settlements, icon: Activity },
    { href: "/admin/config", label: t.adminNav.config, icon: Settings },
    { href: "/admin/reconcile", label: t.adminNav.reconcile, icon: Scale },
    { href: "/admin/audit", label: t.adminNav.audit, icon: ClipboardList },
  ];

  const mobileBottomLinks =
    mode === "admin"
      ? [
          { href: "/admin/deposits", label: t.adminNav.deposits, icon: ArrowDownToLine, matchPrefix: ["/admin/deposits"] },
          { href: "/admin/orders", label: t.adminNav.orders, icon: CheckSquare, matchPrefix: ["/admin/orders"] },
          { href: "/admin/withdrawals", label: t.adminNav.withdrawals, icon: Wallet, matchPrefix: ["/admin/withdrawals"] },
          { href: "/admin/config", label: t.adminNav.config, icon: Settings, matchPrefix: ["/admin/config"] },
        ]
      : [
          { href: "/dashboard", label: t.nav.home, icon: Home, matchPrefix: ["/dashboard"] },
          {
            href: "/tree",
            label: t.nav.team,
            icon: GitBranch,
            matchPrefix: ["/tree", "/referrals", "/ledgers"],
          },
          { href: "/wallet", label: t.nav.wallet, icon: Wallet, matchPrefix: ["/wallet"] },
          {
            href: "/account",
            label: t.nav.account,
            icon: User,
            matchPrefix: ["/account", "/packages", "/orders"],
          },
        ];

  const activeIndex = Math.max(
    0,
    mobileBottomLinks.findIndex((item) =>
      item.matchPrefix.some((p) => pathname === p || pathname.startsWith(`${p}/`))
    )
  );

  return (
    <div className="min-h-screen bg-[#08090B] text-[#F2F0EB]">
      {/* Desktop Left Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/10 bg-[#0D0F12] lg:flex">
        <div className="border-b border-white/10 px-5 py-4">
          <Link href="/dashboard" className="block">
            <Roll10Logo className="h-6 w-auto" />
            <div className="mt-1.5 tabular-nums text-[11px] text-[#9DA4B0]">
              {member.memberCode} · {member.currentPackageCode ?? t.overview.pendingActivation}
            </div>
          </Link>
        </div>

        <div className="border-b border-white/[0.06] px-5 py-2.5">
          <div className="flex items-center justify-between text-[11px] text-[#9DA4B0]">
            <span>{locale === "zh-CN" ? "新加坡时间" : "Asia/Singapore"}</span>
            <span className="font-mono-sgt font-medium text-[#CBB487]">{sgtTimeLabel}</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {memberLinks.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition active:scale-[0.98] ${
                  active
                    ? "border border-[#CBB487]/35 bg-[#CBB487]/12 text-[#CBB487]"
                    : "text-[#9DA4B0] hover:bg-[#141619] hover:text-[#F2F0EB]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {isAdmin && (
            <div className="pt-4">
              <div className="mb-2 flex items-center gap-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#CBB487]">
                <Shield className="h-3.5 w-3.5" />
                <span>{t.nav.admin}</span>
              </div>
              <div className="space-y-1">
                {adminLinks.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex min-h-[40px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition active:scale-[0.98] ${
                        active
                          ? "border border-[#CBB487]/35 bg-[#CBB487]/12 text-[#CBB487]"
                          : "text-[#9DA4B0] hover:bg-[#141619] hover:text-[#F2F0EB]"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        <div className="space-y-2 border-t border-white/10 p-3">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="truncate text-xs text-[#9DA4B0]">{member.displayName}</span>
            <LocaleToggle locale={locale} />
          </div>
          <SignOutButton label={t.nav.signOut} />
        </div>
      </aside>

      {/* Admin Mobile Top Strip (shown only in admin mode on < lg) */}
      {mode === "admin" && (
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#08090B]/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Roll10Logo className="h-4 w-auto" />
              <span className="text-xs font-medium text-[#CBB487]">
                {locale === "zh-CN" ? "管理后台" : "Admin"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="rounded-lg border border-white/15 bg-[#141619] px-2.5 py-1.5 text-xs text-[#F2F0EB]"
              >
                {t.adminNav.backToMember}
              </Link>
              <LocaleToggle locale={locale} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto border-t border-white/[0.06] px-4 py-2 text-xs">
            {adminLinks.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-full px-3 py-1 font-medium ${
                    active ? "bg-[#CBB487] text-[#08090B]" : "bg-[#141619] text-[#9DA4B0]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="r10-page-fade pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-10 lg:pl-64">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8 lg:py-7">
          {children}
        </div>
      </main>

      {/* Fixed 4-Item Mobile Bottom Navigation with Sculpted Champagne-Gold Active Spotlight */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.09] bg-[#090B0E]/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_rgba(0,0,0,0.75)] lg:hidden"
      >
        <div className="relative mx-auto grid max-w-md grid-cols-4">
          {mobileBottomLinks.map((item, idx) => {
            const Icon = item.icon;
            const active = idx === activeIndex;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex min-h-[60px] flex-col items-center justify-center gap-1 px-2 py-2 text-[11px] font-medium outline-none transition-all duration-150 active:scale-[0.95] focus-visible:ring-2 focus-visible:ring-[#E7C98E] focus-visible:ring-inset ${
                  active ? "text-[#F1D59B]" : "text-[#9097A4] hover:text-[#F2F0EB]"
                }`}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-1 top-0 bottom-0.5 rounded-t-2xl border-t border-x border-[#E7C98E]/40 bg-gradient-to-b from-[#E7C98E]/[0.16] via-[#C9A66B]/[0.05] to-transparent shadow-[inset_0_1px_0_rgba(255,244,218,0.28)]"
                  />
                )}
                <Icon
                  className={`relative z-10 h-5 w-5 transition-transform ${
                    active ? "drop-shadow-[0_0_8px_rgba(231,201,142,0.45)]" : ""
                  }`}
                  strokeWidth={active ? 1.9 : 1.5}
                />
                <span className="relative z-10 truncate tracking-tight">{item.label}</span>
              </Link>
            );
          })}

          {/* Smooth Sliding Short Champagne-Gold Bottom Bar (180-220ms) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-1 left-0 w-1/4 transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          >
            <div className="mx-auto h-[2.5px] w-8 rounded-full bg-gradient-to-r from-[#C9A66B] via-[#F7E5BA] to-[#C9A66B] shadow-[0_0_10px_rgba(231,201,142,0.65)]" />
          </div>
        </div>
      </nav>
    </div>
  );
}
