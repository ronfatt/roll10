"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  LogIn,
  Megaphone,
  Play,
  Sparkles,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { LocaleToggle } from "@/components/LocaleToggle";
import { Roll10Logo } from "@/components/Roll10Logo";
import { MarbleRaceLoader } from "@/components/MarbleRaceLoader";

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
    image: "/posters/grand-prix-launch.jpg",
    tagEn: "SEASON 01 POSTER",
    tagZh: "最新活动海报",
    titleEn: "ROLL10 Steel Ball Grand Prix",
    titleZh: "ROLL10 国际钢珠竞速公开赛",
    date: "2026-11-15 · 20:00 SGT",
  },
  {
    id: "vip-cup",
    image: "/posters/vip-season-cup.jpg",
    tagEn: "VIP OFFER POSTER",
    tagZh: "最新尊享优惠",
    titleEn: "1,000 U Championship Cup",
    titleZh: "1,000 U 冠军杯 · 25% 直推 U",
    date: "1 U = 1 BV · TRON TRC20",
  },
];

const VISUAL_CARDS = [
  {
    id: "upcoming",
    image: "/posters/upcoming-sprint.jpg",
    badgeEn: "UPCOMING · 11-15",
    badgeZh: "即将来临 · 11-15",
    titleEn: "S1 Night Qualifying Grid",
    titleZh: "S1 夜间排位开赛",
    metaEn: "20:00 SGT · 10 Lanes",
    metaZh: "20:00 SGT · 10 赛道",
    hrefMember: "/entering",
    hrefGuest: "/login",
  },
  {
    id: "vip",
    image: "/posters/vip-season-cup.jpg",
    badgeEn: "EVENT BONUS",
    badgeZh: "活动重磅礼遇",
    titleEn: "25% Direct U + 10 U Pair",
    titleZh: "25% 直推 U · 10 U 对碰",
    metaEn: "Daily 00:00 SGT",
    metaZh: "每日 00:00 SGT 结转",
    hrefMember: "/entering",
    hrefGuest: "/register?plan=P1000",
  },
  {
    id: "tiers",
    image: "/posters/offers-tiers.jpg",
    badgeEn: "OFFICIAL PLANS",
    badgeZh: "最新优惠配套",
    titleEn: "100 · 500 · 1,000 U",
    titleZh: "100 · 500 · 1,000 U",
    metaEn: "100–1,000 U/day Cap",
    metaZh: "每日封顶 100–1,000 U",
    hrefMember: "/entering",
    hrefGuest: "/register?plan=P500",
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
    detailEn: "Upgrades activate at D+2 00:01 SGT right after 00:00 EOD.",
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
  const isZh = locale === "zh-CN";
  const [slideIdx, setSlideIdx] = useState(0);
  const [selectedNotice, setSelectedNotice] = useState<string | null>(null);
  const [previewRaceOpen, setPreviewRaceOpen] = useState(false);

  useEffect(() => {
    if (previewRaceOpen) return;
    const timer = setInterval(() => {
      setSlideIdx((prev) => (prev + 1) % HERO_POSTERS.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [previewRaceOpen]);

  const activeSlide = HERO_POSTERS[slideIdx];
  const loginHref = isAuthenticated ? "/entering" : "/login";
  const activeNoticeObj = NOTICES.find((n) => n.id === selectedNotice);

  return (
    <div className="min-h-screen bg-[#07080A] text-[#F2F0EB]">
      {previewRaceOpen && (
        <MarbleRaceLoader
          locale={locale}
          durationMs={2600}
          onComplete={() => setPreviewRaceOpen(false)}
        />
      )}

      {/* Minimal Sticky Top Bar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#07080A]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <Link href="/" className="inline-flex items-center">
            <Roll10Logo className="h-[24px] w-auto drop-shadow-[0_2px_10px_rgba(231,201,142,0.2)]" />
          </Link>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <LocaleToggle locale={locale} />
            <Link
              href={loginHref}
              className="r10-btn-gold-3d inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-4 text-xs font-bold tracking-tight transition-transform active:scale-[0.98]"
            >
              <LogIn className="h-3.5 w-3.5 stroke-[2.2]" />
              <span>
                {isAuthenticated
                  ? isZh
                    ? "进入会员中心"
                    : "Dashboard"
                  : isZh
                    ? "会员登录"
                    : "Member Login"}
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-5 pb-12 sm:space-y-8 sm:px-6 sm:py-7">
        {/* 1. Hero Visual Poster Stage (Image-Centric) */}
        <section aria-label={isZh ? "最新活动海报" : "Latest Event Posters"}>
          <div className="r10-hero-3d relative overflow-hidden rounded-[24px] shadow-[0_24px_60px_rgba(0,0,0,0.9)]">
            <div className="relative aspect-[16/10] w-full sm:aspect-[21/9]">
              <img
                src={activeSlide.image}
                alt={isZh ? activeSlide.titleZh : activeSlide.titleEn}
                className="h-full w-full object-cover object-center transition-opacity duration-500"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[#060709] via-[#060709]/35 to-transparent"
              />

              {/* Top-right sleek poster controls */}
              <div className="absolute right-3.5 top-3.5 flex items-center gap-1.5 sm:right-5 sm:top-5">
                <button
                  type="button"
                  onClick={() => setPreviewRaceOpen(true)}
                  className="r10-pill-dark-3d inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold text-[#F4DCAA] backdrop-blur-md transition hover:border-[#E7C98E]"
                >
                  <Play className="h-3 w-3 fill-current" />
                  <span>{isZh ? "10 珠竞速预览" : "10-Ball Race"}</span>
                </button>
                <button
                  type="button"
                  aria-label="Previous poster"
                  onClick={() =>
                    setSlideIdx((prev) => (prev - 1 + HERO_POSTERS.length) % HERO_POSTERS.length)
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/60 text-[#E5E7EC] backdrop-blur-md hover:border-[#E7C98E] hover:text-[#E7C98E]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next poster"
                  onClick={() => setSlideIdx((prev) => (prev + 1) % HERO_POSTERS.length)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/60 text-[#E5E7EC] backdrop-blur-md hover:border-[#E7C98E] hover:text-[#E7C98E]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Minimal Bottom Overlay: Badge + Concise Headline + CTA */}
              <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end gap-2.5 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-7">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#E7C98E]/50 bg-black/70 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-[#F4DCAA] backdrop-blur-sm">
                      <Sparkles className="h-3 w-3" />
                      <span>{isZh ? activeSlide.tagZh : activeSlide.tagEn}</span>
                    </span>
                    <span className="font-mono-sgt rounded-full border border-white/15 bg-black/60 px-2.5 py-0.5 text-[10px] text-[#D6D8DE] backdrop-blur-sm">
                      {activeSlide.date}
                    </span>
                  </div>
                  <h1 className="mt-2 text-xl font-bold tracking-tight text-[#F8F6F1] drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] sm:text-3xl">
                    {isZh ? activeSlide.titleZh : activeSlide.titleEn}
                  </h1>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={loginHref}
                    className="r10-btn-gold-3d inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-4 text-xs font-bold sm:min-h-[44px] sm:px-5 sm:text-sm"
                  >
                    <span>
                      {isAuthenticated
                        ? isZh
                          ? "进入会员中心"
                          : "Enter Dashboard"
                        : isZh
                          ? "会员登录"
                          : "Member Login"}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex min-h-[40px] items-center rounded-xl border border-white/20 bg-black/65 px-3.5 text-xs font-semibold text-[#F2F0EB] backdrop-blur-sm hover:border-[#E7C98E] hover:text-[#E7C98E] sm:min-h-[44px] sm:text-sm"
                  >
                    {isZh ? "立即加入" : "Join"}
                  </Link>
                </div>
              </div>
            </div>

            {/* Minimal Bottom Slide Dots */}
            <div className="flex items-center justify-between border-t border-white/[0.08] bg-[#090B0F] px-4 py-2 sm:px-6">
              <div className="flex items-center gap-2">
                {HERO_POSTERS.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-label={`Poster ${idx + 1}`}
                    onClick={() => setSlideIdx(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === slideIdx ? "w-7 bg-[#E7C98E]" : "w-2 bg-white/20 hover:bg-white/40"
                    }`}
                  />
                ))}
              </div>
              <span className="font-mono-sgt text-[10.5px] text-[#9DA4B0]">
                {String(slideIdx + 1).padStart(2, "0")} /{" "}
                {String(HERO_POSTERS.length).padStart(2, "0")}
              </span>
            </div>
          </div>
        </section>

        {/* 2. Visual Event & Offer Gallery (Image-First, Zero Paragraph Clutter) */}
        <section aria-label={isZh ? "即将来临活动与最新优惠" : "Events & Offers Gallery"}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {VISUAL_CARDS.map((card) => (
              <Link
                key={card.id}
                href={isAuthenticated ? card.hrefMember : card.hrefGuest}
                className="group r10-card-3d relative overflow-hidden rounded-2xl transition-transform duration-200 hover:-translate-y-0.5 hover:border-[#E7C98E]/55"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden">
                  <img
                    src={card.image}
                    alt={isZh ? card.titleZh : card.titleEn}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-[#08090C] via-[#08090C]/30 to-transparent"
                  />
                  <span className="absolute left-3 top-3 rounded-full border border-[#E7C98E]/45 bg-black/70 px-2.5 py-0.5 font-mono-sgt text-[10px] font-bold tracking-wider text-[#F4DCAA] backdrop-blur-sm">
                    {isZh ? card.badgeZh : card.badgeEn}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 px-4 py-3.5">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-[#F7F5F0] group-hover:text-[#E7C98E]">
                      {isZh ? card.titleZh : card.titleEn}
                    </h2>
                    <div className="mt-0.5 font-mono-sgt text-[11px] text-[#9DA4B0]">
                      {isZh ? card.metaZh : card.metaEn}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[#C9A66B] transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 3. Compact Announcement Strip (Single-Line Pills + Optional Click Detail) */}
        <section
          aria-label={isZh ? "主要公告" : "Announcements"}
          className="r10-card-3d rounded-2xl px-4 py-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E7C98E]">
              <Megaphone className="h-3.5 w-3.5" />
              <span>{isZh ? "公告" : "Notices"}</span>
            </span>

            <div className="flex flex-wrap items-center gap-1.5">
              {NOTICES.map((n) => {
                const active = selectedNotice === n.id;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setSelectedNotice(active ? null : n.id)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                      active
                        ? "border-[#E7C98E] bg-[#E7C98E]/15 text-[#F7E5BA]"
                        : "border-white/10 bg-[#0B0D11] text-[#CBD0DA] hover:border-[#E7C98E]/50 hover:text-[#E7C98E]"
                    }`}
                  >
                    {isZh ? n.pillZh : n.pillEn}
                  </button>
                );
              })}
            </div>
          </div>

          {activeNoticeObj && (
            <p className="mt-2.5 border-t border-white/[0.07] pt-2 text-xs text-[#CBD0DA]">
              {isZh ? activeNoticeObj.detailZh : activeNoticeObj.detailEn}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
