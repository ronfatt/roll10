"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Box,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Link2,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatDecisionBasisLabel, formatLegLabel } from "@/lib/i18n-labels";
import type { PortalHomePayload } from "@/lib/portal-home";
import { formatBv, formatU, formatUsdtMicros } from "@/lib/money";
import {
  computeMidnightCountdownState,
  formatMemberCountText,
} from "@/lib/rollover-clock";
import { Roll10BrandCombo, Roll10Logo, Roll10OrbitalIcon } from "@/components/Roll10Logo";
import {
  BottomDrawer,
  CheckeredFlagIcon,
  ContourWaveOverlay,
  HeroRacetrackBackdrop,
  MatchingGauge,
  TachometerDial,
} from "@/components/MotionPrimitives";

interface HomeProps {
  t: Dictionary;
  locale: Locale;
  referralLink: string;
  initialData: PortalHomePayload | null;
  initialError?: string | null;
  justActivated?: boolean;
}

export function HomeClient({
  t,
  locale,
  referralLink,
  initialData,
  initialError = null,
  justActivated = false,
}: HomeProps) {
  const [data, setData] = useState<PortalHomePayload | null>(initialData);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialError);
  const [retrying, setRetrying] = useState(false);

  const [eodDrawerOpen, setEodDrawerOpen] = useState(false);
  const [upgradeDrawerOpen, setUpgradeDrawerOpen] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Server-anchored monotonic clock offset so countdown stays exact without local clock drift
  const syncedPerfRef = useRef<number>(
    typeof performance !== "undefined" ? performance.now() : 0
  );
  const [elapsedMs, setElapsedMs] = useState(0);
  const [settledNotice, setSettledNotice] = useState<{
    settlementDate: string;
    retainedSide: string;
    flushedBv: number;
  } | null>(null);
  const settlingStartedAtRef = useRef<string | null>(null);

  const syncFromServer = useCallback(async (isRetry = false) => {
    if (isRetry) setRetrying(true);
    try {
      const res = await fetch("/api/portal/home", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok || !json.data) {
        setErrorMsg(json.error || t.common.loadError);
        return null;
      }
      const nextPayload = json.data as PortalHomePayload;
      syncedPerfRef.current = performance.now();
      setElapsedMs(0);
      setData(nextPayload);
      setErrorMsg(null);
      return nextPayload;
    } catch {
      setErrorMsg(t.common.loadError);
      return null;
    } finally {
      if (isRetry) setRetrying(false);
    }
  }, [t.common.loadError]);

  // 1s client tick synced to serverNowIso
  useEffect(() => {
    if (!data) return;
    syncedPerfRef.current = performance.now();
    setElapsedMs(0);
    const id = setInterval(() => {
      setElapsedMs(Math.max(0, performance.now() - syncedPerfRef.current));
    }, 1000);
    return () => clearInterval(id);
  }, [data]);

  // Resync immediately when tab returns to foreground / gains focus
  useEffect(() => {
    const onFocus = () => void syncFromServer(false);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncFromServer(false);
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [syncFromServer]);

  const clockState = data
    ? computeMidnightCountdownState({
        serverNowIso: data.serverNowIso,
        nextRolloverAtIso: data.nextRolloverAtIso,
        elapsedClientMs: elapsedMs,
        flushedBv: data.eodPreview.flushedBv,
      })
    : null;

  // Poll server when countdown hits 00:00:00 until EOD settles cleanly, then show settled summary
  useEffect(() => {
    if (!data || !clockState) return;
    if (!clockState.isSettling) {
      settlingStartedAtRef.current = null;
      return;
    }
    if (!settlingStartedAtRef.current) {
      settlingStartedAtRef.current = data.settlementDate;
    }
    const targetClosedDate = settlingStartedAtRef.current;

    const pollTimer = setInterval(async () => {
      const next = await syncFromServer(false);
      if (next?.latestEod && next.latestEod.settlementDate >= targetClosedDate) {
        setSettledNotice({
          settlementDate: next.latestEod.settlementDate,
          retainedSide: next.latestEod.retainedSide,
          flushedBv: next.latestEod.flushedBv,
        });
        settlingStartedAtRef.current = null;
      }
    }, 4000);

    return () => clearInterval(pollTimer);
  }, [data, clockState, syncFromServer]);

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      // Fallback ignored cleanly
    }
  };

  if (!data) {
    return (
      <div className="space-y-4">
        <header className="flex items-center justify-between pt-0.5 lg:hidden">
          <Roll10Logo className="h-[22px] w-auto" />
        </header>
        <section
          role="alert"
          className="rounded-2xl border border-[#6E512D]/45 bg-[#14171C] p-6 text-center"
        >
          <AlertTriangle className="mx-auto h-7 w-7 text-[#E7C98E]" />
          <p className="mt-3 text-sm font-medium text-[#F2F0EB]">
            {errorMsg || t.common.loadError}
          </p>
          <button
            type="button"
            onClick={() => void syncFromServer(true)}
            disabled={retrying}
            className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E7C98E] px-5 text-xs font-semibold text-[#08090B]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
            <span>{retrying ? t.common.loading : t.common.retry}</span>
          </button>
        </section>
      </div>
    );
  }

  const {
    member,
    pendingOrderId,
    pendingOrderNo,
    pendingOrderPaymentStatus,
    waitingUpgrade,
    recentEffectiveTransition,
    eodPreview,
    latestEod,
  } = data;

  const capReached =
    member.dailyCapPointsCents > 0 && member.todayPairedCents >= member.dailyCapPointsCents;

  const matchingRatioPct =
    member.dailyCapPointsCents > 0
      ? Math.min(100, Math.round((member.todayPairedCents / member.dailyCapPointsCents) * 100))
      : 0;

  const balanceStr = formatU(member.availablePointsCents);
  const longBalance = balanceStr.length > 9;
  const rolloverProgress = clockState
    ? 1 - Math.min(86_400_000, Math.max(0, clockState.remainingMs)) / 86_400_000
    : 0.72;

  // Format crisp rollover summary text in EN / zh-CN
  const buildEstimateDetail = () => {
    const isZh = locale === "zh-CN";
    return isZh
      ? `左区保留 ${member.leftBv.toLocaleString()} 积分 · 右区保留 ${member.rightBv.toLocaleString()} 积分`
      : `Left retains ${member.leftBv.toLocaleString()} pts · Right retains ${member.rightBv.toLocaleString()} pts`;
  };

  return (
    <div className="space-y-3 pb-3">
      {/* Inline error notice if a background refresh failed (preserves prior non-zero values) */}
      {errorMsg && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-[#14171C] px-3.5 py-2.5 text-xs text-[#F2F0EB]"
        >
          <span className="truncate">{errorMsg}</span>
          <button
            type="button"
            onClick={() => void syncFromServer(true)}
            disabled={retrying}
            className="shrink-0 font-semibold text-[#E7C98E] hover:underline"
          >
            {retrying ? t.common.loading : t.common.retry}
          </button>
        </div>
      )}

      {/* 1. Sculpted Top Header: 滚动星球 ROLL10 Logo left · | 1,000 BV Plan right */}
      <header className="r10-enter flex items-center justify-between gap-3 pt-0.5 lg:hidden">
        <Link href="/dashboard" className="inline-flex min-h-[38px] items-center">
          <Roll10BrandCombo />
        </Link>

        <Link
          href={waitingUpgrade ? `/packages?orderId=${waitingUpgrade.orderId}` : "/packages"}
          className="inline-flex min-h-[36px] items-center gap-2.5 pl-2 text-[12.5px] font-medium tracking-tight text-[#CAD7E6] transition-colors hover:text-[#51E7FA]"
        >
          <span className="h-3.5 w-px bg-white/20" aria-hidden="true" />
          <span className="whitespace-nowrap font-semibold">{member.planBadge}</span>
        </Link>
      </header>

      {/* Desktop Plan / Status Sub-bar */}
      <div className="hidden items-center justify-between border-b border-[#2B3D4D] pb-2.5 lg:flex">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-[#F4F8FC]">{member.displayName}</span>
          <span className="font-mono-sgt text-xs text-[#AAB8C7]">{member.memberCode}</span>
        </div>
        <Link
          href={waitingUpgrade ? `/packages?orderId=${waitingUpgrade.orderId}` : "/packages"}
          className="inline-flex min-h-[36px] items-center gap-2 rounded-full border border-[#2B3D4D] bg-[#101B27] px-3.5 text-xs font-medium text-[#51E7FA] transition-colors hover:border-[#51E7FA]"
        >
          <span>{member.planBadge}</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Just-Activated Success Notice */}
      {justActivated && (
        <section className="r10-enter flex items-center gap-2.5 rounded-2xl border border-emerald-500/40 bg-[#14171C] px-4 py-3 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>
            {t.overview.currentPackage}: {member.planBadge}
          </span>
        </section>
      )}

      {/* Pending Activation Alert for Unactivated Member */}
      {member.status === "PENDING_PAYMENT" && (
        <section className="r10-enter flex items-start gap-3 rounded-2xl border border-[#6E512D]/60 bg-[#14171C] p-3.5 text-xs text-[#F2F0EB]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#E7C98E]" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-[#E7C98E]">
              {t.overview.pendingActivation}
              {pendingOrderNo ? ` · ${pendingOrderNo} (${pendingOrderPaymentStatus})` : ""}
            </div>
            <p className="mt-0.5 text-[#9DA4B0]">
              {pendingOrderNo ? t.packages.awaitingAdmin : t.overview.cutoffBanner}
            </p>
            <Link
              href={pendingOrderId ? `/orders/${pendingOrderId}` : "/packages"}
              className="mt-1.5 inline-flex items-center gap-1 font-semibold text-[#E7C98E] hover:underline"
            >
              <span>{pendingOrderId ? t.deposit.title : t.overview.upgradeCta}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      )}

      {/* Settled Post-Rollover Notice when transitioned from 00:00 */}
      {settledNotice && (
        <section className="r10-enter flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/35 bg-[#14171C] px-4 py-3 text-xs">
          <div className="min-w-0">
            <div className="font-semibold text-emerald-300">
              {t.overview.rolloverSettledTitle} ({settledNotice.settlementDate})
            </div>
            <div className="mt-0.5 text-[#9DA4B0]">
              {settledNotice.retainedSide} · Flush {formatBv(settledNotice.flushedBv)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSettledNotice(null)}
            className="text-[11px] font-medium text-[#E7C98E] hover:underline"
          >
            OK
          </button>
        </section>
      )}

      {/* 2. Precision Titanium-Motorsport Telemetry Hero Card */}
      <section className="r10-enter r10-hero-titanium relative overflow-hidden rounded-[22px]">
        {/* Sweeping circuit curve, apex curbs & cyan horizon light streak */}
        <HeroRacetrackBackdrop />

        {/* Subtle top edge specular catchlight */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-[#A5F6FF]/70 via-[#51E7FA]/35 to-transparent"
        />

        <div className="relative z-10 p-3.5 sm:p-5">
          {/* Two-column on >=380px, stacks countdown cleanly onto row 2 at 360px */}
          <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-[1.05fr_0.95fr] min-[380px]:items-center">
            {/* Left: Withdrawable U Balance & Titanium Brushed CTA */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className="h-3.5 w-[2.5px] rounded-full bg-[#51E7FA] shadow-[0_0_8px_rgba(81,231,250,0.85)]"
                  aria-hidden="true"
                />
                <span className="whitespace-nowrap text-[11.5px] font-medium text-[#CAD7E6]">
                  {t.overview.withdrawableLabel}
                </span>
              </div>

              <div
                className={`mt-1.5 flex items-baseline gap-1.5 font-bold tracking-tight tabular-nums drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] ${
                  longBalance ? "text-[26px] sm:text-[32px]" : "text-[32px] sm:text-[36px]"
                } leading-none`}
              >
                <span className="text-[#F2CD7E]">{balanceStr}</span>
                <span className="text-[19px] sm:text-[22px] font-black italic text-[#F2CD7E]">
                  U
                </span>
              </div>

              {member.lockedPointsCents > 0 && (
                <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-[#AAB8C7]">
                  <span>{t.overview.frozenLabel}:</span>
                  <span className="tabular-nums font-medium text-[#F4F8FC]">
                    {formatU(member.lockedPointsCents)} {t.common.points}
                  </span>
                </div>
              )}

              <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                <Link
                  href="/wallet?mode=withdraw"
                  className="r10-btn-titanium inline-flex min-h-[38px] items-center justify-center gap-1 rounded-xl px-4 text-[12.5px] font-bold tracking-tight shadow-md transition-transform duration-100 active:scale-[0.98]"
                >
                  <span>{t.overview.withdrawCta}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.4]" />
                </Link>

                <Link
                  href="/wallet"
                  className="inline-flex min-h-[38px] items-center gap-0.5 rounded-xl border border-[#2B3D4D] bg-[#0E1722]/80 px-3 text-[11px] font-medium text-[#CAD7E6] backdrop-blur-xs transition-colors hover:border-[#51E7FA]/55 hover:text-[#51E7FA]"
                >
                  <span>{t.overview.ledgerCta}</span>
                  <ChevronRight className="h-3 w-3 text-[#AAB8C7]" />
                </Link>
              </div>
            </div>

            {/* Right: 3D Motorsport Tachometer Countdown Instrument */}
            <div
              role="status"
              aria-label={`${t.overview.rolloverCountdownLabel} 00:00 SGT`}
              className={`rounded-2xl transition-colors ${
                clockState?.isUrgentAmber ? "r10-amber-once bg-amber-500/[0.06] py-1" : ""
              }`}
            >
              <TachometerDial
                progress={clockState?.isSettling ? 1 : rolloverProgress}
                isUrgentAmber={Boolean(clockState?.isUrgentAmber)}
              >
                <span className="text-[10px] font-medium text-[#CAD7E6]">
                  {t.overview.rolloverCountdownLabel}
                </span>

                {clockState?.isSettling ? (
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[#51E7FA]">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>{t.overview.rolloverSettling}</span>
                  </div>
                ) : (
                  <div
                    className={`font-mono-sgt mt-1 whitespace-nowrap text-[18.5px] sm:text-[21px] font-bold tracking-wide tabular-nums text-[#F4F8FC] drop-shadow-[0_0_12px_rgba(81,231,250,0.45)] ${
                      clockState?.isUrgentAmber ? "text-amber-300" : "text-[#F4F8FC]"
                    }`}
                  >
                    {clockState?.hhmmss.slice(0, 6) ?? "00:00:"}
                    <span key={clockState?.secondsPart} className="r10-second-fade inline-block">
                      {clockState?.secondsPart ?? "00"}
                    </span>
                  </div>
                )}

                <span className="font-mono-sgt mt-0.5 text-[10px] font-medium text-[#AAB8C7]">
                  {t.overview.rolloverMidnightTag}
                </span>

                {clockState?.isUrgentAmber && (
                  <span className="mt-0.5 text-[9.5px] font-semibold text-amber-300">
                    {formatBv(eodPreview.flushedBv)}
                  </span>
                )}
              </TachometerDial>
            </div>
          </div>

          {/* Nested Recessed Bottom Rollover Estimate Strip (Full text visible without ellipsis) */}
          <button
            type="button"
            onClick={() => setEodDrawerOpen(true)}
            className="mt-3 flex min-h-[38px] w-full items-center justify-between gap-2 rounded-xl border border-[#2B3D4D] bg-[#0A101A]/90 px-2.5 py-1.5 text-left text-[10.5px] shadow-[inset_0_2px_6px_rgba(0,0,0,0.75)] backdrop-blur-xs transition-colors hover:border-[#51E7FA]/55"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-snug">
              <CheckeredFlagIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="shrink-0 font-medium text-[#CAD7E6]">
                {locale === "zh-CN" ? "预计结转" : "Est. rollover"}
              </span>
              <span className="h-2.5 w-px shrink-0 bg-white/15" aria-hidden="true" />
              <span className="font-medium tabular-nums text-[#F4F8FC]">
                {buildEstimateDetail()}
              </span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#AAB8C7]" />
          </button>
        </div>
      </section>

      {/* 3. Left & Right Team BV Dual-Chamber 3D Titanium Card */}
      <section className="r10-enter r10-delay-1 r10-card-titanium relative overflow-hidden rounded-[20px]">
        <ContourWaveOverlay className="absolute -bottom-1 right-0 h-[72px] w-[180px] opacity-85" />
        <div className="relative z-10 grid grid-cols-2 divide-x divide-[#2B3D4D]">
          <Link
            href="/tree?tab=placement&leg=LEFT"
            className="block px-4 py-3.5 transition-colors hover:bg-white/[0.025]"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-[5px] bg-gradient-to-b from-[#7CF0FD] to-[#18C5DC] text-[11px] font-bold text-[#0A101A] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_6px_rgba(81,231,250,0.35)]">
                L
              </span>
              <span className="text-[12.5px] font-medium text-[#CAD7E6]">
                {locale === "zh-CN" ? "左区积分" : "Left Points"}
              </span>
              <span className="ml-auto h-2 w-2 rounded-full bg-[#51E7FA] shadow-[0_0_8px_#51E7FA]" />
            </div>
            <div className="mt-2 truncate tabular-nums text-[23px] font-bold leading-tight tracking-tight text-[#F4F8FC]">
              {member.leftBv.toLocaleString("en-US")}{" "}
              <span className="text-sm font-semibold text-[#CAD7E6]">
                {locale === "zh-CN" ? "积分" : "pts"}
              </span>
            </div>
            <div className="mt-0.5 tabular-nums text-[11.5px] text-[#AAB8C7]">
              {formatMemberCountText(member.leftCount, locale)}
            </div>
          </Link>

          <Link
            href="/tree?tab=placement&leg=RIGHT"
            className="block px-4 py-3.5 transition-colors hover:bg-white/[0.025]"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-[5px] bg-gradient-to-b from-[#FFF0CA] via-[#F2CD7E] to-[#C8A858] text-[11px] font-bold text-[#0A101A] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_6px_rgba(242,205,126,0.35)]">
                R
              </span>
              <span className="text-[12.5px] font-medium text-[#CAD7E6]">
                {locale === "zh-CN" ? "右区积分" : "Right Points"}
              </span>
              <span className="ml-auto h-2 w-2 rounded-full bg-[#F2CD7E] shadow-[0_0_8px_#F2CD7E]" />
            </div>
            <div className="mt-2 truncate tabular-nums text-[23px] font-bold leading-tight tracking-tight text-[#F4F8FC]">
              {member.rightBv.toLocaleString("en-US")}{" "}
              <span className="text-sm font-semibold text-[#CAD7E6]">
                {locale === "zh-CN" ? "积分" : "pts"}
              </span>
            </div>
            <div className="mt-0.5 tabular-nums text-[11.5px] text-[#AAB8C7]">
              {formatMemberCountText(member.rightCount, locale)}
            </div>
          </Link>
        </div>
      </section>

      {/* 4. Compact Horizontal "My Referrals" Telemetry Capsule */}
      <section className="r10-enter r10-delay-1 r10-card-titanium relative overflow-hidden rounded-[20px] px-3.5 py-3">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-[#51E7FA]/50 to-transparent"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Header Label + U = USDT note */}
          <Link
            href="/referrals"
            className="flex min-w-0 items-center gap-1.5 text-[#F4F8FC] transition-colors hover:text-[#51E7FA]"
          >
            <Users className="h-3.5 w-3.5 shrink-0 text-[#51E7FA]" strokeWidth={1.8} />
            <span className="whitespace-nowrap text-[12px] font-medium">
              {t.overview.myReferralsTitle}
            </span>
            <span className="whitespace-nowrap rounded border border-[#51E7FA]/30 bg-black/40 px-1.5 py-0.5 text-[9.5px] font-medium text-[#51E7FA]">
              {t.overview.usdtUnitNote}
            </span>
          </Link>

          {/* Copy Invite Link Pill */}
          <button
            type="button"
            onClick={() => void handleCopyInvite()}
            className="order-2 min-[460px]:order-3 inline-flex min-h-[32px] shrink-0 items-center justify-center gap-1 rounded-lg border border-[#51E7FA]/40 bg-[#51E7FA]/12 px-2.5 text-[10.5px] font-semibold text-[#51E7FA] shadow-sm transition-all hover:border-[#51E7FA] hover:bg-[#51E7FA]/20 active:scale-[0.98]"
          >
            {copiedInvite ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-300">{t.overview.inviteCopied}</span>
              </>
            ) : (
              <>
                <Link2 className="h-3 w-3 text-[#51E7FA]" />
                <span>{t.overview.copyInviteLink}</span>
              </>
            )}
          </button>

          {/* Metrics Row: Direct Referrals & Earned Referral CP */}
          <div className="order-3 min-[460px]:order-2 grid w-full min-[460px]:w-auto min-[460px]:flex-1 grid-cols-2 items-center gap-3 border-t border-white/[0.06] pt-2 min-[460px]:border-t-0 min-[460px]:pt-0">
            <Link
              href="/tree?tab=referral"
              className="group min-w-0 transition-opacity hover:opacity-90"
            >
              <div className="flex items-baseline gap-1 tabular-nums text-[18px] font-bold leading-none text-[#F4F8FC]">
                <span>{member.directReferralCount}</span>
                {locale === "zh-CN" && (
                  <span className="text-[11px] font-medium text-[#AAB8C7]">人</span>
                )}
                <span className="ml-1 rounded border border-[#51E7FA]/35 bg-[#51E7FA]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#51E7FA]">
                  {member.directRatePercent ?? 25}%
                </span>
              </div>
              <div className="mt-1 text-[10.5px] leading-tight text-[#AAB8C7]">
                {t.overview.directReferralsLabel}
              </div>
            </Link>

            <Link
              href="/wallet?filter=DIRECT"
              className="group min-w-0 transition-opacity hover:opacity-90"
            >
              <div className="flex items-baseline gap-1 tabular-nums text-[18px] font-bold leading-none text-[#F4F8FC]">
                <span>{formatU(member.directCommissionCpCents ?? member.directCommissionCents)}</span>
                <span className="text-[12.5px] font-bold text-[#51E7FA]">CP</span>
              </div>
              <div className="mt-1 text-[10.5px] leading-tight text-[#AAB8C7]">
                {t.overview.referralRewardsEarnedLabel}
                {(member.differentialCpCents ?? 0) > 0 && (
                  <span className="ml-1 text-[10px] text-[#A5F6FF]">
                    (+{formatU(member.differentialCpCents)} 极差)
                  </span>
                )}
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* 5. Today's Matching Bonus Telemetry Card */}
      <section className="r10-enter r10-delay-2 r10-card-titanium relative overflow-hidden rounded-[20px] px-4 py-3.5 space-y-2.5">
        <ContourWaveOverlay className="absolute -bottom-2 right-0 h-[78px] w-[190px] opacity-90" />

        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="h-3.5 w-[2.5px] rounded-full bg-[#51E7FA] shadow-[0_0_8px_rgba(81,231,250,0.8)]"
              aria-hidden="true"
            />
            <span className="text-[12.5px] font-medium text-[#CAD7E6]">{t.overview.todayPairing}</span>
          </div>
          <span className="font-mono-sgt text-xs font-semibold text-[#51E7FA]">
            {matchingRatioPct}%
          </span>
        </div>

        <div className="relative z-10 flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1.5 tabular-nums tracking-tight">
            <span className="text-[22px] font-bold text-[#F4F8FC]">
              {formatU(member.todayPairedCents)}
            </span>
            <span className="text-[18px] font-semibold text-[#889AA8]">
              / {formatU(member.dailyCapPointsCents)}
            </span>
            <span className="text-[15px] font-bold text-[#51E7FA]">CP</span>
          </div>
          {capReached && (
            <span className="rounded-full border border-[#51E7FA]/45 bg-[#0A101A]/80 px-2.5 py-0.5 text-[11px] font-semibold text-[#51E7FA]">
              {t.overview.capReached}
            </span>
          )}
        </div>

        <div className="relative z-10">
          <MatchingGauge
            pairedCents={member.todayPairedCents}
            capCents={member.dailyCapPointsCents}
          />
        </div>
      </section>

      {/* 6. Packages & Upgrade Action Capsule */}
      <section className="r10-enter r10-delay-3">
        {waitingUpgrade ? (
          <button
            type="button"
            onClick={() => setUpgradeDrawerOpen(true)}
            className="r10-card-titanium flex min-h-[48px] w-full items-center justify-between gap-3 rounded-2xl px-4 py-2.5 text-left transition-colors hover:border-[#51E7FA]/50"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Box className="h-4.5 w-4.5 shrink-0 text-[#51E7FA]" strokeWidth={1.75} />
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-[#F4F8FC]">
                  {t.overview.scheduledUpgradeNotice}
                </div>
                <div className="mt-0.5 text-[11px] text-[#AAB8C7]">
                  {waitingUpgrade.fromPlanShort} → {waitingUpgrade.toPlanShort}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 font-mono-sgt text-xs text-[#51E7FA]">
              <span>{waitingUpgrade.effectiveShortLabel}</span>
              <ChevronRight className="h-4 w-4 text-[#AAB8C7]" />
            </div>
          </button>
        ) : recentEffectiveTransition ? (
          <Link
            href="/packages"
            className="r10-card-titanium flex min-h-[48px] items-center justify-between gap-3 rounded-2xl px-4 py-2.5 transition-colors hover:border-[#51E7FA]/45"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Box className="h-4.5 w-4.5 shrink-0 text-[#51E7FA]" strokeWidth={1.75} />
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-[#F4F8FC]">
                  {recentEffectiveTransition.upgradeToCode} · {t.packages.title}
                </div>
                <div className="mt-0.5 font-mono-sgt text-[11px] text-[#AAB8C7]">
                  {recentEffectiveTransition.upgradeEffectiveLabel}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-[#51E7FA]">
              <span>
                +{formatU(recentEffectiveTransition.catchupPointsCents)} {t.common.points}
              </span>
              <ChevronRight className="h-4 w-4 text-[#AAB8C7]" />
            </div>
          </Link>
        ) : (
          <Link
            href="/packages"
            className="r10-card-titanium flex min-h-[46px] items-center justify-between gap-3 rounded-2xl px-4 text-[13px] font-medium text-[#CAD7E6] transition-colors hover:border-[#51E7FA]/45 hover:text-[#51E7FA]"
          >
            <span className="flex items-center gap-3">
              <Box className="h-4.5 w-4.5 text-[#51E7FA]" strokeWidth={1.75} />
              <span>{t.overview.upgradeCta}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-[#AAB8C7]" />
          </Link>
        )}
      </section>

      {/* 7. New Arcade (游戏厅) Preview Action Card */}
      <section className="r10-enter r10-delay-3">
        <Link
          href="/arcade"
          className="r10-card-titanium flex min-h-[50px] items-center justify-between gap-3 rounded-2xl px-4 py-3 transition-colors hover:border-[#51E7FA]/55 group"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Roll10OrbitalIcon className="h-6 w-auto drop-shadow-[0_0_8px_rgba(81,231,250,0.5)] shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-[#F4F8FC] group-hover:text-[#51E7FA] transition-colors">
                  {locale === "zh-CN" ? "游戏厅 · 钢珠竞赛" : "Arcade · Steel Ball Racing"}
                </span>
                <span className="rounded-full border border-[#51E7FA]/40 bg-[#51E7FA]/10 px-2 py-0.5 text-[10px] font-semibold text-[#51E7FA]">
                  {locale === "zh-CN" ? "即将开放" : "Coming Soon"}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-[#AAB8C7]">
                {locale === "zh-CN"
                  ? "3D 竞速直播与选号功能即将开放 · 敬请期待"
                  : "3D racing live stream and ball selection coming soon"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 text-xs text-[#AAB8C7] group-hover:text-[#51E7FA] transition-colors">
            <ChevronRight className="h-4 w-4" />
          </div>
        </Link>
      </section>

      {/* Bottom Drawer: 00:00 SGT Rollover Preview & Decision Basis */}
      <BottomDrawer
        open={eodDrawerOpen}
        onClose={() => setEodDrawerOpen(false)}
        title={t.overview.carryoverEstimateBtn}
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-[#2B3D4D] bg-[#0A101A] p-3">
              <div className="text-[#AAB8C7]">{t.overview.leftBv}</div>
              <div className="mt-1 tabular-nums text-base font-bold text-[#F4F8FC]">
                {formatBv(eodPreview.leftBv)}
              </div>
              <div className="mt-0.5 text-[11px] text-[#AAB8C7]">
                {formatMemberCountText(eodPreview.leftCount, locale)}
              </div>
            </div>
            <div className="rounded-xl border border-[#2B3D4D] bg-[#0A101A] p-3">
              <div className="text-[#AAB8C7]">{t.overview.rightBv}</div>
              <div className="mt-1 tabular-nums text-base font-bold text-[#F4F8FC]">
                {formatBv(eodPreview.rightBv)}
              </div>
              <div className="mt-0.5 text-[11px] text-[#AAB8C7]">
                {formatMemberCountText(eodPreview.rightCount, locale)}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#2B3D4D] bg-[#0A101A] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[#AAB8C7]">
                {locale === "zh-CN" ? "预估保留区" : "Estimated Retained Side"}
              </span>
              <span className="font-semibold text-[#F4F8FC]">
                {formatLegLabel(eodPreview.retainedSide, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#AAB8C7]">
                {locale === "zh-CN" ? "预估结转保留积分" : "Estimated Carryover Points"}
              </span>
              <span className="tabular-nums font-semibold text-[#51E7FA]">
                {formatBv(eodPreview.carryoverBv)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#AAB8C7]">
                {locale === "zh-CN" ? "预估清零积分" : "Estimated Flushed Points"}
              </span>
              <span className="tabular-nums font-semibold text-[#CAD7E6]">
                0
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#AAB8C7]">
                {locale === "zh-CN" ? "结转判定依据" : "Settlement Rule"}
              </span>
              <span className="text-right font-mono-sgt text-[#51E7FA]">
                {locale === "zh-CN" ? "100% 全额保留" : "100% Retained"}
              </span>
            </div>
          </div>

          {latestEod && (
            <div className="rounded-xl border border-[#2B3D4D] bg-[#0A101A] p-4 space-y-1.5">
              <div className="font-semibold text-[#F4F8FC]">{t.overview.latestEodLabel}</div>
              <div className="font-mono-sgt text-[#AAB8C7]">{latestEod.settlementDate}</div>
              <div className="pt-1 text-[#CAD7E6]">
                {locale === "zh-CN" ? "保留 " : "Retained "}
                <strong className="text-[#F4F8FC]">
                  {locale === "zh-CN" ? "双区全额保留" : "Both Legs 100%"}
                </strong>{" "}
                · {locale === "zh-CN" ? "清零 " : "Flushed "}
                <strong className="tabular-nums text-[#51E7FA]">
                  0
                </strong>
              </div>
            </div>
          )}

          <p className="leading-relaxed text-[#AAB8C7]">
            {locale === "zh-CN"
              ? "根据新制度，每日 00:00 SGT 结算重置当日对碰封顶，左右区未对碰团队积分 100% 自动结转至下一日，零清零。"
              : "Under the confirmed rules, 00:00 SGT midnight settlement resets the daily pairing cap; un-paired team points on both legs roll over 100% to the next day with zero flushing."}
          </p>

          <Link
            href="/ledgers?tab=bv"
            onClick={() => setEodDrawerOpen(false)}
            className="r10-btn-cyan flex min-h-[44px] w-full items-center justify-center rounded-xl text-xs font-bold text-[#071118] transition-transform duration-100 active:scale-[0.98]"
          >
            {t.overview.viewEodRecords}
          </Link>
        </div>
      </BottomDrawer>

      {/* Bottom Drawer: Upgrade Pending Details */}
      {waitingUpgrade && (
        <BottomDrawer
          open={upgradeDrawerOpen}
          onClose={() => setUpgradeDrawerOpen(false)}
          title={t.overview.scheduledUpgradeNotice}
        >
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-[#6E512D]/50 bg-[#08090B] p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-semibold text-[#E7C98E]">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{waitingUpgrade.orderNo}</span>
                </span>
                <span className="rounded-full bg-[#C9A66B]/15 px-2.5 py-0.5 text-[10px] font-semibold text-[#E7C98E]">
                  {t.packages.waitingEffectiveBadge}
                </span>
              </div>

              <div className="text-base font-bold text-[#F2F0EB]">
                {waitingUpgrade.fromCode} → {waitingUpgrade.toCode}
              </div>

              <div className="space-y-1.5 border-t border-white/[0.08] pt-2.5 text-[#9DA4B0]">
                {waitingUpgrade.confirmedAtLabel && (
                  <div className="flex justify-between gap-2">
                    <span>{locale === "zh-CN" ? "付款确认时间 (SGT)" : "Confirmed (SGT)"}</span>
                    <span className="font-mono-sgt text-[#F2F0EB]">
                      {waitingUpgrade.confirmedAtLabel}
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span>{t.overview.effectiveOn}</span>
                  <span className="font-mono-sgt font-semibold text-[#E7C98E]">
                    {waitingUpgrade.effectiveAtLabel}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>{t.overview.capDuringWait}</span>
                  <span className="tabular-nums font-semibold text-[#F2F0EB]">
                    {formatU(waitingUpgrade.currentCapPointsCents)} {t.common.points}/
                    {locale === "zh-CN" ? "天" : "day"}
                  </span>
                </div>
              </div>
            </div>

            <p className="leading-relaxed text-[#9DA4B0]">{waitingUpgrade.naturalSchedule}</p>

            <Link
              href={`/packages?orderId=${waitingUpgrade.orderId}`}
              onClick={() => setUpgradeDrawerOpen(false)}
              className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#E7C98E] text-sm font-semibold text-[#08090B] transition-transform duration-100 active:scale-[0.98]"
            >
              {t.packages.orderDetailTitle}
            </Link>
          </div>
        </BottomDrawer>
      )}
    </div>
  );
}
