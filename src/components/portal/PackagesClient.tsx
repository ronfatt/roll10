"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, ArrowRight, Clock, Sparkles } from "lucide-react";
import type { Dictionary, Locale } from "@/lib/i18n";
import {
  formatDepositVerifyStatus,
  formatEffectiveStatus,
  formatOrderStatus,
  formatOrderType,
} from "@/lib/i18n-labels";
import { formatBv, formatU, formatUsdtMicros } from "@/lib/money";
import { formatNetworkLabel } from "@/lib/usdt/address";
import { BottomDrawer } from "@/components/MotionPrimitives";
import { SubpageHeaderTitle } from "@/components/Roll10Logo";

interface TierItem {
  code: string;
  nameEn: string;
  nameZh: string;
  priceUsdCents: number;
  priceUsdtMicros: string;
  bv: number;
  dailyCapPointsCents: number;
  sortOrder: number;
  upgradePayUsdCents: number;
  upgradePayUsdtMicros: string;
  estimatedCatchupPairs: number;
  estimatedCatchupPointsCents: number;
}

interface OrderItem {
  id: string;
  orderNo: string;
  orderType: string;
  targetPackageCode: string;
  previousPackageCode: string | null;
  amountUsdCents: number;
  expectedUsdtMicros?: string | null;
  depositVerifyStatus?: string;
  bvAmount: number;
  paymentStatus: string;
  status: string;
  upgradeStatus: string;
  failureReason: string | null;
  confirmedAtLabel: string | null;
  effectiveAtLabel: string | null;
  createdAtLabel: string;
}

interface ServerPreview {
  currentPackageCode: string | null;
  targetPackageCode: string;
  payableUsdCents: number;
  upgradePriceMode: string;
  upgradeGrantsBv: boolean;
  confirmedAtPreviewLabel: string;
  effectiveAtLabel: string;
  naturalSchedule: string;
  estimatedCatchupPairs: number;
  estimatedCatchupPointsCents: number;
}

export function PackagesClient({
  t,
  locale,
  memberStatus,
  currentPackageCode,
  currentSortOrder,
  pendingUpgradePackageCode,
  pendingUpgradeEffectiveLabel,
  pendingUpgradeConfirmedLabel,
  waitingNaturalSchedule,
  naturalScheduleIfNow,
  leftBv,
  rightBv,
  todayPairedPointsCents,
  dailyCapPointsCents,
  sgtTimeNowLabel,
  effectiveLabelIfConfirmedNow,
  depositServiceAvailable,
  usdtNetwork,
  tiers,
  orders,
}: {
  t: Dictionary;
  locale: Locale;
  memberStatus: string;
  currentPackageCode: string | null;
  currentSortOrder: number;
  pendingUpgradePackageCode: string | null;
  pendingUpgradeEffectiveLabel: string | null;
  pendingUpgradeConfirmedLabel: string | null;
  waitingNaturalSchedule: string | null;
  naturalScheduleIfNow: string;
  leftBv: number;
  rightBv: number;
  todayPairedPointsCents: number;
  dailyCapPointsCents: number;
  sgtTimeNowLabel: string;
  effectiveLabelIfConfirmedNow: string;
  upgradePriceMode: string;
  upgradeGrantsBv: boolean;
  depositServiceAvailable: boolean;
  usdtNetwork: string;
  tiers: TierItem[];
  orders: OrderItem[];
}) {
  const router = useRouter();
  const [selectedTarget, setSelectedTarget] = useState<TierItem | null>(null);
  const [serverPreview, setServerPreview] = useState<ServerPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const isInitialFlow = memberStatus !== "ACTIVE" || !currentPackageCode;
  const hasWaitingUpgrade = Boolean(pendingUpgradePackageCode);

  const loadPreview = async (tier: TierItem) => {
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const res = await fetch(
        `/api/orders/preview?target=${encodeURIComponent(tier.code)}&locale=${locale}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (res.ok && data.ok) {
        setServerPreview(data.preview);
      } else {
        setPreviewError(data.error || t.common.loadError);
      }
    } catch {
      setPreviewError(t.common.loadError);
    } finally {
      setPreviewLoading(false);
    }
  };

  const openConfirmPanel = async (tier: TierItem) => {
    setError(null);
    setPreviewError(null);
    setSelectedTarget(tier);
    setServerPreview(null);
    if (!isInitialFlow) {
      await loadPreview(tier);
    }
  };

  const submitOrder = async () => {
    if (!selectedTarget || inFlightRef.current) return;
    inFlightRef.current = true;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: isInitialFlow ? "INITIAL" : "UPGRADE",
          targetPackageCode: selectedTarget.code,
          paymentMethod: "USDT",
          payImmediatelyDemo: false,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || (locale === "zh-CN" ? "订单提交失败" : "Order submission failed"));
        setSubmitting(false);
        inFlightRef.current = false;
        return;
      }

      const ord = data.order;
      setSelectedTarget(null);
      setSubmitting(false);
      inFlightRef.current = false;
      router.push(`/orders/${ord.id}`);
      router.refresh();
    } catch {
      setError(
        locale === "zh-CN"
          ? "提交订单时网络异常，请重试。"
          : "Network error submitting order. Please retry."
      );
      setSubmitting(false);
      inFlightRef.current = false;
    }
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Subpage Header */}
      <SubpageHeaderTitle
        title={t.packages.title}
        subtitle={t.packages.subtitle}
      />

      {/* Waiting Effective Banner */}
      {pendingUpgradePackageCode && (
        <div className="rounded-2xl border border-[#51E7FA]/40 bg-[#101B27] p-4 text-xs shadow-md">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#51E7FA] px-2.5 py-0.5 text-[10px] font-bold text-[#0A101A]">
              {t.packages.waitingEffectiveBadge}
            </span>
            <span className="text-sm font-bold text-[#F4F8FC]">
              {currentPackageCode} → {pendingUpgradePackageCode}
            </span>
          </div>
          {waitingNaturalSchedule && (
            <div className="mt-2.5 rounded-xl border border-[#2B3D4D] bg-[#0A101A] px-3 py-2 font-medium text-[#51E7FA]">
              {waitingNaturalSchedule}
            </div>
          )}
          <div className="mt-2.5 space-y-1 text-[#AAB8C7]">
            <div>
              {locale === "zh-CN" ? "付款确认时间：" : "Paid Confirmed: "}
              <strong className="font-mono-sgt text-[#F4F8FC]">
                {pendingUpgradeConfirmedLabel ?? "—"}
              </strong>
            </div>
            <div>
              {locale === "zh-CN" ? "生效时间 (SGT)：" : "Exact Effective: "}
              <strong className="font-mono-sgt text-[#51E7FA]">
                {pendingUpgradeEffectiveLabel}
              </strong>
            </div>
            <div>
              {locale === "zh-CN" ? "生效前每日封顶：" : "Current Active Cap: "}
              <strong className="tabular-nums text-[#F4F8FC]">
                {formatU(dailyCapPointsCents)} {t.common.points}/
                {locale === "zh-CN" ? "天" : "day"} ({currentPackageCode})
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Info Card */}
      <div className="rounded-2xl border border-[#2B3D4D] bg-[#101B27] p-4 text-xs shadow-md">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-bold text-[#51E7FA]">
            <Clock className="h-4 w-4" />
            <span>{t.packages.scheduleTitle}</span>
          </span>
          <span className="font-mono-sgt text-[#AAB8C7]">{sgtTimeNowLabel}</span>
        </div>
        <p className="mt-1.5 text-[#AAB8C7]">{t.packages.scheduleRuleText}</p>
        <div className="mt-2.5 rounded-xl border border-[#2B3D4D] bg-[#0A101A] px-3 py-2 font-medium text-[#51E7FA]">
          {naturalScheduleIfNow}
        </div>
      </div>

      {!depositServiceAvailable && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-[#101B27] p-4 text-xs text-amber-200"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>{t.deposit.serviceUnavailable}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-500/35 bg-[#101B27] px-4 py-3 text-xs text-rose-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1 U = 1 BV Central Guide Rail Anchor (matching Design Slide 02) */}
      <div className="relative my-4 flex items-center justify-center">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#51E7FA]/50 to-[#51E7FA]" />
        <div className="mx-3 flex items-center gap-2 rounded-full border border-[#51E7FA]/50 bg-[#0A101A] px-4 py-1.5 shadow-[0_0_16px_rgba(81,231,250,0.3)]">
          <span className="font-black italic tracking-widest text-[#F2CD7E] text-sm sm:text-base drop-shadow-[0_1px_6px_rgba(242,205,126,0.4)]">
            1 U = 1 BV
          </span>
        </div>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#51E7FA]/50 to-[#51E7FA]" />
      </div>

      {/* Package Cards: P100, P500, P1000 (Luxury Gold-Rim & Ribbon Style) */}
      <div className="space-y-3.5">
        {tiers.map((tier) => {
          const isCurrent = tier.code === currentPackageCode;
          const isPendingTarget = tier.code === pendingUpgradePackageCode;
          const canOrder =
            isInitialFlow || (!hasWaitingUpgrade && tier.sortOrder > currentSortOrder);

          return (
            <div
              key={tier.code}
              className={`r10-card-gold-rim relative overflow-hidden rounded-2xl p-4 sm:p-5 transition-all duration-300 ${
                isCurrent
                  ? "!border-[#51E7FA] shadow-[0_0_20px_rgba(81,231,250,0.3)]"
                  : "hover:border-[#F2CD7E]/60"
              }`}
            >
              {/* Top Header: Tier Code + Status Pill */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl sm:text-2xl font-black italic tracking-wider text-[#F4F8FC] drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                    {tier.code}
                  </span>
                  <span className="text-xs text-[#AAB8C7] font-medium">
                    {locale === "zh-CN" ? tier.nameZh : tier.nameEn}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {isCurrent && (
                    <span className="rounded-full bg-[#51E7FA] px-2.5 py-0.5 text-[10px] font-bold text-[#0A101A] shadow-[0_0_8px_rgba(81,231,250,0.6)]">
                      {t.packages.currentTier}
                    </span>
                  )}
                  {isPendingTarget && (
                    <span className="rounded-full border border-[#F2CD7E]/40 bg-[#F2CD7E]/15 px-2.5 py-0.5 text-[10px] font-semibold text-[#F2CD7E]">
                      {t.packages.waitingEffectiveBadge}
                    </span>
                  )}
                </div>
              </div>

              {/* Slanted Champagne Gold Metallic Price Ribbon */}
              <div className="my-3 r10-badge-gold-ribbon py-2 px-4 text-center">
                <div className="text-xl sm:text-2xl font-black italic tracking-wider text-[#F2CD7E] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                  {formatU(tier.priceUsdCents)} U
                </div>
              </div>

              {/* Two-Column Clean Specs Grid (matching Design Slide 02) */}
              <div className="space-y-2 border-t border-[#2B3D4D]/60 pt-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#AAB8C7] font-medium">{t.packages.bvLabel}</span>
                  <span className="font-black italic tracking-wide text-[#F2CD7E] text-sm tabular-nums">
                    {formatBv(tier.bv)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#AAB8C7] font-medium">{t.packages.dailyCapLabel}</span>
                  <span className="font-black italic tracking-wide text-[#F2CD7E] text-sm tabular-nums">
                    {formatU(tier.dailyCapPointsCents)} U/{locale === "zh-CN" ? "天" : "day"}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              {canOrder && depositServiceAvailable && (
                <button
                  type="button"
                  onClick={() => void openConfirmPanel(tier)}
                  className="mt-3.5 flex min-h-[44px] w-full items-center justify-center rounded-xl r10-btn-cyan px-4 text-xs font-bold uppercase tracking-wider transition-all hover:brightness-110 active:scale-[0.99]"
                >
                  {isInitialFlow
                    ? `${t.packages.activateBtn} (${formatUsdtMicros(tier.priceUsdtMicros)})`
                    : `${t.packages.upgradeBtn} (${formatUsdtMicros(tier.upgradePayUsdtMicros)})`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Slide 02 Footnotes & Slide Number */}
      <div className="rounded-2xl border border-[#2B3D4D] bg-[#101B27] p-4 text-xs space-y-2">
        <div className="flex items-center gap-2 text-[#CAD7E6]">
          <span className="font-bold text-[#51E7FA]">/</span>
          <span>
            {locale === "zh-CN"
              ? "U (USDT) 用于配套付款与发放奖金。"
              : "U (USDT) is used for package payment and bonus payouts."}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[#CAD7E6]">
          <span className="font-bold text-[#51E7FA]">/</span>
          <span>
            {locale === "zh-CN"
              ? "BV (Bonus Value) 用于计算团队业绩及对碰。"
              : "BV (Bonus Value) is used for team volume and binary pairing."}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-end border-t border-[#2B3D4D]/60 pt-2 text-[11px] font-mono-sgt text-[#F2CD7E]/80">
          <span>── 02 / 05 ──</span>
        </div>
      </div>

      {/* Order History */}
      <div className="rounded-2xl border border-[#2B3D4D] bg-[#101B27] p-4 shadow-md">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="h-3.5 w-[2.5px] rounded-full bg-[#51E7FA] shadow-[0_0_8px_rgba(81,231,250,0.8)]"
              aria-hidden="true"
            />
            <h2 className="text-sm font-semibold text-[#F4F8FC]">{t.packages.orderHistory}</h2>
          </div>
          <span className="tabular-nums text-[11px] text-[#AAB8C7]">
            {locale === "zh-CN"
              ? `左 ${formatBv(leftBv)} / 右 ${formatBv(rightBv)} · 今日已对碰 ${formatU(todayPairedPointsCents)} ${t.common.points}`
              : `L ${formatBv(leftBv)} / R ${formatBv(rightBv)} · Paired ${formatU(todayPairedPointsCents)} ${t.common.points}`}
          </span>
        </div>
        {orders.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#AAB8C7]">{t.common.noData}</p>
        ) : (
          <div className="space-y-2.5">
            {orders.map((o) => (
              <div
                key={o.id}
                className="rounded-xl border border-[#2B3D4D] bg-[#0A101A] p-3.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono-sgt font-semibold text-[#51E7FA]">{o.orderNo}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full border border-[#2B3D4D] bg-[#101B27] px-2 py-0.5 text-[10px] font-medium text-[#F4F8FC]">
                      {formatOrderStatus(o.status, locale)}
                    </span>
                    {o.upgradeStatus !== "NOT_APPLICABLE" && (
                      <span className="rounded-full bg-[#51E7FA]/20 px-2 py-0.5 text-[10px] font-semibold text-[#51E7FA]">
                        {o.upgradeStatus === "WAITING_EFFECTIVE"
                          ? t.packages.waitingEffectiveBadge
                          : formatEffectiveStatus(o.upgradeStatus, locale)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-1.5 flex justify-between text-[#AAB8C7]">
                  <span>
                    {formatOrderType(o.orderType, locale)}:{" "}
                    {o.previousPackageCode ? `${o.previousPackageCode} → ` : ""}
                    <strong className="text-[#F4F8FC]">{o.targetPackageCode}</strong>
                  </span>
                  <span className="tabular-nums text-[#F4F8FC]">
                    {formatU(o.amountUsdCents)} U · {formatBv(o.bvAmount)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap justify-between gap-1 text-[11px] text-[#AAB8C7]">
                  <span>
                    {locale === "zh-CN" ? "确认时间：" : "Confirmed: "}
                    <span className="font-mono-sgt">
                      {o.confirmedAtLabel ?? (locale === "zh-CN" ? "待确认" : "Pending")}
                    </span>
                  </span>
                  <span className="font-mono-sgt text-[#51E7FA]">
                    {locale === "zh-CN" ? "生效时间：" : "Effective: "}
                    {o.effectiveAtLabel ?? "—"}
                  </span>
                </div>
                {o.failureReason && (
                  <div className="mt-1 text-[11px] text-rose-300">{o.failureReason}</div>
                )}
                <div className="mt-2 flex items-center justify-between border-t border-[#2B3D4D] pt-2">
                  <span className="text-[11px] text-[#AAB8C7]">
                    {o.expectedUsdtMicros
                      ? `${formatUsdtMicros(o.expectedUsdtMicros)} · ${formatDepositVerifyStatus(o.depositVerifyStatus, locale)}`
                      : formatOrderStatus(o.paymentStatus, locale)}
                  </span>
                  <Link
                    href={`/orders/${o.id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#51E7FA] hover:underline"
                  >
                    <span>
                      {o.status === "CONFIRMED"
                        ? locale === "zh-CN"
                          ? "付款详情"
                          : "Order Detail"
                        : t.deposit.title}
                    </span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upgrade / Purchase Confirmation BottomDrawer */}
      <BottomDrawer
        open={Boolean(selectedTarget)}
        onClose={() => setSelectedTarget(null)}
        title={t.packages.confirmPanelTitle}
      >
        {selectedTarget && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-1.5 text-[#51E7FA] font-semibold">
              <Sparkles className="h-4 w-4" />
              <span>
                {currentPackageCode ?? t.overview.pendingActivation} → {selectedTarget.code}
              </span>
            </div>

            {previewLoading ? (
              <div className="py-6 text-center text-[#AAB8C7]">{t.common.loading}</div>
            ) : previewError ? (
              <div className="rounded-xl border border-rose-500/35 bg-[#0A101A] p-4 text-center">
                <div className="text-rose-300">{previewError}</div>
                <button
                  type="button"
                  onClick={() => void loadPreview(selectedTarget)}
                  className="mt-3 min-h-[38px] rounded-xl border border-[#51E7FA]/50 px-4 text-xs font-semibold text-[#51E7FA]"
                >
                  {t.common.retry}
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="rounded-xl border border-[#2B3D4D] bg-[#0A101A] p-3.5 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#AAB8C7]">{t.packages.currentTier}</span>
                    <span className="font-semibold text-[#F4F8FC]">
                      {currentPackageCode ?? t.overview.pendingActivation}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#AAB8C7]">
                      {locale === "zh-CN" ? "目标升级配套" : "Target Tier"}
                    </span>
                    <span className="font-semibold text-[#51E7FA]">{selectedTarget.code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#AAB8C7]">{t.deposit.networkLabel}</span>
                    <span className="font-semibold text-[#F4F8FC]">
                      {formatNetworkLabel(usdtNetwork)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-[#2B3D4D] pt-2">
                    <span className="text-[#AAB8C7]">{t.packages.actualPayable}</span>
                    <div className="text-right">
                      <span className="tabular-nums text-base font-bold text-[#51E7FA]">
                        {formatUsdtMicros(
                          isInitialFlow
                            ? selectedTarget.priceUsdtMicros
                            : selectedTarget.upgradePayUsdtMicros
                        )}
                      </span>
                      <div className="tabular-nums text-[11px] text-[#AAB8C7]">
                        {formatU(
                          serverPreview
                            ? serverPreview.payableUsdCents
                            : isInitialFlow
                              ? selectedTarget.priceUsdCents
                              : selectedTarget.upgradePayUsdCents
                        )}{" "}
                        U (1 U = 1 BV)
                      </div>
                    </div>
                  </div>
                </div>

                {!isInitialFlow && (
                  <>
                    <div className="flex justify-between px-1">
                      <span className="text-[#AAB8C7]">{t.packages.activeRuleLabel}</span>
                      <span className="font-mono-sgt text-[#F4F8FC]">
                        {locale === "zh-CN" ? "付款后 D+2 日 00:01:00 SGT" : "D+2 at 00:01:00 SGT"}
                      </span>
                    </div>
                    <div className="rounded-xl border border-[#2B3D4D] bg-[#0A101A] p-3 text-[#51E7FA]">
                      {serverPreview?.naturalSchedule ?? naturalScheduleIfNow}
                    </div>
                    <div className="rounded-xl border border-[#2B3D4D] bg-[#0A101A] p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[#AAB8C7]">{t.packages.catchupPreview}</span>
                        <span className="rounded border border-[#51E7FA]/30 px-1.5 py-0.5 text-[10px] font-semibold text-[#51E7FA]">
                          {t.common.estimatedBadge}
                        </span>
                      </div>
                      <div className="mt-1.5 tabular-nums font-semibold text-[#F4F8FC]">
                        {serverPreview
                          ? locale === "zh-CN"
                            ? `${serverPreview.estimatedCatchupPairs} 组 (+${formatU(serverPreview.estimatedCatchupPointsCents)} ${t.common.points})`
                            : `${serverPreview.estimatedCatchupPairs} pairs (+${formatU(serverPreview.estimatedCatchupPointsCents)} ${t.common.points})`
                          : locale === "zh-CN"
                            ? `${selectedTarget.estimatedCatchupPairs} 组 (+${formatU(selectedTarget.estimatedCatchupPointsCents)} ${t.common.points})`
                            : `${selectedTarget.estimatedCatchupPairs} pairs (+${formatU(selectedTarget.estimatedCatchupPointsCents)} ${t.common.points})`}
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-[#AAB8C7]">
                        {t.packages.previewDisclaimer}
                      </p>
                    </div>
                  </>
                )}

                {error && (
                  <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 p-3 text-rose-300">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTarget(null)}
                    className="min-h-[44px] rounded-xl border border-[#2B3D4D] bg-[#0A101A] font-medium text-[#F4F8FC]"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void submitOrder()}
                    className="min-h-[44px] rounded-xl bg-[#51E7FA] font-bold text-[#0A101A] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 shadow-[0_0_12px_rgba(81,231,250,0.3)]"
                  >
                    {submitting ? t.common.loading : t.packages.submitUpgradeBtn}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </BottomDrawer>
    </div>
  );
}
