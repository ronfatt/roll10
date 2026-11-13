"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Flag, Lock, Shield, Trophy } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { SubpageCornerBranding } from "@/components/Roll10Logo";

export function ArcadeClient({ locale = "zh-CN" }: { locale?: Locale }) {
  const router = useRouter();
  const isZh = locale === "zh-CN";

  return (
    <div className="space-y-3.5 pb-4 max-w-xl mx-auto">
      {/* Top Header: < | 游戏厅  ···  ROLL10 small logo */}
      <header className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label={isZh ? "返回上一页" : "Go back"}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#2B3D4D] bg-[#101B27] text-[#CAD7E6] transition-colors hover:border-[#51E7FA] hover:text-[#51E7FA] active:scale-95"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="h-4 w-px bg-white/20" aria-hidden="true" />
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#F4F8FC]">
              {isZh ? "游戏厅" : "Arcade"}
            </h1>
          </div>
        </div>

        <SubpageCornerBranding />
      </header>

      {/* Upper Section: 钢珠竞赛直播 (16:9 blurred live stream preview) */}
      <section
        aria-label={isZh ? "钢珠竞赛直播" : "Steel Ball Live Racing"}
        className="r10-card-titanium overflow-hidden rounded-[20px] p-3.5 sm:p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="h-3.5 w-[2.5px] rounded-full bg-[#51E7FA] shadow-[0_0_8px_rgba(81,231,250,0.8)]"
              aria-hidden="true"
            />
            <h2 className="text-sm font-semibold tracking-tight text-[#F4F8FC]">
              {isZh ? "钢珠竞赛直播" : "Steel Ball Live"}
            </h2>
          </div>
          <span className="rounded-full border border-white/15 bg-black/50 px-2.5 py-0.5 text-[10px] font-medium text-[#AAB8C7]">
            {isZh ? "未开放" : "Not Open"}
          </span>
        </div>

        {/* 16:9 Live Window with blurred racetrack and metallic lock */}
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-[#2B3D4D] bg-[#0A101A] shadow-[inset_0_2px_8px_rgba(0,0,0,0.85)]">
          {/* Blurred racetrack backdrop */}
          <img
            src="/posters/arcade-track-preview.jpg"
            alt="Track"
            className="h-full w-full object-cover filter blur-[3px] scale-105 opacity-65"
            aria-hidden="true"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#0A101A]/95 via-[#0A101A]/40 to-[#0A101A]/70"
          />

          {/* Center Locked State Badge */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center select-none pointer-events-none">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#51E7FA]/40 bg-[#101B27]/90 shadow-[0_4px_20px_rgba(0,0,0,0.8),0_0_15px_rgba(81,231,250,0.25)]">
              <Lock className="h-5 w-5 text-[#51E7FA]" />
            </div>
            <p className="mt-2 text-sm sm:text-base font-bold tracking-tight text-[#F4F8FC] drop-shadow-md">
              {isZh ? "即将开放" : "Coming Soon"}
            </p>
            <p className="mt-0.5 text-[11px] text-[#AAB8C7]">
              {isZh ? "直播与选号功能暂未开放" : "Live stream and ball selection not yet open"}
            </p>
          </div>
        </div>
      </section>

      {/* Lower Section: 钢珠号码与赔率 (2x5 ball cards + 3 gameplay skeletons + locked CTA) */}
      <section
        aria-label={isZh ? "钢珠号码与赔率" : "Ball Numbers & Odds"}
        className="r10-card-titanium rounded-[20px] p-3.5 sm:p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="h-3.5 w-[2.5px] rounded-full bg-[#51E7FA] shadow-[0_0_8px_rgba(81,231,250,0.8)]"
              aria-hidden="true"
            />
            <h2 className="text-sm font-semibold tracking-tight text-[#F4F8FC]">
              {isZh ? "钢珠号码与赔率" : "Numbers & Odds"}
            </h2>
          </div>
          <Lock className="h-4 w-4 text-[#889AA8]" aria-hidden="true" />
        </div>

        {/* 2 x 5 Steel Ball Skeleton Cards (No sample numbers or real odds) */}
        <div
          aria-hidden="true"
          className="grid grid-cols-5 gap-1.5 sm:gap-2 select-none pointer-events-none"
        >
          {Array.from({ length: 10 }).map((_, idx) => (
            <div
              key={idx}
              className="flex flex-col items-center justify-center rounded-xl border border-[#2B3D4D]/70 bg-[#0E1622]/90 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            >
              {/* Metallic 3D Steel Ball Silhouette with Cyan Specular Slit */}
              <div className="relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-gradient-to-b from-[#CAD7E6] via-[#65798C] to-[#1E2B38] shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                <span
                  aria-hidden="true"
                  className="h-0.5 w-6 rounded-full bg-[#51E7FA] opacity-80 shadow-[0_0_6px_#51E7FA]"
                />
              </div>
              {/* Grey placeholder bar outline for odds */}
              <span className="mt-1.5 h-1.5 w-6 rounded-full bg-white/10" />
            </div>
          ))}
        </div>

        {/* 3 Gameplay Option Pills Skeleton */}
        <div
          aria-hidden="true"
          className="grid grid-cols-3 gap-2 pt-1 select-none pointer-events-none"
        >
          <div className="flex items-center justify-center gap-1.5 rounded-xl border border-[#2B3D4D]/50 bg-[#0A111A]/80 py-2.5 px-2">
            <Flag className="h-3.5 w-3.5 text-[#51E7FA]/50" />
            <span className="h-2 w-9 rounded-full bg-white/10" />
          </div>
          <div className="flex items-center justify-center gap-1.5 rounded-xl border border-[#2B3D4D]/50 bg-[#0A111A]/80 py-2.5 px-2">
            <Shield className="h-3.5 w-3.5 text-[#51E7FA]/50" />
            <span className="h-2 w-9 rounded-full bg-white/10" />
          </div>
          <div className="flex items-center justify-center gap-1.5 rounded-xl border border-[#2B3D4D]/50 bg-[#0A111A]/80 py-2.5 px-2">
            <Trophy className="h-3.5 w-3.5 text-[#51E7FA]/50" />
            <span className="h-2 w-9 rounded-full bg-white/10" />
          </div>
        </div>

        {/* Disabled Grey Locked Action Button */}
        <button
          type="button"
          disabled
          tabIndex={-1}
          aria-disabled="true"
          className="mt-2 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-[#2B3D4D] bg-[#16212E] text-xs font-semibold text-[#889AA8] cursor-not-allowed select-none opacity-85 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
        >
          <Lock className="h-3.5 w-3.5" />
          <span>{isZh ? "暂未开放" : "Locked / Coming Soon"}</span>
        </button>
      </section>
    </div>
  );
}
