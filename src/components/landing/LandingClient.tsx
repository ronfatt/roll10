"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  ArrowRight,
  Box,
  ChevronRight,
  Gamepad2,
  Megaphone,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { LocaleToggle } from "@/components/LocaleToggle";
import { Roll10BrandCombo } from "@/components/Roll10Logo";
import { MarbleRaceLoader } from "@/components/MarbleRaceLoader";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { DEFAULT_DIRECT_LOGIN_ACCOUNT, DIRECT_LOGIN_ENABLED } from "@/lib/app-config";

interface PosterSlide {
  id: string;
  image: string;
  tagEn: string;
  tagZh: string;
  titleEn: string;
  titleZh: string;
  date: string;
}

const HERO_POSTERS: PosterSlide[] = [
  {
    id: "grand-prix",
    image: "/posters/landing-hero-backdrop.jpg",
    tagEn: "10-BALL GRAND PRIX",
    tagZh: "10 珠竞速预览",
    titleEn: "STEEL BALL RACING",
    titleZh: "钢珠竞速",
    date: "2026-11-15 · 20:00 SGT",
  },
  {
    id: "upcoming",
    image: "/posters/upcoming-sprint.jpg",
    tagEn: "S1 NIGHT QUALIFYING",
    tagZh: "S1 夜间排位开赛",
    titleEn: "S1 QUALIFYING GRID",
    titleZh: "夜间排位开赛",
    date: "20:00 SGT · 10 赛道",
  },
  {
    id: "vip-cup",
    image: "/posters/vip-season-cup.jpg",
    tagEn: "VIP SEASON CUP",
    tagZh: "冠军杯重磅优惠",
    titleEn: "1,000 U CHAMPIONSHIP",
    titleZh: "冠军杯活动",
    date: "1 U = 1 BV · TRON TRC20",
  },
];

const NOTICES = [
  {
    id: "n1",
    pillEn: "TRON TRC20 Live",
    pillZh: "TRON TRC20 通道已开放",
    detailEn: "Exact 100 / 500 / 1,000 USDT deposits verify on-chain by TxID.",
    detailZh: "支持 100 / 500 / 1,000 USDT 链上 TxID 自动核验与 72h 出款。",
  },
  {
    id: "n2",
    pillEn: "1 U = 1 BV",
    pillZh: "1 U = 1 BV 统一标准",
    detailEn: "Team legs & midnight rollover in BV; rewards & payouts in U.",
    detailZh: "团队与结转采用 BV，直推/对碰/提现统一使用 U（USDT）。",
  },
  {
    id: "n3",
    pillEn: "D+2 00:01 Upgrade",
    pillZh: "升级 D+2 00:01 SGT 生效",
    detailEn: "Upgrade confirmed on Day D takes effect at D+2 00:01 SGT post-EOD.",
    detailZh: "付款确认日 D 起，D+2 日 00:00 日结后于 00:01 启用新封顶。",
  },
];

export function LandingClient({
  locale,
  isAuthenticated,
}: {
  locale: Locale;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const isZh = locale === "zh-CN";
  const [slideIdx, setSlideIdx] = useState(0);
  const [selectedNotice, setSelectedNotice] = useState<string | null>(null);
  const [previewRaceOpen, setPreviewRaceOpen] = useState(false);
  const [enteringDashboard, setEnteringDashboard] = useState(false);

  useEffect(() => {
    if (previewRaceOpen || enteringDashboard) return;
    const timer = setInterval(() => {
      setSlideIdx((prev) => (prev + 1) % HERO_POSTERS.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [previewRaceOpen, enteringDashboard]);

  const activeSlide = HERO_POSTERS[slideIdx];
  const loginHref = isAuthenticated
    ? "/dashboard"
    : DIRECT_LOGIN_ENABLED
      ? "/login?auto=1"
      : "/login";
  const activeNoticeObj = NOTICES.find((n) => n.id === selectedNotice);

  const handleLoginClick = async (e: React.MouseEvent) => {
    if (isAuthenticated || DIRECT_LOGIN_ENABLED) {
      e.preventDefault();
      setEnteringDashboard(true);
      try {
        router.prefetch("/dashboard");
      } catch {}
      if (!isAuthenticated && DIRECT_LOGIN_ENABLED) {
        try {
          await signIn("credentials", {
            identifier: DEFAULT_DIRECT_LOGIN_ACCOUNT.admin.identifier,
            password: DEFAULT_DIRECT_LOGIN_ACCOUNT.admin.password,
            redirect: false,
          });
          try {
            router.prefetch("/dashboard");
          } catch {}
        } catch (err) {
          console.error("Direct sign-in error:", err);
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0A101A] text-[#F4F8FC]">
      {/* 1. Full-screen Instant In-Place 10-Ball Entering Motion with Parallel Prefetch */}
      {enteringDashboard && (
        <MarbleRaceLoader
          locale={locale}
          targetHref="/dashboard"
          durationMs={1400}
          onComplete={() => {
            router.replace("/dashboard");
          }}
        />
      )}

      {previewRaceOpen && (
        <MarbleRaceLoader
          locale={locale}
          durationMs={2000}
          onComplete={() => setPreviewRaceOpen(false)}
        />
      )}

      {/* Top Header: Roll10BrandCombo + LocaleToggle */}
      <header className="sticky top-0 z-30 border-b border-[#2B3D4D] bg-[#0A101A]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl items-center justify-between px-3.5 py-2.5 sm:px-6">
          <Link href="/" className="inline-flex items-center">
            <Roll10BrandCombo />
          </Link>

          <div className="flex items-center gap-2">
            <LocaleToggle locale={locale} />
          </div>
        </div>
      </header>

      {/* Main Content Area: Aligned with Mobile Visual Draft */}
      <main className="mx-auto max-w-xl space-y-3.5 px-3.5 py-3 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
        {/* 1. Hero Visual Poster Stage (Image-Centric Titanium Track) */}
        <section aria-label={isZh ? "钢珠竞速" : "Steel Ball Racing"}>
          <div className="relative overflow-hidden rounded-[22px] border border-[#2B3D4D] bg-[#101B27] shadow-[0_16px_40px_rgba(0,0,0,0.85)]">
            <div className="relative aspect-[16/11] w-full sm:aspect-[21/10]">
              <img
                src={activeSlide.image}
                alt={isZh ? activeSlide.titleZh : activeSlide.titleEn}
                className="h-full w-full object-cover object-center transition-all duration-700"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[#0A101A] via-[#0A101A]/40 to-transparent"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-r from-[#0A101A]/85 via-[#0A101A]/20 to-transparent"
              />

              {/* Minimal Bottom Overlay: Headline + Subtitle + Action Buttons + Dots */}
              <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end p-4 sm:p-5">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-black italic tracking-wider text-[#F4F8FC] drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]">
                    {isZh ? activeSlide.titleZh : activeSlide.titleEn}
                  </h1>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className="h-3.5 w-[3px] rounded-full bg-[#51E7FA] shadow-[0_0_8px_rgba(81,231,250,0.8)]"
                      aria-hidden="true"
                    />
                    <span className="text-xs sm:text-sm font-semibold text-[#CAD7E6]">
                      {isZh ? activeSlide.tagZh : activeSlide.tagEn}
                    </span>
                  </div>
                </div>

                <div className="mt-3.5 flex items-center gap-2.5">
                  <Link
                    href={loginHref}
                    onClick={handleLoginClick}
                    onMouseEnter={() => {
                      try {
                        router.prefetch("/dashboard");
                      } catch {}
                    }}
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#51E7FA] via-[#38bdf8] to-[#18C5DC] px-5 text-xs sm:text-sm font-bold text-[#0A101A] shadow-[0_0_20px_rgba(81,231,250,0.45)] transition-transform active:scale-[0.98] hover:brightness-110"
                  >
                    <span>
                      {isAuthenticated
                        ? isZh
                          ? "进入会员中心"
                          : "Enter Dashboard"
                        : isZh
                          ? "进入会员中心"
                          : "Member Login"}
                    </span>
                    <ArrowRight className="h-4 w-4 stroke-[2.2]" />
                  </Link>

                  <Link
                    href="/register"
                    className="inline-flex min-h-[42px] items-center rounded-xl border border-[#2B3D4D] bg-[#101B27]/90 px-4 text-xs sm:text-sm font-semibold text-[#F4F8FC] backdrop-blur-sm transition hover:border-[#51E7FA] hover:text-[#51E7FA] active:scale-[0.98]"
                  >
                    {isZh ? "立即加入" : "Join"}
                  </Link>
                </div>

                {/* 3 Carousel Indicator Dots */}
                <div className="mt-3 flex items-center justify-center gap-2">
                  {HERO_POSTERS.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-label={`Slide ${idx + 1}`}
                      onClick={() => setSlideIdx(idx)}
                      className={`transition-all duration-300 ${
                        idx === slideIdx
                          ? "h-1.5 w-7 rounded-full bg-[#51E7FA] shadow-[0_0_8px_rgba(81,231,250,0.8)]"
                          : "h-1.5 w-1.5 rounded-full bg-white/30 hover:bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Visual Event & Offer Cards Grid (2 Columns) */}
        <section aria-label={isZh ? "赛事与活动" : "Events & Offers"}>
          <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
            <Link
              href={isAuthenticated ? "/dashboard" : "/entering"}
              onClick={handleLoginClick}
              className="group relative overflow-hidden rounded-2xl border border-[#2B3D4D] bg-[#101B27] transition-all duration-200 hover:border-[#51E7FA]/60 active:scale-[0.99]"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#0A101A]">
                <img
                  src="/posters/upcoming-sprint.jpg"
                  alt={isZh ? "S1 夜间排位开赛" : "S1 Night Qualifying"}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#101B27] via-transparent to-transparent"
                />
              </div>

              <div className="p-3 sm:p-3.5">
                <div className="flex items-center justify-between gap-1">
                  <div className="min-w-0">
                    <h2 className="truncate text-xs sm:text-sm font-bold text-[#F4F8FC] group-hover:text-[#51E7FA]">
                      {isZh ? "S1 夜间排位开赛" : "S1 Night Qualifying"}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-[#AAB8C7]">
                      {isZh ? "赛事预览" : "Sprint Preview"}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[#AAB8C7] transition-transform group-hover:translate-x-0.5 group-hover:text-[#51E7FA]" />
                </div>
              </div>
            </Link>

            <Link
              href={isAuthenticated ? "/dashboard" : "/entering"}
              onClick={handleLoginClick}
              className="group relative overflow-hidden rounded-2xl border border-[#2B3D4D] bg-[#101B27] transition-all duration-200 hover:border-[#51E7FA]/60 active:scale-[0.99]"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#0A101A]">
                <img
                  src="/posters/vip-season-cup.jpg"
                  alt={isZh ? "冠军杯活动" : "VIP Season Cup"}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#101B27] via-transparent to-transparent"
                />
              </div>

              <div className="p-3 sm:p-3.5">
                <div className="flex items-center justify-between gap-1">
                  <div className="min-w-0">
                    <h2 className="truncate text-xs sm:text-sm font-bold text-[#F4F8FC] group-hover:text-[#51E7FA]">
                      {isZh ? "冠军杯活动" : "VIP Season Cup"}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-[#AAB8C7]">
                      {isZh ? "查看活动" : "View Event"}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[#AAB8C7] transition-transform group-hover:translate-x-0.5 group-hover:text-[#51E7FA]" />
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* 3. Action Strip Cards */}
        <section aria-label={isZh ? "功能与服务" : "Features"} className="space-y-3">
          {/* Card 1: 配套与升级 */}
          <Link
            href="/packages"
            className="group relative flex items-center justify-between overflow-hidden rounded-2xl border border-[#2B3D4D] bg-[#101B27] p-3.5 sm:p-4 transition-all duration-200 hover:border-[#51E7FA]/60 active:scale-[0.99]"
          >
            <div className="relative z-10 flex items-center gap-2.5">
              <Box className="h-5 w-5 text-[#F4F8FC]" strokeWidth={1.8} />
              <span
                className="h-4 w-[2.5px] rounded-full bg-[#51E7FA] shadow-[0_0_8px_rgba(81,231,250,0.8)]"
                aria-hidden="true"
              />
              <span className="text-sm font-bold tracking-tight text-[#F4F8FC] group-hover:text-[#51E7FA]">
                {isZh ? "配套与升级" : "Packages & Upgrades"}
              </span>
            </div>

            <ChevronRight className="relative z-10 h-5 w-5 text-[#AAB8C7] transition-transform group-hover:translate-x-0.5 group-hover:text-[#51E7FA]" />

            {/* Subtle background cyan trace glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#51E7FA]/[0.08] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
          </Link>

          {/* Card 2: 游戏厅 · 即将开放 */}
          <Link
            href="/arcade"
            className="group relative flex items-center justify-between overflow-hidden rounded-2xl border border-[#2B3D4D] bg-[#101B27] p-3.5 sm:p-4 transition-all duration-200 hover:border-[#51E7FA]/60 active:scale-[0.99]"
          >
            <div className="relative z-10 flex items-center gap-2.5">
              <Gamepad2 className="h-5 w-5 text-[#F4F8FC]" strokeWidth={1.8} />
              <span
                className="h-4 w-[2.5px] rounded-full bg-[#51E7FA] shadow-[0_0_8px_rgba(81,231,250,0.8)]"
                aria-hidden="true"
              />
              <span className="text-sm font-bold tracking-tight text-[#F4F8FC] group-hover:text-[#51E7FA]">
                {isZh ? "游戏厅 · 即将开放" : "Arcade · Coming Soon"}
              </span>
            </div>

            {/* Metallic circular track with shiny ball decorative asset */}
            <div className="relative z-10 flex items-center">
              <img
                src="/brand/arcade-card-track.jpg"
                alt="Arcade Track"
                className="h-9 w-auto object-contain opacity-90 transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          </Link>
        </section>

        {/* 4. Compact Announcement Strip (Single-Line Pills + Detail) */}
        <section
          aria-label={isZh ? "主要公告" : "Announcements"}
          className="rounded-2xl border border-[#2B3D4D] bg-[#101B27] px-3.5 py-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#51E7FA]">
              <Megaphone className="h-3.5 w-3.5" />
              <span>{isZh ? "主要公告" : "Notices"}</span>
            </span>

            <div className="flex flex-wrap items-center gap-1.5">
              {NOTICES.map((n) => {
                const active = selectedNotice === n.id;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setSelectedNotice(active ? null : n.id)}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                      active
                        ? "border-[#51E7FA] bg-[#51E7FA]/15 text-[#51E7FA]"
                        : "border-[#2B3D4D] bg-[#0A101A] text-[#CAD7E6] hover:border-[#51E7FA]/50 hover:text-[#51E7FA]"
                    }`}
                  >
                    {isZh ? n.pillZh : n.pillEn}
                  </button>
                );
              })}
            </div>
          </div>

          {activeNoticeObj && (
            <p className="mt-2.5 border-t border-[#2B3D4D] pt-2 text-xs text-[#AAB8C7]">
              {isZh ? activeNoticeObj.detailZh : activeNoticeObj.detailEn}
            </p>
          )}
        </section>
      </main>

      {/* 5-Item Shared Mobile Bottom Navigation */}
      <MobileBottomNav locale={locale} isAuthenticated={isAuthenticated} />
    </div>
  );
}
