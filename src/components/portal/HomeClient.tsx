"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  BookOpen,
  Box,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Gamepad2,
  Gift,
  Layers,
  Link2,
  RefreshCw,
  ShieldAlert,
  UserPlus,
  Users,
} from "lucide-react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatDecisionBasisLabel, formatLegLabel } from "@/lib/i18n-labels";
import type { PortalHomePayload } from "@/lib/portal-home";
import { formatBv, formatU, formatUsdtMicros } from "@/lib/money";
import { getPackageTierName } from "@/lib/packages";
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

      {/* 1. Header: Brand Logo, Notification Bell, Member Greeting & Tier Badge */}
      <header className="r10-enter pt-0.5 pb-1 space-y-2.5">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="inline-flex min-h-[38px] items-center">
            <Roll10BrandCombo />
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopyInvite()}
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[#29363D] bg-[#10171B] text-[#B0BBC2] transition hover:border-[#E9C66B] hover:text-[#E9C66B]"
              aria-label="Notifications & Invite"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-[#00D9DF]" />
            </button>
          </div>
        </div>

        {/* Member Greeting & Badge */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[17px] font-bold text-[#F4F6F7]">
              {locale === "zh-CN" ? `你好，${member.displayName}` : `Hello, ${member.displayName}`}
            </div>
            <div className="font-mono-sgt text-[11px] text-[#829098]">{member.memberCode}</div>
          </div>
          <Link
            href="/packages"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E9C66B]/60 bg-gradient-to-r from-[#FFE8A3]/15 via-[#E9C66B]/10 to-transparent px-2.5 py-1 text-xs font-bold text-[#E9C66B] shadow-[0_0_10px_rgba(233,198,107,0.15)] transition hover:border-[#E9C66B]"
          >
            <span>{getPackageTierName(member.currentPackageCode)} 会员</span>
            <span className="text-[10px] text-[#00D9DF]">({member.directRatePercent ?? 35}%)</span>
          </Link>
        </div>
      </header>

      {/* Just-Activated Success Notice */}
      {justActivated && (
        <section className="r10-enter flex items-center gap-2.5 rounded-2xl border border-emerald-500/40 bg-[#10171B] px-4 py-3 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>
            {t.overview.currentPackage}: {member.planBadge}
          </span>
        </section>
      )}

      {/* Pending Activation Alert for Unactivated Member */}
      {member.status === "PENDING_PAYMENT" && (
        <section className="r10-enter flex items-start gap-3 rounded-2xl border border-[#9B7433]/60 bg-[#10171B] p-3.5 text-xs text-[#F4F6F7]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#E9C66B]" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-[#E9C66B]">
              {t.overview.pendingActivation}
              {pendingOrderNo ? ` · ${pendingOrderNo} (${pendingOrderPaymentStatus})` : ""}
            </div>
            <p className="mt-0.5 text-[#B0BBC2]">
              {pendingOrderNo ? t.packages.awaitingAdmin : t.overview.cutoffBanner}
            </p>
            <Link
              href={pendingOrderId ? `/orders/${pendingOrderId}` : "/packages"}
              className="mt-1.5 inline-flex items-center gap-1 font-semibold text-[#E9C66B] hover:underline"
            >
              <span>{pendingOrderId ? t.deposit.title : t.overview.upgradeCta}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      )}

      {/* 2. Hero Visual Card: Metal Ball on Curved Track + "让每一步，持续向前" */}
      <section className="r10-enter relative overflow-hidden rounded-[20px] border border-[#29363D] bg-[#10171B] shadow-lg">
        <div className="relative aspect-[16/7] sm:aspect-[16/6] w-full overflow-hidden bg-gradient-to-b from-[#172126] to-[#070B0D]">
          {/* Speedway Backdrop Artwork */}
          <img
            src="/posters/upcoming-sprint.jpg"
            alt="Track"
            className="h-full w-full object-cover opacity-60 mix-blend-luminosity brightness-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#10171B] via-[#10171B]/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#070B0D]/80 via-transparent to-transparent" />

          {/* Cyan Glow Accent */}
          <div className="absolute top-2 right-4 sm:right-8 h-24 w-24 sm:h-32 sm:w-32 rounded-full bg-[#00D9DF]/10 blur-xl pointer-events-none" />

          {/* Slogan & Midnight Timer */}
          <div className="absolute inset-x-4 bottom-3 sm:bottom-4 z-10 flex items-end justify-between gap-2">
            <div>
              <h2 className="r10-title-racing text-lg sm:text-2xl font-black italic tracking-wider text-[#F4F6F7]">
                {locale === "zh-CN" ? "让每一步，持续向前" : "Keep moving forward, step by step"}
              </h2>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#B0BBC2]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00D9DF] shadow-[0_0_6px_#00D9DF]" />
                <span>ROLL10 · 钢球竞速主题会员平台</span>
              </div>
            </div>

            {/* Midnight countdown dial chip */}
            <button
              type="button"
              onClick={() => setEodDrawerOpen(true)}
              className="rounded-xl border border-[#29363D] bg-[#070B0D]/85 backdrop-blur-xs px-2.5 py-1.5 text-right transition hover:border-[#00D9DF]/60"
            >
              <div className="text-[10px] text-[#829098]">{t.overview.rolloverCountdownLabel}</div>
              <div className="font-mono-sgt text-xs sm:text-sm font-bold text-[#E9C66B]">
                {clockState?.hhmmss ?? "00:00:00"}
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* 3. Three Asset Badges Row (₮ USDT | RP | CP) */}
      <section className="r10-enter r10-delay-1 r10-card-dark p-3 sm:p-4">
        <Link href="/wallet" className="grid grid-cols-3 divide-x divide-[#29363D] text-center transition hover:opacity-90">
          {/* USDT */}
          <div className="px-1.5">
            <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-[#52C898]">
              <span className="font-bold">₮</span>
              <span>USDT</span>
            </div>
            <div className="mt-1 font-mono-sgt text-sm sm:text-base font-bold text-[#F4F6F7]">
              {formatU(member.usdtBalanceCents ?? member.availablePointsCents)}
            </div>
          </div>

          {/* RP */}
          <div className="px-1.5">
            <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-[#00D9DF]">
              <span className="font-bold">RP</span>
            </div>
            <div className="mt-1 font-mono-sgt text-sm sm:text-base font-bold text-[#F4F6F7]">
              {formatU(member.rpBalanceCents ?? 0)}
            </div>
          </div>

          {/* CP */}
          <div className="px-1.5">
            <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-[#E9C66B]">
              <span className="font-bold">CP</span>
            </div>
            <div className="mt-1 font-mono-sgt text-sm sm:text-base font-bold text-[#E9C66B]">
              {formatU(member.cpBalanceCents ?? member.availablePointsCents)}
            </div>
          </div>
        </Link>
      </section>

      {/* 4. Quick Stats Row (2 columns: 直推人数 + 累计奖励 CP) */}
      <section className="r10-enter r10-delay-1 grid grid-cols-2 gap-2.5">
        <Link
          href="/tree?tab=referral"
          className="r10-card-dark flex items-center gap-3 p-3 transition hover:border-[#00D9DF]/50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00D9DF]/15 text-[#00D9DF] border border-[#00D9DF]/30">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-[#829098]">{t.overview.directReferralsLabel}</div>
            <div className="mt-0.5 text-lg font-bold text-[#F4F6F7] tabular-nums">
              {member.directReferralCount}
              <span className="ml-1 text-xs font-normal text-[#829098]">人</span>
            </div>
          </div>
        </Link>

        <Link
          href="/wallet"
          className="r10-card-dark flex items-center gap-3 p-3 transition hover:border-[#E9C66B]/50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E9C66B]/15 text-[#E9C66B] border border-[#E9C66B]/30">
            <Gift className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-[#829098]">{t.overview.referralRewardsEarnedLabel}</div>
            <div className="mt-0.5 text-lg font-bold text-[#E9C66B] tabular-nums">
              {formatU((member.directCommissionCpCents ?? 0) + (member.differentialCpCents ?? 0))}
              <span className="ml-1 text-xs font-normal text-[#E9C66B]/80">CP</span>
            </div>
          </div>
        </Link>
      </section>

      {/* 5. 4 Action Grid Buttons (2x2 / 4 in row) */}
      <section className="r10-enter r10-delay-2 grid grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => void handleCopyInvite()}
          className="r10-card-dark flex flex-col items-center justify-center gap-1.5 p-2.5 text-center transition hover:border-[#00D9DF]/50 active:scale-[0.98]"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#172126] text-[#00D9DF] border border-[#29363D]">
            {copiedInvite ? <Check className="h-4 w-4 text-emerald-400" /> : <UserPlus className="h-4 w-4" />}
          </div>
          <span className="text-[11px] font-medium text-[#F4F6F7]">
            {copiedInvite ? "已复制" : "邀请好友"}
          </span>
        </button>

        <Link
          href="/register"
          className="r10-card-dark flex flex-col items-center justify-center gap-1.5 p-2.5 text-center transition hover:border-[#E9C66B]/50 active:scale-[0.98]"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#172126] text-[#E9C66B] border border-[#29363D]">
            <Layers className="h-4 w-4" />
          </div>
          <span className="text-[11px] font-medium text-[#F4F6F7]">配套注册</span>
        </Link>

        <Link
          href="/wallet"
          className="r10-card-dark flex flex-col items-center justify-center gap-1.5 p-2.5 text-center transition hover:border-[#00D9DF]/50 active:scale-[0.98]"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#172126] text-[#00D9DF] border border-[#29363D]">
            <ClipboardList className="h-4 w-4" />
          </div>
          <span className="text-[11px] font-medium text-[#F4F6F7]">奖励明细</span>
        </Link>

        <Link
          href="/packages"
          className="r10-card-dark flex flex-col items-center justify-center gap-1.5 p-2.5 text-center transition hover:border-[#E9C66B]/50 active:scale-[0.98]"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#172126] text-[#E9C66B] border border-[#29363D]">
            <BookOpen className="h-4 w-4" />
          </div>
          <span className="text-[11px] font-medium text-[#F4F6F7]">制度说明</span>
        </Link>
      </section>

      {/* 6. Dual-Chamber Team Points & Binary Matching */}
      <section className="r10-enter r10-delay-2 r10-card-dark overflow-hidden">
        {/* Left & Right Points */}
        <div className="grid grid-cols-2 divide-x divide-[#29363D] border-b border-[#29363D]">
          <Link href="/tree?tab=placement&leg=LEFT" className="p-3.5 transition hover:bg-white/[0.02]">
            <div className="flex items-center gap-1.5 text-xs text-[#00D9DF]">
              <Layers className="h-3.5 w-3.5" />
              <span className="font-semibold">{locale === "zh-CN" ? "左区积分" : "Left Points"}</span>
            </div>
            <div className="mt-1.5 text-xl font-bold tabular-nums text-[#F4F6F7]">
              {member.leftBv.toLocaleString()}
            </div>
            <div className="text-[11px] text-[#829098]">
              {member.leftCount} {locale === "zh-CN" ? "人" : "members"}
            </div>
          </Link>

          <Link href="/tree?tab=placement&leg=RIGHT" className="p-3.5 transition hover:bg-white/[0.02]">
            <div className="flex items-center gap-1.5 text-xs text-[#E9C66B]">
              <Layers className="h-3.5 w-3.5" />
              <span className="font-semibold">{locale === "zh-CN" ? "右区积分" : "Right Points"}</span>
            </div>
            <div className="mt-1.5 text-xl font-bold tabular-nums text-[#F4F6F7]">
              {member.rightBv.toLocaleString()}
            </div>
            <div className="text-[11px] text-[#829098]">
              {member.rightCount} {locale === "zh-CN" ? "人" : "members"}
            </div>
          </Link>
        </div>

        {/* Matching status */}
        <div className="p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#B0BBC2]">{t.overview.todayPairing}</span>
            <span className="font-mono-sgt font-bold text-[#E9C66B]">
              {formatU(member.todayPairedCents)} / {formatU(member.dailyCapPointsCents)} CP
            </span>
          </div>

          {/* Racing Gauge */}
          <MatchingGauge
            pairedCents={member.todayPairedCents}
            capCents={member.dailyCapPointsCents}
          />

          <div className="flex items-center justify-between text-[11px] text-[#829098] pt-1">
            <span>① 未使用积分 100% 持续保留</span>
            <button
              type="button"
              onClick={() => setEodDrawerOpen(true)}
              className="text-[#00D9DF] hover:underline"
            >
              {locale === "zh-CN" ? "结转详情" : "Rollover Details"} →
            </button>
          </div>
        </div>
      </section>

      {/* 7. 游戏厅 Entrance Card */}
      <section className="r10-enter r10-delay-3">
        <Link
          href="/arcade"
          className="r10-card-dark group relative flex items-center justify-between overflow-hidden p-3.5 transition-all hover:border-[#00D9DF]/60 active:scale-[0.99]"
        >
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#00D9DF]/40 bg-[#00D9DF]/15 text-[#00D9DF] shadow-[0_0_12px_rgba(0,217,223,0.3)]">
              <Gamepad2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#F4F6F7]">游戏厅</span>
                <span className="rounded-full border border-[#00D9DF]/40 bg-[#00D9DF]/10 px-2 py-0.5 text-[10px] font-semibold text-[#00D9DF]">
                  即将开放
                </span>
              </div>
              <div className="text-[11px] text-[#829098]">钢球竞速实时竞猜 · 赛道直播体验</div>
            </div>
          </div>
          <ChevronRight className="relative z-10 h-4 w-4 text-[#829098] transition-transform group-hover:translate-x-0.5" />
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
