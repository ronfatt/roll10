"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, GitBranch, Wallet, User } from "lucide-react";
import type { Locale } from "@/lib/i18n";

export function ArcadeNavIcon({
  active = false,
  className,
}: {
  active?: boolean;
  className?: string;
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

export function MobileBottomNav({
  locale = "zh-CN",
  isAuthenticated = false,
}: {
  locale?: Locale;
  isAuthenticated?: boolean;
}) {
  const pathname = usePathname();
  const isZh = locale === "zh-CN";

  const navItems = [
    {
      key: "home",
      href: isAuthenticated ? "/dashboard" : "/",
      label: isZh ? "首页" : "Home",
      icon: Home,
      match: (p: string) => p === "/" || p.startsWith("/dashboard"),
    },
    {
      key: "team",
      href: "/tree",
      label: isZh ? "团队" : "Team",
      icon: GitBranch,
      match: (p: string) => p.startsWith("/tree") || p.startsWith("/referrals"),
    },
    {
      key: "arcade",
      href: "/arcade",
      label: isZh ? "游戏厅" : "Arcade",
      icon: ArcadeNavIcon,
      isCustomIcon: true,
      match: (p: string) => p.startsWith("/arcade"),
    },
    {
      key: "wallet",
      href: "/wallet",
      label: isZh ? "钱包" : "Wallet",
      icon: Wallet,
      match: (p: string) => p.startsWith("/wallet"),
    },
    {
      key: "account",
      href: "/account",
      label: isZh ? "我的" : "Account",
      icon: User,
      match: (p: string) =>
        p.startsWith("/account") || p.startsWith("/packages") || p.startsWith("/orders"),
    },
  ];

  const activeIndex = Math.max(
    0,
    navItems.findIndex((item) => item.match(pathname))
  );

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#29363D] bg-[#070B0D]/96 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_rgba(0,0,0,0.85)] lg:hidden"
    >
      <div className="relative mx-auto grid max-w-md grid-cols-5">
        {navItems.map((item, idx) => {
          const Icon = item.icon;
          const active = idx === activeIndex;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`relative flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 py-1.5 text-[11px] font-medium outline-none transition-all duration-150 active:scale-[0.95] focus-visible:ring-2 focus-visible:ring-[#00D9DF] focus-visible:ring-inset ${
                active ? "text-[#00D9DF]" : "text-[#829098] hover:text-[#F4F6F7]"
              }`}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-1 top-0 bottom-0.5 rounded-t-2xl border-t border-x border-[#00D9DF]/35 bg-gradient-to-b from-[#00D9DF]/[0.15] via-[#00D9DF]/[0.03] to-transparent shadow-[inset_0_1px_0_rgba(0,217,223,0.25)]"
                />
              )}
              {"isCustomIcon" in item && item.isCustomIcon ? (
                <ArcadeNavIcon active={active} />
              ) : (
                <Icon
                  className={`relative z-10 h-5 w-5 transition-transform ${
                    active ? "drop-shadow-[0_0_8px_rgba(0,217,223,0.6)]" : ""
                  }`}
                  strokeWidth={active ? 2 : 1.6}
                />
              )}
              <span className="relative z-10 truncate tracking-tight text-[11px]">{item.label}</span>
            </Link>
          );
        })}

        {/* Smooth Sliding Cyan Bottom Bar (200ms) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-1 left-0 transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{
            width: "20%",
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        >
          <div className="mx-auto h-[2.5px] w-7 rounded-full bg-gradient-to-r from-[#00A3A8] via-[#00D9DF] to-[#70F4F8] shadow-[0_0_10px_rgba(0,217,223,0.85)]" />
        </div>
      </div>
    </nav>
  );
}
