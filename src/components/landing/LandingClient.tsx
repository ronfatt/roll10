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
    date: "固定 50% RP ＋ USDT · TRON TRC20",
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
    pillEn: "50% RP + CP / USDT",
    pillZh: "固定 50% RP ＋ 自选 CP 支付",
    detailEn: "50% RP + 0-50% CP + USDT remainder. Rewards credited in CP.",
    detailZh: "新会员注册支付固定 50% RP，CP 可自选 0%~50%，剩余以 USDT 补足；各项奖励以 CP 实时发放。",
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
      if (typeof document !== "undefined") {
        document.cookie = "r10_direct_role=admin; path=/; max-age=604800; SameSite=Lax";
      }
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
          console.warn("Direct sign-in error:", err);
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#070B0D] text-[#F4F6F7]">
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
      <header className="sticky top-0 z-30 border-b border-[#29363D] bg-[#070B0D]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl items-center justify-between px-3.5 py-2.5 sm:px-6">
          <Link href="/" className="inline-flex items-center">
            <Roll10BrandCombo />
          </Link>

          <div className="flex items-center gap-2">
            <LocaleToggle locale={locale} />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-xl space-y-3.5 px-3.5 py-3 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
        {/* 1. Hero Visual Poster Stage */}
        <section aria-label={isZh ? "钢珠竞速" : "Steel Ball Racing"}>
          <div className="relative overflow-hidden rounded-[22px] border border-[#29363D] bg-[#10171B] shadow-[0_16px_40px_rgba(0,0,0,0.85)]">
            <div className="relative aspect-[16/11] w-full sm:aspect-[21/10]">
              <img
                src={activeSlide.image}
                alt={isZh ? activeSlide.titleZh : activeSlide.titleEn}
                className="h-full w-full object-cover object-center transition-all duration-700"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[#070B0D] via-[#070B0D]/40 to-transparent"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-r from-[#070B0D]/85 via-[#070B0D]/20 to-transparent"
              />

              {/* Minimal Bottom Overlay */}
              <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end p-4 sm:p-5">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-black italic tracking-wider text-[#F4F6F7] drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]">
                    {isZh ? activeSlide.titleZh : activeSlide.titleEn}
                  </h1>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className="h-3.5 w-[3px] rounded-full bg-[#00D9DF] shadow-[0_0_8px_rgba(0,217,223,0.8)]"
                      aria-hidden="true"
                    />
                    <span className="text-xs sm:text-sm font-semibold text-[#B0BBC2]">
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
                    className="r10-btn-gold inline-flex min-h-[42px] items-center gap-1.5 rounded-xl px-5 text-xs sm:text-sm font-bold text-[#070B0D] transition-transform active:scale-[0.98]"
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
                    className="r10-btn-dark inline-flex min-h-[42px] items-center rounded-xl px-4 text-xs sm:text-sm font-semibold text-[#F4F6F7] transition hover:border-[#00D9DF] hover:text-[#00D9DF] active:scale-[0.98]"
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
                          ? "h-1.5 w-7 rounded-full bg-[#00D9DF] shadow-[0_0_8px_rgba(0,217,223,0.8)]"
                          : "h-1.5 w-1.5 rounded-full bg-white/30 hover:bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Brand Origin & Gameplay Timeline Card */}
        <section
          aria-label={isZh ? "钢球竞速怎么玩" : "How Marble Racing Works"}
          className="r10-card-dark relative overflow-hidden p-4 sm:p-5"
        >
          {/* Header */}
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black italic tracking-wide text-[#E9C66B]">
              {isZh ? "钢球竞速怎么玩？" : "How Marble Racing Works"}
            </h2>
            <div className="h-[2px] flex-1 bg-gradient-to-r from-[#E9C66B]/80 via-[#E9C66B]/40 to-transparent" />
            <span className="font-mono-sgt text-xs font-bold text-[#E9C66B] tracking-tighter">///</span>
          </div>

          <p className="mt-2 text-xs sm:text-[13px] text-[#B0BBC2] leading-relaxed">
            {isZh
              ? "多颗钢球同时出发，靠重力滚过弯道和坡道，按冲线先后决定名次。"
              : "Multiple steel balls launch simultaneously, navigating curved tracks and drops by gravity to determine winners."}
          </p>

          {/* Glowing Cyan Track Timeline */}
          <div className="relative mt-4 pt-1">
            <div className="absolute left-2 right-2 top-3 h-[2px] bg-gradient-to-r from-[#00D9DF] via-[#00D9DF] to-[#00D9DF]/30 shadow-[0_0_8px_rgba(0,217,223,0.8)]" />

            <div className="grid grid-cols-2 gap-3 relative z-10 pt-4">
              {/* 2006 */}
              <div className="relative">
                <div className="absolute -top-3 left-3 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-[#070B0D] bg-[#00D9DF] shadow-[0_0_8px_rgba(0,217,223,0.9)]" />
                <div className="text-xl sm:text-2xl font-black italic text-[#E9C66B] tabular-nums">2006</div>
                <p className="mt-1 text-[11px] text-[#829098] leading-tight">
                  {isZh
                    ? "荷兰创作者 Jelle Bakker 开始分享弹珠赛道视频"
                    : "Jelle Bakker started sharing marble race videos"}
                </p>
              </div>

              {/* 2016 */}
              <div className="relative">
                <div className="absolute -top-3 left-3 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-[#070B0D] bg-[#00D9DF] shadow-[0_0_8px_rgba(0,217,223,0.9)]" />
                <div className="text-xl sm:text-2xl font-black italic text-[#E9C66B] tabular-nums">2016</div>
                <p className="mt-1 text-[11px] text-[#829098] leading-tight">
                  {isZh
                    ? "首届 Marble League 举办，至今约10年。"
                    : "Inaugural Marble League held, running for ~10 years."}
                </p>
              </div>
            </div>

            {/* Footnote & Slide Indicator */}
            <div className="mt-4 flex items-center justify-between border-t border-[#29363D] pt-2 text-[10px] text-[#829098]">
              <span>
                {isZh
                  ? "竞速背景资料：Jelle's Marble Runs 官方年表。"
                  : "Source: Jelle's Marble Runs official chronology."}
              </span>
              <span className="font-mono-sgt text-[#E9C66B]">─ 01 / 05 ─</span>
            </div>
          </div>
        </section>

        {/* 3. Package Cards Showcase & Payment Formula */}
        <section
          aria-label={isZh ? "配套方案" : "Packages"}
          className="r10-card-dark relative overflow-hidden p-4 sm:p-5 space-y-3"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-4 w-[2.5px] rounded-full bg-[#00D9DF] shadow-[0_0_8px_rgba(0,217,223,0.8)]" />
              <h2 className="text-base sm:text-lg font-black italic tracking-wide text-[#F4F6F7]">
                {isZh ? "配套" : "PACKAGES"}{" "}
                <span className="text-xs text-[#00D9DF] font-bold">/ PACKAGES</span>
              </h2>
            </div>
            <span className="font-mono-sgt text-xs font-bold text-[#E9C66B]">─ 02 / 05 ─</span>
          </div>

          {/* Central Guide Line: 50% RP + 0~50% CP + USDT */}
          <div className="relative my-2 flex items-center justify-center">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#00D9DF]/40 to-[#00D9DF]" />
            <div className="mx-2 sm:mx-3 rounded-full border border-[#E9C66B]/50 bg-[#070B0D] px-3 py-1 shadow-[0_0_12px_rgba(233,198,107,0.25)] text-center">
              <span className="font-bold text-[11px] sm:text-xs tracking-wide text-[#E9C66B]">
                {isZh ? "固定 50% RP ＋ 0~50% CP ＋ USDT" : "50% RP + 0~50% CP + USDT"}
              </span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#00D9DF]/40 to-[#00D9DF]" />
          </div>

          {/* 3 Tier Cards: Silver, Gold, Diamond */}
          <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
            {/* Silver (100 U) */}
            <div className="rounded-xl border border-[#29363D] bg-[#070B0D] p-2 sm:p-2.5 text-center shadow-md">
              <div className="text-sm sm:text-base font-black italic tracking-wide text-[#F4F6F7]">Silver</div>
              <div className="my-1 rounded-md border border-[#E9C66B]/30 bg-[#E9C66B]/10 py-0.5 px-1">
                <span className="text-xs sm:text-sm font-mono-sgt font-bold text-[#E9C66B]">100 U</span>
              </div>
              <div className="space-y-1 text-[10px] sm:text-[11px] pt-1">
                <div className="text-[#829098]">{isZh ? "团队积分" : "Team Points"}</div>
                <div className="font-bold text-[#00D9DF]">100</div>
                <div className="text-[#829098] pt-0.5">{isZh ? "直推比例" : "Direct Rate"}</div>
                <div className="font-bold text-[#E9C66B]">25%</div>
                <div className="text-[#829098] pt-0.5">{isZh ? "对碰封顶" : "Daily Cap"}</div>
                <div className="font-bold text-[#F4F6F7]">100 CP/天</div>
              </div>
            </div>

            {/* Gold (500 U) */}
            <div className="rounded-xl border border-[#29363D] bg-[#070B0D] p-2 sm:p-2.5 text-center shadow-md">
              <div className="text-sm sm:text-base font-black italic tracking-wide text-[#F4F6F7]">Gold</div>
              <div className="my-1 rounded-md border border-[#E9C66B]/30 bg-[#E9C66B]/10 py-0.5 px-1">
                <span className="text-xs sm:text-sm font-mono-sgt font-bold text-[#E9C66B]">500 U</span>
              </div>
              <div className="space-y-1 text-[10px] sm:text-[11px] pt-1">
                <div className="text-[#829098]">{isZh ? "团队积分" : "Team Points"}</div>
                <div className="font-bold text-[#00D9DF]">500</div>
                <div className="text-[#829098] pt-0.5">{isZh ? "直推比例" : "Direct Rate"}</div>
                <div className="font-bold text-[#E9C66B]">30%</div>
                <div className="text-[#829098] pt-0.5">{isZh ? "对碰封顶" : "Daily Cap"}</div>
                <div className="font-bold text-[#F4F6F7]">500 CP/天</div>
              </div>
            </div>

            {/* Diamond (1,000 U) */}
            <div className="rounded-xl border border-[#E9C66B]/50 bg-[#070B0D] p-2 sm:p-2.5 text-center shadow-md shadow-[0_0_12px_rgba(233,198,107,0.15)]">
              <div className="text-sm sm:text-base font-black italic tracking-wide text-[#F4F6F7]">Diamond</div>
              <div className="my-1 rounded-md border border-[#E9C66B]/40 bg-[#E9C66B]/15 py-0.5 px-1">
                <span className="text-xs sm:text-sm font-mono-sgt font-bold text-[#E9C66B]">1,000 U</span>
              </div>
              <div className="space-y-1 text-[10px] sm:text-[11px] pt-1">
                <div className="text-[#829098]">{isZh ? "团队积分" : "Team Points"}</div>
                <div className="font-bold text-[#00D9DF]">1,000</div>
                <div className="text-[#829098] pt-0.5">{isZh ? "直推比例" : "Direct Rate"}</div>
                <div className="font-bold text-[#E9C66B]">35%</div>
                <div className="text-[#829098] pt-0.5">{isZh ? "对碰封顶" : "Daily Cap"}</div>
                <div className="font-bold text-[#F4F6F7]">1,000 CP/天</div>
              </div>
            </div>
          </div>

          {/* Footnotes */}
          <div className="space-y-1 border-t border-[#29363D] pt-2 text-[10.5px] text-[#829098]">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[#00D9DF]">/</span>
              <span>
                {isZh
                  ? "USDT (U) 为支付货币；RP 由公司发行；CP 为奖励发放与自选抵扣点数。"
                  : "USDT (U) is payment currency; RP issued by platform; CP for rewards & optional offset."}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[#00D9DF]">/</span>
              <span>
                {isZh
                  ? "团队积分按 100 整数倍累计，每 100 对碰结算 10 CP，每日未对碰积分 100% 保留结转。"
                  : "Team points accumulate in 100 units; every 100 pairs settle 10 CP; un-paired points roll over 100%."}
              </span>
            </div>
          </div>
        </section>

        {/* 4. Visual Event & Offer Cards Grid (2 Columns) */}
        <section aria-label={isZh ? "赛事与活动" : "Events & Offers"}>
          <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
            <Link
              href={isAuthenticated ? "/dashboard" : "/entering"}
              onClick={handleLoginClick}
              className="r10-card-dark group relative overflow-hidden transition-all duration-200 hover:border-[#00D9DF]/60 active:scale-[0.99]"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#070B0D]">
                <img
                  src="/posters/upcoming-sprint.jpg"
                  alt={isZh ? "S1 夜间排位开赛" : "S1 Night Qualifying"}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#10171B] via-transparent to-transparent"
                />
              </div>

              <div className="p-3 sm:p-3.5">
                <div className="flex items-center justify-between gap-1">
                  <div className="min-w-0">
                    <h2 className="truncate text-xs sm:text-sm font-bold text-[#F4F6F7] group-hover:text-[#00D9DF]">
                      {isZh ? "S1 夜间排位开赛" : "S1 Night Qualifying"}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-[#829098]">
                      {isZh ? "赛事预览" : "Sprint Preview"}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[#829098] transition-transform group-hover:translate-x-0.5 group-hover:text-[#00D9DF]" />
                </div>
              </div>
            </Link>

            <Link
              href={isAuthenticated ? "/dashboard" : "/entering"}
              onClick={handleLoginClick}
              className="r10-card-dark group relative overflow-hidden transition-all duration-200 hover:border-[#00D9DF]/60 active:scale-[0.99]"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#070B0D]">
                <img
                  src="/posters/vip-season-cup.jpg"
                  alt={isZh ? "冠军杯活动" : "VIP Season Cup"}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#10171B] via-transparent to-transparent"
                />
              </div>

              <div className="p-3 sm:p-3.5">
                <div className="flex items-center justify-between gap-1">
                  <div className="min-w-0">
                    <h2 className="truncate text-xs sm:text-sm font-bold text-[#F4F6F7] group-hover:text-[#00D9DF]">
                      {isZh ? "冠军杯活动" : "VIP Season Cup"}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-[#829098]">
                      {isZh ? "查看活动" : "View Event"}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[#829098] transition-transform group-hover:translate-x-0.5 group-hover:text-[#00D9DF]" />
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* 5. Action Strip Cards */}
        <section aria-label={isZh ? "功能与服务" : "Features"} className="space-y-3">
          {/* Card 1: 配套与升级 */}
          <Link
            href="/packages"
            className="r10-card-dark group relative flex items-center justify-between overflow-hidden p-3.5 sm:p-4 transition-all duration-200 hover:border-[#00D9DF]/60 active:scale-[0.99]"
          >
            <div className="relative z-10 flex items-center gap-2.5">
              <Box className="h-5 w-5 text-[#F4F6F7]" strokeWidth={1.8} />
              <span
                className="h-4 w-[2.5px] rounded-full bg-[#00D9DF] shadow-[0_0_8px_rgba(0,217,223,0.8)]"
                aria-hidden="true"
              />
              <span className="text-sm font-bold tracking-tight text-[#F4F6F7] group-hover:text-[#00D9DF]">
                {isZh ? "配套与升级" : "Packages & Upgrades"}
              </span>
            </div>

            <ChevronRight className="relative z-10 h-5 w-5 text-[#829098] transition-transform group-hover:translate-x-0.5 group-hover:text-[#00D9DF]" />
          </Link>

          {/* Card 2: 游戏厅 · 即将开放 */}
          <Link
            href="/arcade"
            className="r10-card-dark group relative flex items-center justify-between overflow-hidden p-3.5 sm:p-4 transition-all duration-200 hover:border-[#00D9DF]/60 active:scale-[0.99]"
          >
            <div className="relative z-10 flex items-center gap-2.5">
              <Gamepad2 className="h-5 w-5 text-[#F4F6F7]" strokeWidth={1.8} />
              <span
                className="h-4 w-[2.5px] rounded-full bg-[#00D9DF] shadow-[0_0_8px_rgba(0,217,223,0.8)]"
                aria-hidden="true"
              />
              <span className="text-sm font-bold tracking-tight text-[#F4F6F7] group-hover:text-[#00D9DF]">
                {isZh ? "游戏厅 · 即将开放" : "Arcade · Coming Soon"}
              </span>
            </div>

            {/* Metallic circular track asset */}
            <div className="relative z-10 flex items-center">
              <img
                src="/brand/arcade-card-track.jpg"
                alt="Arcade Track"
                className="h-9 w-auto object-contain opacity-90 transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          </Link>
        </section>

        {/* 6. Compact Announcement Strip */}
        <section
          aria-label={isZh ? "主要公告" : "Announcements"}
          className="r10-card-dark px-3.5 py-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00D9DF]">
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
                        ? "border-[#00D9DF] bg-[#00D9DF]/15 text-[#00D9DF]"
                        : "border-[#29363D] bg-[#070B0D] text-[#B0BBC2] hover:border-[#00D9DF]/50 hover:text-[#00D9DF]"
                    }`}
                  >
                    {isZh ? n.pillZh : n.pillEn}
                  </button>
                );
              })}
            </div>
          </div>

          {activeNoticeObj && (
            <p className="mt-2.5 border-t border-[#29363D] pt-2 text-xs text-[#829098]">
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
