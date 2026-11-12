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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#F2F0EB]">
          {t.packages.title}
        </h1>
        <p className="mt-0.5 text-xs text-[#A7AEBC]">{t.packages.subtitle}</p>
      </div>

      {/* Waiting Effective Banner */}
      {pendingUpgradePackageCode && (
        <div className="rounded-2xl border border-[#CBB487]/45 bg-[#141619] p-4 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#CBB487] px-2.5 py-0.5 text-[10px] font-bold text-[#08090B]">
              {t.packages.waitingEffectiveBadge}
            </span>
            <span className="text-sm font-semibold text-[#F2F0EB]">
              {currentPackageCode} → {pendingUpgradePackageCode}
            </span>
          </div>
          {waitingNaturalSchedule && (
            <div className="mt-2.5 rounded-xl border border-white/[0.06] bg-[#08090B] px-3 py-2 font-medium text-[#CBB487]">
              {waitingNaturalSchedule}
            </div>
          )}
          <div className="mt-2.5 space-y-1 text-[#A7AEBC]">
            <div>
              {locale === "zh-CN" ? "付款确认时间：" : "Paid Confirmed: "}
              <strong className="font-mono-sgt text-[#F2F0EB]">
                {pendingUpgradeConfirmedLabel ?? "—"}
              </strong>
            </div>
            <div>
              {locale === "zh-CN" ? "生效时间 (SGT)：" : "Exact Effective: "}
              <strong className="font-mono-sgt text-[#CBB487]">
                {pendingUpgradeEffectiveLabel}
              </strong>
            </div>
            <div>
              {locale === "zh-CN" ? "生效前每日封顶：" : "Current Active Cap: "}
              <strong className="tabular-nums text-[#F2F0EB]">
                {formatU(dailyCapPointsCents)} {t.common.points}/
                {locale === "zh-CN" ? "天" : "day"} ({currentPackageCode})
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Info Card */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-4 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-semibold text-[#CBB487]">
            <Clock className="h-4 w-4" />
            <span>{t.packages.scheduleTitle}</span>
          </span>
          <span className="font-mono-sgt text-[#A7AEBC]">{sgtTimeNowLabel}</span>
        </div>
        <p className="mt-1.5 text-[#A7AEBC]">{t.packages.scheduleRuleText}</p>
        <div className="mt-2.5 rounded-xl border border-white/[0.06] bg-[#08090B] px-3 py-2 text-[#CBB487]">
          {naturalScheduleIfNow}
        </div>
      </div>

      {!depositServiceAvailable && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-[#141619] p-4 text-xs text-amber-200"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>{t.deposit.serviceUnavailable}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-500/35 bg-[#141619] px-4 py-3 text-xs text-rose-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Vertical Stack of Packages: US$100, US$500, US$1,000 */}
      <div className="space-y-3">
        {tiers.map((tier) => {
          const isCurrent = tier.code === currentPackageCode;
          const isPendingTarget = tier.code === pendingUpgradePackageCode;
          const canOrder =
            isInitialFlow || (!hasWaitingUpgrade && tier.sortOrder > currentSortOrder);

          return (
            <div
              key={tier.code}
              className={`rounded-2xl border p-5 transition ${
                isCurrent
                  ? "border-[#CBB487]/65 bg-[#141619]"
                  : "border-white/[0.08] bg-[#141619]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-sgt text-xs font-bold uppercase tracking-wider text-[#CBB487]">
                      {tier.code}
                    </span>
                    {isCurrent && (
                      <span className="rounded-full bg-[#CBB487] px-2.5 py-0.5 text-[10px] font-bold text-[#08090B]">
                        {t.packages.currentTier}
                      </span>
                    )}
                    {isPendingTarget && (
                      <span className="rounded-full bg-[#CBB487]/20 px-2.5 py-0.5 text-[10px] font-semibold text-[#CBB487]">
                        {t.packages.waitingEffectiveBadge}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 text-base font-semibold text-[#F2F0EB]">
                    {locale === "zh-CN" ? tier.nameZh : tier.nameEn}
                  </h3>
                </div>
                <div className="text-right">
                  <div className="tabular-nums text-2xl font-bold text-[#F2F0EB]">
                    {formatU(tier.priceUsdCents)} U
                  </div>
                  <div className="tabular-nums text-[11px] font-medium text-[#CBB487]">
                    {formatUsdtMicros(tier.priceUsdtMicros)}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 divide-x divide-white/[0.1] overflow-hidden rounded-xl border border-white/[0.07] bg-[#08090B] text-xs">
                <div className="p-3">
                  <div className="text-[#A7AEBC]">{t.packages.bvLabel}</div>
                  <div className="mt-0.5 tabular-nums font-semibold text-[#F2F0EB]">
                    {formatBv(tier.bv)}
                  </div>
                </div>
                <div className="p-3">
                  <div className="text-[#A7AEBC]">{t.packages.dailyCapLabel}</div>
                  <div className="mt-0.5 tabular-nums font-semibold text-[#CBB487]">
                    {formatU(tier.dailyCapPointsCents)} {t.common.points}/
                    {locale === "zh-CN" ? "天" : "day"}
                  </div>
                </div>
              </div>

              {canOrder && depositServiceAvailable && (
                <button
                  type="button"
                  onClick={() => void openConfirmPanel(tier)}
                  className="mt-3.5 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#CBB487] px-4 text-xs font-semibold text-[#08090B] transition-all duration-100 hover:bg-[#D8C49B] active:scale-[0.99]"
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

      {/* Order History */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#F2F0EB]">{t.packages.orderHistory}</h2>
          <span className="tabular-nums text-[11px] text-[#A7AEBC]">
            {locale === "zh-CN"
              ? `左 ${formatBv(leftBv)} / 右 ${formatBv(rightBv)} · 今日已对碰 ${formatU(todayPairedPointsCents)} ${t.common.points}`
              : `L ${formatBv(leftBv)} / R ${formatBv(rightBv)} · Paired ${formatU(todayPairedPointsCents)} ${t.common.points}`}
          </span>
        </div>
        {orders.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#A7AEBC]">{t.common.noData}</p>
        ) : (
          <div className="space-y-2.5">
            {orders.map((o) => (
              <div
                key={o.id}
                className="rounded-xl border border-white/[0.07] bg-[#08090B] p-3.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono-sgt font-semibold text-[#CBB487]">{o.orderNo}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full border border-white/[0.08] bg-[#141619] px-2 py-0.5 text-[10px] font-medium text-[#F2F0EB]">
                      {formatOrderStatus(o.status, locale)}
                    </span>
                    {o.upgradeStatus !== "NOT_APPLICABLE" && (
                      <span className="rounded-full bg-[#CBB487]/20 px-2 py-0.5 text-[10px] font-semibold text-[#CBB487]">
                        {o.upgradeStatus === "WAITING_EFFECTIVE"
                          ? t.packages.waitingEffectiveBadge
                          : formatEffectiveStatus(o.upgradeStatus, locale)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-1.5 flex justify-between text-[#A7AEBC]">
                  <span>
                    {formatOrderType(o.orderType, locale)}:{" "}
                    {o.previousPackageCode ? `${o.previousPackageCode} → ` : ""}
                    <strong className="text-[#F2F0EB]">{o.targetPackageCode}</strong>
                  </span>
                  <span className="tabular-nums text-[#F2F0EB]">
                    {formatU(o.amountUsdCents)} U · {formatBv(o.bvAmount)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap justify-between gap-1 text-[11px] text-[#A7AEBC]">
                  <span>
                    {locale === "zh-CN" ? "确认时间：" : "Confirmed: "}
                    <span className="font-mono-sgt">
                      {o.confirmedAtLabel ?? (locale === "zh-CN" ? "待确认" : "Pending")}
                    </span>
                  </span>
                  <span className="font-mono-sgt text-[#CBB487]">
                    {locale === "zh-CN" ? "生效时间：" : "Effective: "}
                    {o.effectiveAtLabel ?? "—"}
                  </span>
                </div>
                {o.failureReason && (
                  <div className="mt-1 text-[11px] text-rose-300">{o.failureReason}</div>
                )}
                <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-2">
                  <span className="text-[11px] text-[#A7AEBC]">
                    {o.expectedUsdtMicros
                      ? `${formatUsdtMicros(o.expectedUsdtMicros)} · ${formatDepositVerifyStatus(o.depositVerifyStatus, locale)}`
                      : formatOrderStatus(o.paymentStatus, locale)}
                  </span>
                  <Link
                    href={`/orders/${o.id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#CBB487] hover:underline"
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
            <div className="flex items-center gap-1.5 text-[#CBB487] font-semibold">
              <Sparkles className="h-4 w-4" />
              <span>
                {currentPackageCode ?? t.overview.pendingActivation} → {selectedTarget.code}
              </span>
            </div>

            {previewLoading ? (
              <div className="py-6 text-center text-[#A7AEBC]">{t.common.loading}</div>
            ) : previewError ? (
              <div className="rounded-xl border border-rose-500/35 bg-[#08090B] p-4 text-center">
                <div className="text-rose-300">{previewError}</div>
                <button
                  type="button"
                  onClick={() => void loadPreview(selectedTarget)}
                  className="mt-3 min-h-[38px] rounded-xl border border-[#CBB487]/50 px-4 text-xs font-semibold text-[#CBB487]"
                >
                  {t.common.retry}
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="rounded-xl border border-white/[0.08] bg-[#08090B] p-3.5 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#A7AEBC]">{t.packages.currentTier}</span>
                    <span className="font-semibold text-[#F2F0EB]">
                      {currentPackageCode ?? t.overview.pendingActivation}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A7AEBC]">
                      {locale === "zh-CN" ? "目标升级配套" : "Target Tier"}
                    </span>
                    <span className="font-semibold text-[#CBB487]">{selectedTarget.code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A7AEBC]">{t.deposit.networkLabel}</span>
                    <span className="font-semibold text-[#F2F0EB]">
                      {formatNetworkLabel(usdtNetwork)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-white/[0.08] pt-2">
                    <span className="text-[#A7AEBC]">{t.packages.actualPayable}</span>
                    <div className="text-right">
                      <span className="tabular-nums text-base font-bold text-[#CBB487]">
                        {formatUsdtMicros(
                          isInitialFlow
                            ? selectedTarget.priceUsdtMicros
                            : selectedTarget.upgradePayUsdtMicros
                        )}
                      </span>
                      <div className="tabular-nums text-[11px] text-[#A7AEBC]">
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
                      <span className="text-[#A7AEBC]">{t.packages.activeRuleLabel}</span>
                      <span className="font-mono-sgt text-[#F2F0EB]">
                        {locale === "zh-CN" ? "付款后 D+2 日 00:01:00 SGT" : "D+2 at 00:01:00 SGT"}
                      </span>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-[#08090B] p-3 text-[#CBB487]">
                      {serverPreview?.naturalSchedule ?? naturalScheduleIfNow}
                    </div>
                    <div className="rounded-xl border border-white/[0.08] bg-[#08090B] p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[#A7AEBC]">{t.packages.catchupPreview}</span>
                        <span className="rounded border border-white/[0.1] px-1.5 py-0.5 text-[10px] font-semibold text-[#CBB487]">
                          {t.common.estimatedBadge}
                        </span>
                      </div>
                      <div className="mt-1.5 tabular-nums font-semibold text-[#F2F0EB]">
                        {serverPreview
                          ? locale === "zh-CN"
                            ? `${serverPreview.estimatedCatchupPairs} 组 (+${formatU(serverPreview.estimatedCatchupPointsCents)} ${t.common.points})`
                            : `${serverPreview.estimatedCatchupPairs} pairs (+${formatU(serverPreview.estimatedCatchupPointsCents)} ${t.common.points})`
                          : locale === "zh-CN"
                            ? `${selectedTarget.estimatedCatchupPairs} 组 (+${formatU(selectedTarget.estimatedCatchupPointsCents)} ${t.common.points})`
                            : `${selectedTarget.estimatedCatchupPairs} pairs (+${formatU(selectedTarget.estimatedCatchupPointsCents)} ${t.common.points})`}
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-[#A7AEBC]">
                        {t.packages.previewDisclaimer}
                      </p>
                    </div>
                  </>
                )}

                {!depositServiceAvailable && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-[#141619] p-4 text-xs text-amber-200"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>{t.deposit.serviceUnavailable}</span>
        </div>
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
                    className="min-h-[44px] rounded-xl border border-white/[0.1] bg-[#08090B] font-medium text-[#F2F0EB]"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void submitOrder()}
                    className="min-h-[44px] rounded-xl bg-[#CBB487] font-semibold text-[#08090B] transition-transform duration-100 active:scale-[0.98] disabled:opacity-50"
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
