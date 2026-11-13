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
import { getPackageTierName } from "@/lib/packages";
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
        <div className="r10-card-dark border-[#00D9DF]/40 p-4 text-xs shadow-md">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#00D9DF] px-2.5 py-0.5 text-[10px] font-bold text-[#070B0D]">
              {t.packages.waitingEffectiveBadge}
            </span>
            <span className="text-sm font-bold text-[#F4F6F7]">
              {getPackageTierName(currentPackageCode)} → {getPackageTierName(pendingUpgradePackageCode)}
            </span>
          </div>
          {waitingNaturalSchedule && (
            <div className="mt-2.5 rounded-xl border border-[#29363D] bg-[#070B0D] px-3 py-2 font-medium text-[#00D9DF]">
              {waitingNaturalSchedule}
            </div>
          )}
          <div className="mt-2.5 space-y-1 text-[#B0BBC2]">
            <div>
              {locale === "zh-CN" ? "付款确认时间：" : "Paid Confirmed: "}
              <strong className="font-mono-sgt text-[#F4F6F7]">
                {pendingUpgradeConfirmedLabel ?? "—"}
              </strong>
            </div>
            <div>
              {locale === "zh-CN" ? "生效时间 (SGT)：" : "Exact Effective: "}
              <strong className="font-mono-sgt text-[#00D9DF]">
                {pendingUpgradeEffectiveLabel}
              </strong>
            </div>
            <div>
              {locale === "zh-CN" ? "生效前每日封顶：" : "Current Active Cap: "}
              <strong className="tabular-nums text-[#F4F6F7]">
                {formatU(dailyCapPointsCents)} {t.common.points}/
                {locale === "zh-CN" ? "天" : "day"} ({currentPackageCode})
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Info Card */}
      <div className="r10-card-dark p-4 text-xs shadow-md space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-bold text-[#00D9DF]">
            <Clock className="h-4 w-4" />
            <span>{t.packages.scheduleTitle}</span>
          </span>
          <span className="font-mono-sgt text-[#829098]">{sgtTimeNowLabel}</span>
        </div>
        <p className="text-[#B0BBC2]">{t.packages.scheduleRuleText}</p>
        <div className="rounded-xl border border-[#29363D] bg-[#070B0D] px-3 py-2 font-medium text-[#00D9DF]">
          {naturalScheduleIfNow}
        </div>
      </div>

      {!depositServiceAvailable && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-[#10171B] p-4 text-xs text-amber-200"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>{t.deposit.serviceUnavailable}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-500/35 bg-[#10171B] px-4 py-3 text-xs text-rose-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Central Guide Rail Anchor */}
      <div className="relative my-4 flex items-center justify-center">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#00D9DF]/40 to-[#00D9DF]" />
        <div className="mx-3 flex items-center gap-2 rounded-full border border-[#E9C66B]/50 bg-[#070B0D] px-4 py-1.5 shadow-[0_0_16px_rgba(233,198,107,0.25)]">
          <span className="font-bold tracking-wide text-[#E9C66B] text-xs sm:text-sm">
            {locale === "zh-CN" ? "固定 50% RP ＋ 0~50% CP ＋ USDT" : "50% RP + 0~50% CP + USDT"}
          </span>
        </div>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#00D9DF]/40 to-[#00D9DF]" />
      </div>

      {/* Package Cards: P100, P500, P1000 */}
      <div className="space-y-3.5">
        {tiers.map((tier) => {
          const isCurrent = tier.code === currentPackageCode;
          const isPendingTarget = tier.code === pendingUpgradePackageCode;
          const canOrder =
            isInitialFlow || (!hasWaitingUpgrade && tier.sortOrder > currentSortOrder);

          return (
            <div
              key={tier.code}
              className={`r10-card-dark relative overflow-hidden p-4 sm:p-5 transition-all duration-200 ${
                isCurrent
                  ? "!border-[#E9C66B] shadow-[0_0_20px_rgba(233,198,107,0.25)]"
                  : "hover:border-[#00D9DF]/60"
              }`}
            >
              {/* Top Header: Tier Code + Status Pill */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl sm:text-2xl font-black italic tracking-wider text-[#F4F6F7]">
                    {getPackageTierName(tier.code)}
                  </span>
                  <span className="text-xs text-[#B0BBC2] font-medium">
                    {locale === "zh-CN"
                      ? tier.code === "P100"
                        ? "白银配套"
                        : tier.code === "P500"
                          ? "黄金配套"
                          : "钻石配套"
                      : `${getPackageTierName(tier.code)} Tier`}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {isCurrent && (
                    <span className="rounded-full bg-[#E9C66B] px-2.5 py-0.5 text-[10px] font-bold text-[#070B0D]">
                      {t.packages.currentTier}
                    </span>
                  )}
                  {isPendingTarget && (
                    <span className="rounded-full border border-[#00D9DF]/40 bg-[#00D9DF]/15 px-2.5 py-0.5 text-[10px] font-semibold text-[#00D9DF]">
                      {t.packages.waitingEffectiveBadge}
                    </span>
                  )}
                </div>
              </div>

              {/* Price Banner */}
              <div className="my-3 rounded-xl border border-[#E9C66B]/30 bg-gradient-to-r from-[#E9C66B]/15 via-[#E9C66B]/5 to-transparent py-2.5 px-4">
                <div className="font-mono-sgt text-2xl font-black text-[#E9C66B]">
                  {formatU(tier.priceUsdCents)} <span className="text-sm font-bold text-[#E9C66B]/80">U</span>
                </div>
              </div>

              {/* Clean Specs Grid */}
              <div className="space-y-2 border-t border-[#29363D] pt-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#B0BBC2] font-medium">
                    {locale === "zh-CN" ? "团队积分" : "Team Points"}
                  </span>
                  <span className="font-mono-sgt font-bold text-[#F4F6F7] text-sm tabular-nums">
                    {tier.bv.toLocaleString("en-US")} {locale === "zh-CN" ? "积分" : "pts"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#B0BBC2] font-medium">
                    {locale === "zh-CN" ? "推荐人直推比例" : "Sponsor Direct Rate"}
                  </span>
                  <span className="font-mono-sgt font-bold text-[#00D9DF] text-sm tabular-nums">
                    {tier.code === "P100" ? "25%" : tier.code === "P500" ? "30%" : "35%"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#B0BBC2] font-medium">
                    {locale === "zh-CN" ? "每日对碰封顶" : "Daily Matching Cap"}
                  </span>
                  <span className="font-mono-sgt font-bold text-[#E9C66B] text-sm tabular-nums">
                    {formatU(tier.dailyCapPointsCents)} CP/{locale === "zh-CN" ? "天" : "d"}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              {canOrder && depositServiceAvailable && (
                <button
                  type="button"
                  onClick={() => void openConfirmPanel(tier)}
                  className="mt-3.5 flex min-h-[44px] w-full items-center justify-center rounded-xl r10-btn-gold px-4 text-xs font-bold uppercase tracking-wider text-[#070B0D]"
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
      <div className="r10-card-dark p-4 text-xs space-y-2">
        <div className="flex items-center gap-2 text-[#B0BBC2]">
          <span className="font-bold text-[#00D9DF]">/</span>
          <span>
            {locale === "zh-CN"
              ? "U (USDT) 1 U = 1 USDT，用于配套付款与直推/极差/对碰奖金。"
              : "U (USDT) 1 U = 1 USDT, used for package purchase and rewards."}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[#B0BBC2]">
          <span className="font-bold text-[#00D9DF]">/</span>
          <span>
            {locale === "zh-CN"
              ? "RP (Register Point) 注册点数由公司出售，注册时固定支付 50% 配套金额。"
              : "RP (Register Point) sold by company; pays fixed 50% of registration."}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[#B0BBC2]">
          <span className="font-bold text-[#00D9DF]">/</span>
          <span>
            {locale === "zh-CN"
              ? "CP (Cash Point) 直推/极差/对碰奖励入账单位，注册时最高可自选抵扣 50% 配套金额。"
              : "CP (Cash Point) crediting unit; offsets up to 50% of package at registration."}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[#B0BBC2]">
          <span className="font-bold text-[#00D9DF]">/</span>
          <span>
            {locale === "zh-CN"
              ? "团队积分：左区 100 积分 + 右区 100 积分 = 10 CP 对碰奖励，未对碰积分次日结转保留。"
              : "Team Points: 100 Left + 100 Right = 10 CP pairing bonus; remaining points roll over."}
          </span>
        </div>
      </div>

      {/* Order History */}
      <div className="r10-card-dark p-4 shadow-md">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="h-3.5 w-[2.5px] rounded-full bg-[#00D9DF] shadow-[0_0_8px_rgba(0,217,223,0.8)]"
              aria-hidden="true"
            />
            <h2 className="text-sm font-semibold text-[#F4F6F7]">{t.packages.orderHistory}</h2>
          </div>
          <span className="tabular-nums text-[11px] text-[#829098]">
            {locale === "zh-CN"
              ? `左 ${leftBv.toLocaleString()} 积分 / 右 ${rightBv.toLocaleString()} 积分 · 今日已对碰 ${formatU(todayPairedPointsCents)} CP`
              : `L ${leftBv.toLocaleString()} pts / R ${rightBv.toLocaleString()} pts · Paired ${formatU(todayPairedPointsCents)} CP`}
          </span>
        </div>
        {orders.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#829098]">{t.common.noData}</p>
        ) : (
          <div className="space-y-2.5">
            {orders.map((o) => (
              <div
                key={o.id}
                className="rounded-xl border border-[#29363D] bg-[#070B0D] p-3.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono-sgt font-semibold text-[#00D9DF]">{o.orderNo}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full border border-[#29363D] bg-[#10171B] px-2 py-0.5 text-[10px] font-medium text-[#F4F6F7]">
                      {formatOrderStatus(o.status, locale)}
                    </span>
                    {o.upgradeStatus !== "NOT_APPLICABLE" && (
                      <span className="rounded-full bg-[#00D9DF]/20 px-2 py-0.5 text-[10px] font-semibold text-[#00D9DF]">
                        {o.upgradeStatus === "WAITING_EFFECTIVE"
                          ? t.packages.waitingEffectiveBadge
                          : formatEffectiveStatus(o.upgradeStatus, locale)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-1.5 flex justify-between text-[#B0BBC2]">
                  <span>
                    {formatOrderType(o.orderType, locale)}:{" "}
                    {o.previousPackageCode ? `${getPackageTierName(o.previousPackageCode)} → ` : ""}
                    <strong className="text-[#F4F6F7]">{getPackageTierName(o.targetPackageCode)}</strong>
                  </span>
                  <span className="tabular-nums text-[#F4F6F7]">
                    {formatU(o.amountUsdCents)} U · {formatBv(o.bvAmount)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap justify-between gap-1 text-[11px] text-[#829098]">
                  <span>
                    {locale === "zh-CN" ? "确认时间：" : "Confirmed: "}
                    <span className="font-mono-sgt">
                      {o.confirmedAtLabel ?? (locale === "zh-CN" ? "待确认" : "Pending")}
                    </span>
                  </span>
                  <span className="font-mono-sgt text-[#00D9DF]">
                    {locale === "zh-CN" ? "生效时间：" : "Effective: "}
                    {o.effectiveAtLabel ?? "—"}
                  </span>
                </div>
                {o.failureReason && (
                  <div className="mt-1 text-[11px] text-rose-300">{o.failureReason}</div>
                )}
                <div className="mt-2 flex items-center justify-between border-t border-[#29363D] pt-2">
                  <span className="text-[11px] text-[#829098]">
                    {o.expectedUsdtMicros
                      ? `${formatUsdtMicros(o.expectedUsdtMicros)} · ${formatDepositVerifyStatus(o.depositVerifyStatus, locale)}`
                      : formatOrderStatus(o.paymentStatus, locale)}
                  </span>
                  <Link
                    href={`/orders/${o.id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#00D9DF] hover:underline"
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
            <div className="flex items-center gap-1.5 text-[#00D9DF] font-semibold">
              <Sparkles className="h-4 w-4" />
              <span>
                {getPackageTierName(currentPackageCode)} → {getPackageTierName(selectedTarget.code)}
              </span>
            </div>

            {previewLoading ? (
              <div className="py-6 text-center text-[#829098]">{t.common.loading}</div>
            ) : previewError ? (
              <div className="rounded-xl border border-rose-500/35 bg-[#070B0D] p-4 text-center">
                <div className="text-rose-300">{previewError}</div>
                <button
                  type="button"
                  onClick={() => void loadPreview(selectedTarget)}
                  className="mt-3 min-h-[38px] rounded-xl border border-[#00D9DF]/50 px-4 text-xs font-semibold text-[#00D9DF]"
                >
                  {t.common.retry}
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="rounded-xl border border-[#29363D] bg-[#070B0D] p-3.5 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#B0BBC2]">{t.packages.currentTier}</span>
                    <span className="font-semibold text-[#F4F6F7]">
                      {getPackageTierName(currentPackageCode)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#B0BBC2]">
                      {locale === "zh-CN" ? "目标升级配套" : "Target Tier"}
                    </span>
                    <span className="font-semibold text-[#00D9DF]">{getPackageTierName(selectedTarget.code)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#B0BBC2]">{t.deposit.networkLabel}</span>
                    <span className="font-semibold text-[#F4F6F7]">
                      {formatNetworkLabel(usdtNetwork)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-[#29363D] pt-2">
                    <span className="text-[#B0BBC2]">{t.packages.actualPayable}</span>
                    <div className="text-right">
                      <span className="tabular-nums text-base font-bold text-[#E9C66B]">
                        {formatUsdtMicros(
                          isInitialFlow
                            ? selectedTarget.priceUsdtMicros
                            : selectedTarget.upgradePayUsdtMicros
                        )}
                      </span>
                      <div className="tabular-nums text-[11px] text-[#829098]">
                        {formatU(
                          serverPreview
                            ? serverPreview.payableUsdCents
                            : isInitialFlow
                              ? selectedTarget.priceUsdCents
                              : selectedTarget.upgradePayUsdCents
                        )}{" "}
                        U (USDT)
                      </div>
                    </div>
                  </div>
                </div>

                {!isInitialFlow && (
                  <>
                    <div className="flex justify-between px-1">
                      <span className="text-[#B0BBC2]">{t.packages.activeRuleLabel}</span>
                      <span className="font-mono-sgt text-[#F4F6F7]">
                        {locale === "zh-CN" ? "付款后 D+2 日 00:01:00 SGT" : "D+2 at 00:01:00 SGT"}
                      </span>
                    </div>
                    <div className="rounded-xl border border-[#29363D] bg-[#070B0D] p-3 text-[#00D9DF]">
                      {serverPreview?.naturalSchedule ?? naturalScheduleIfNow}
                    </div>
                    <div className="rounded-xl border border-[#29363D] bg-[#070B0D] p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[#B0BBC2]">{t.packages.catchupPreview}</span>
                        <span className="rounded border border-[#00D9DF]/30 px-1.5 py-0.5 text-[10px] font-semibold text-[#00D9DF]">
                          {t.common.estimatedBadge}
                        </span>
                      </div>
                      <div className="mt-1.5 tabular-nums font-semibold text-[#F4F6F7]">
                        {serverPreview
                          ? locale === "zh-CN"
                            ? `${serverPreview.estimatedCatchupPairs} 组 (+${formatU(serverPreview.estimatedCatchupPointsCents)} ${t.common.points})`
                            : `${serverPreview.estimatedCatchupPairs} pairs (+${formatU(serverPreview.estimatedCatchupPointsCents)} ${t.common.points})`
                          : locale === "zh-CN"
                            ? `${selectedTarget.estimatedCatchupPairs} 组 (+${formatU(selectedTarget.estimatedCatchupPointsCents)} ${t.common.points})`
                            : `${selectedTarget.estimatedCatchupPairs} pairs (+${formatU(selectedTarget.estimatedCatchupPointsCents)} ${t.common.points})`}
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-[#829098]">
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
                    className="r10-btn-dark min-h-[44px] rounded-xl font-medium text-[#F4F6F7]"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void submitOrder()}
                    className="r10-btn-gold min-h-[44px] rounded-xl font-bold text-[#070B0D] transition-all disabled:opacity-50"
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
