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
import { Roll10Logo, Roll10OrbitalIcon } from "./Roll10Logo";
import { SignOutButton } from "./SignOutButton";

interface AppShellProps {
  children: React.ReactNode;
  member?: {
    memberCode: string;
    displayName: string;
    role: "MEMBER" | "ADMIN" | string;
    currentPackageCode: string | null;
  } | null;
  locale: Locale;
  t: Dictionary;
  sgtTimeLabel?: string;
  mode?: "member" | "admin";
}

function ArcadeNavIcon({
  active = false,
  className,
}: {
  active?: boolean;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <div className={`relative flex items-center justify-center ${className ?? "h-5 w-5"}`}>
      <img
        src="/brand/roll10-orbital-icon.png"
        alt="Arcade"
        className={`h-5 w-auto object-contain transition-all ${
          active
            ? "drop-shadow-[0_0_10px_rgba(81,231,250,0.9)] brightness-125 scale-105"
            : "opacity-75 grayscale-[20%]"
        }`}
      />
    </div>
  );
}

export function AppShell({
  children,
  member,
  locale,
  t,
  sgtTimeLabel = "",
  mode = "member",
}: AppShellProps) {
  const pathname = usePathname();
  const isAdmin = member?.role === "ADMIN";

  const memberLinks = [
    { href: member ? "/dashboard" : "/", label: t.nav.home, icon: Home },
    { href: "/tree", label: t.nav.team, icon: GitBranch },
    { href: "/arcade", label: t.nav.arcade, icon: ArcadeNavIcon, isCustomIcon: true },
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

  // Fixed 5-Item Member Mobile Bottom Navigation (首页 · 团队 · 游戏厅 · 钱包 · 我的)
  const mobileBottomLinks =
    mode === "admin"
      ? [
          { href: "/admin/deposits", label: t.adminNav.deposits, icon: ArrowDownToLine, matchPrefix: ["/admin/deposits"] },
          { href: "/admin/orders", label: t.adminNav.orders, icon: CheckSquare, matchPrefix: ["/admin/orders"] },
          { href: "/admin/withdrawals", label: t.adminNav.withdrawals, icon: Wallet, matchPrefix: ["/admin/withdrawals"] },
          { href: "/admin/config", label: t.adminNav.config, icon: Settings, matchPrefix: ["/admin/config"] },
        ]
      : [
          {
            href: member ? "/dashboard" : "/",
            label: t.nav.home,
            icon: Home,
            matchPrefix: ["/dashboard", "/"],
          },
          {
            href: "/tree",
            label: t.nav.team,
            icon: GitBranch,
            matchPrefix: ["/tree", "/referrals", "/ledgers"],
          },
          {
            href: "/arcade",
            label: t.nav.arcade,
            icon: ArcadeNavIcon,
            isCustomIcon: true,
            matchPrefix: ["/arcade"],
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
      item.matchPrefix.some((p) =>
        p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(`${p}/`)
      )
    )
  );

  const numCols = mobileBottomLinks.length;

  return (
    <div className="min-h-screen bg-[#0A101A] text-[#F4F8FC]">
      {/* Desktop Left Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[#2B3D4D] bg-[#101B27] lg:flex">
        <div className="border-b border-[#2B3D4D] px-5 py-4">
          <Link href={member ? "/dashboard" : "/"} className="block">
            <Roll10Logo className="h-7 w-auto" />
            <div className="mt-1.5 tabular-nums text-[11px] text-[#AAB8C7]">
              {member ? `${member.memberCode} · ${member.currentPackageCode ?? t.overview.pendingActivation}` : (locale === "zh-CN" ? "公开访客模式" : "Public Guest Mode")}
            </div>
          </Link>
        </div>

        <div className="border-b border-[#2B3D4D]/60 px-5 py-2.5">
          <div className="flex items-center justify-between text-[11px] text-[#AAB8C7]">
            <span>{locale === "zh-CN" ? "新加坡时间" : "Asia/Singapore"}</span>
            <span className="font-mono-sgt font-medium text-[#51E7FA]">{sgtTimeLabel}</span>
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
                    ? "border border-[#51E7FA]/40 bg-[#51E7FA]/12 text-[#51E7FA] shadow-[0_0_12px_rgba(81,231,250,0.15)]"
                    : "text-[#AAB8C7] hover:bg-[#162433] hover:text-[#F4F8FC]"
                }`}
              >
                {item.isCustomIcon ? (
                  <ArcadeNavIcon active={active} />
                ) : (
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                )}
                <span>{item.label}</span>
              </Link>
            );
          })}

          {isAdmin && (
            <div className="pt-4">
              <div className="mb-2 flex items-center gap-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#51E7FA]">
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
                          ? "border border-[#51E7FA]/40 bg-[#51E7FA]/12 text-[#51E7FA]"
                          : "text-[#AAB8C7] hover:bg-[#162433] hover:text-[#F4F8FC]"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.7} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        <div className="space-y-2 border-t border-[#2B3D4D] p-3">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="truncate text-xs text-[#AAB8C7]">
              {member ? member.displayName : (locale === "zh-CN" ? "公开访客" : "Guest")}
            </span>
            <LocaleToggle locale={locale} />
          </div>
          {member ? (
            <SignOutButton label={t.nav.signOut} />
          ) : (
            <Link
              href="/login"
              className="flex min-h-[36px] w-full items-center justify-center rounded-xl bg-[#51E7FA] text-xs font-semibold text-[#0A101A] transition hover:bg-[#74edfc]"
            >
              {locale === "zh-CN" ? "会员登录" : "Sign In"}
            </Link>
          )}
        </div>
      </aside>

      {/* Admin Mobile Top Strip */}
      {mode === "admin" && (
        <header className="sticky top-0 z-30 border-b border-[#2B3D4D] bg-[#0A101A]/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Roll10OrbitalIcon className="h-5 w-auto" />
              <span className="text-xs font-semibold text-[#51E7FA]">
                {locale === "zh-CN" ? "管理后台" : "Admin"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="rounded-lg border border-[#2B3D4D] bg-[#101B27] px-2.5 py-1.5 text-xs text-[#F4F8FC]"
              >
                {t.adminNav.backToMember}
              </Link>
              <LocaleToggle locale={locale} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto border-t border-[#2B3D4D]/60 px-4 py-2 text-xs">
            {adminLinks.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-full px-3 py-1 font-medium ${
                    active ? "bg-[#51E7FA] text-[#0A101A]" : "bg-[#101B27] text-[#AAB8C7]"
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
      <main className="r10-page-fade pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-10 lg:pl-64">
        <div className="mx-auto max-w-4xl px-3.5 py-3.5 sm:px-6 lg:px-8 lg:py-7">
          {children}
        </div>
      </main>

      {/* Fixed 5-Item Mobile Bottom Navigation with Ice-Blue Active Spotlight */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#2B3D4D] bg-[#0A101A]/96 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_rgba(0,0,0,0.85)] lg:hidden"
      >
        <div className={`relative mx-auto grid max-w-md ${numCols === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
          {mobileBottomLinks.map((item, idx) => {
            const Icon = item.icon;
            const active = idx === activeIndex;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 py-1.5 text-[11px] font-medium outline-none transition-all duration-150 active:scale-[0.95] focus-visible:ring-2 focus-visible:ring-[#51E7FA] focus-visible:ring-inset ${
                  active ? "text-[#51E7FA]" : "text-[#889AA8] hover:text-[#F4F8FC]"
                }`}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-1 top-0 bottom-0.5 rounded-t-2xl border-t border-x border-[#51E7FA]/35 bg-gradient-to-b from-[#51E7FA]/[0.15] via-[#51E7FA]/[0.03] to-transparent shadow-[inset_0_1px_0_rgba(165,246,255,0.25)]"
                  />
                )}
                {"isCustomIcon" in item && item.isCustomIcon ? (
                  <ArcadeNavIcon active={active} />
                ) : (
                  <Icon
                    className={`relative z-10 h-5 w-5 transition-transform ${
                      active ? "drop-shadow-[0_0_8px_rgba(81,231,250,0.6)]" : ""
                    }`}
                    strokeWidth={active ? 2 : 1.6}
                  />
                )}
                <span className="relative z-10 truncate tracking-tight text-[11px]">{item.label}</span>
              </Link>
            );
          })}

          {/* Smooth Sliding Ice-Blue Bottom Bar (200ms) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-1 left-0 transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={{
              width: `${100 / numCols}%`,
              transform: `translateX(${activeIndex * 100}%)`,
            }}
          >
            <div className="mx-auto h-[2.5px] w-7 rounded-full bg-gradient-to-r from-[#18C5DC] via-[#51E7FA] to-[#A5F6FF] shadow-[0_0_10px_rgba(81,231,250,0.85)]" />
          </div>
        </div>
      </nav>
    </div>
  );
}
