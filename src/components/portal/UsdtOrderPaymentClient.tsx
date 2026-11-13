"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatOrderType } from "@/lib/i18n-labels";
import { formatUsdtMicros } from "@/lib/money";
import { formatNetworkLabel } from "@/lib/usdt/address";
import { QrCodeSvg } from "@/components/QrCodeSvg";

export interface DepositTransferEventView {
  id: string;
  eventIndex: number;
  fromAddress: string;
  toAddress: string;
  contractAddress: string;
  amountMicros: string;
  confirmations: number;
  chainSuccess: boolean;
  blockTimestamp: string | null;
}

export interface UsdtOrderView {
  id: string;
  orderNo: string;
  orderType: string;
  targetPackageCode: string;
  tierName: string;
  bvAmount: number;
  status: string;
  paymentStatus: string;
  usdtNetwork: string | null;
  usdtContractAddress: string | null;
  usdtDepositAddress: string | null;
  expectedUsdtMicros: string | null;
  actualUsdtMicros: string | null;
  submittedTxId: string | null;
  proofNote: string | null;
  depositVerifyStatus: string;
  depositFailureReason: string | null;
  confirmationsObserved: number;
  minConfirmations: number;
  chainConfirmedAtLabel: string | null;
  confirmedAtLabel: string | null;
  effectiveAtLabel: string | null;
  createdAtLabel: string;
  events: DepositTransferEventView[];
}

function getVerifyBadgeStyle(status: string): string {
  switch (status) {
    case "VERIFIED_MATCH":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    case "VERIFYING":
    case "MANUAL_REVIEW":
      return "border-[#51E7FA]/50 bg-[#51E7FA]/15 text-[#51E7FA]";
    case "FAILED_MISMATCH":
      return "border-rose-500/40 bg-rose-500/10 text-rose-300";
    default:
      return "border-white/[0.12] bg-[#08090B] text-[#A7AEBC]";
  }
}

function getVerifyStatusLabel(status: string, locale: Locale): string {
  if (locale === "zh-CN") {
    switch (status) {
      case "AWAITING_TX":
        return "待提交转账哈希";
      case "VERIFYING":
        return "链上确认中";
      case "MANUAL_REVIEW":
        return "待财务复核归属";
      case "VERIFIED_MATCH":
        return "链上校验通过";
      case "FAILED_MISMATCH":
        return "校验不匹配";
      default:
        return status;
    }
  }
  switch (status) {
    case "AWAITING_TX":
      return "Awaiting TxID";
    case "VERIFYING":
      return "Chain Confirming";
    case "MANUAL_REVIEW":
      return "Manual Review";
    case "VERIFIED_MATCH":
      return "Verified Match";
    case "FAILED_MISMATCH":
      return "Mismatch";
    default:
      return status;
  }
}

export function UsdtOrderPaymentClient({
  t,
  locale,
  serviceAvailable,
  initialOrder,
}: {
  t: Dictionary;
  locale: Locale;
  serviceAvailable: boolean;
  initialOrder: UsdtOrderView;
}) {
  const router = useRouter();
  const [order, setOrder] = useState<UsdtOrderView>(initialOrder);
  const [txId, setTxId] = useState(initialOrder.submittedTxId ?? "");
  const [proofNote, setProofNote] = useState(initialOrder.proofNote ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<"address" | "amount" | "contract" | null>(null);
  const redirectStartedRef = useRef(false);

  const isConfirmed = order.status === "CONFIRMED";
  const canSubmitTx =
    serviceAvailable &&
    !isConfirmed &&
    order.status !== "CANCELLED" &&
    Boolean(order.usdtDepositAddress && order.expectedUsdtMicros);

  const copyText = async (value: string, field: "address" | "amount" | "contract") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const refreshOrder = async (silent = true) => {
    if (!silent) setPolling(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok || !data.order) return;
      const latest = data.order;
      setOrder((prev) => {
        const latestEvents = Array.isArray(latest.depositTransferEvents)
          ? latest.depositTransferEvents.map((ev: Record<string, unknown>) => ({
              id: String(ev.id),
              eventIndex: Number(ev.eventIndex ?? 0),
              fromAddress: String(ev.fromAddress ?? ""),
              toAddress: String(ev.toAddress ?? ""),
              contractAddress: String(ev.contractAddress ?? ""),
              amountMicros: String(ev.amountMicros ?? "0"),
              confirmations: Number(ev.confirmations ?? 0),
              chainSuccess: Boolean(ev.chainSuccess),
              blockTimestamp: ev.chainTimestamp ? String(ev.chainTimestamp) : null,
            }))
          : prev.events;
        return {
          ...prev,
          status: latest.status,
          paymentStatus: latest.paymentStatus,
          submittedTxId: latest.submittedTxId ?? prev.submittedTxId,
          proofNote: latest.paymentProofNote ?? prev.proofNote,
          depositVerifyStatus: latest.depositVerifyStatus,
          depositFailureReason: latest.depositFailureReason,
          confirmationsObserved: latestEvents[0]?.confirmations ?? prev.confirmationsObserved,
          actualUsdtMicros: latest.actualUsdtMicros ? String(latest.actualUsdtMicros) : null,
          events: latestEvents,
        };
      });

      if (latest.status === "CONFIRMED" && !redirectStartedRef.current) {
        redirectStartedRef.current = true;
        setFeedback(t.deposit.confirmedRedirect);
        setTimeout(() => {
          router.push("/dashboard?activated=1");
          router.refresh();
        }, 1200);
      }
    } catch {
      // Ignore transient polling failures
    } finally {
      if (!silent) setPolling(false);
    }
  };

  // Auto-poll every 4s while waiting for confirmations or admin confirmation
  useEffect(() => {
    if (isConfirmed || order.status === "CANCELLED") return;
    if (
      !order.submittedTxId &&
      order.depositVerifyStatus === "AWAITING_TX"
    ) {
      return;
    }
    const timer = setInterval(() => {
      void refreshOrder(true);
    }, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, order.status, order.submittedTxId, order.depositVerifyStatus]);

  const handleSubmitTx = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleaned = txId.trim();
    if (!cleaned) {
      setError(locale === "zh-CN" ? "请输入交易哈希 TxID" : "Please enter your transaction hash (TxID)");
      return;
    }
    setSubmitting(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/tx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txId: cleaned, proofNote: proofNote.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Failed to submit TxID");
        setSubmitting(false);
        return;
      }
      setFeedback(data.message || t.deposit.waitingConfirmation);
      await refreshOrder(true);
    } catch {
      setError(locale === "zh-CN" ? "网络异常，请重试" : "Network error while checking TxID. Please retry.");
    } finally {
      setSubmitting(false);
    }
  };

  const expectedUsdtFormatted = order.expectedUsdtMicros
    ? formatUsdtMicros(order.expectedUsdtMicros)
    : "—";
  const expectedUsdtRawCopy = order.expectedUsdtMicros
    ? (Number(order.expectedUsdtMicros) / 1_000_000).toString()
    : "";

  return (
    <div className="space-y-5 pb-6">
      {/* Top Back Bar */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/packages"
          className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-medium text-[#A7AEBC] hover:text-[#F2F0EB]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t.deposit.goPackagesBtn}</span>
        </Link>
        <span className="font-mono-sgt rounded-full border border-[#51E7FA]/35 bg-[#101B27] px-3 py-1 text-[11px] font-medium text-[#51E7FA]">
          {order.orderNo}
        </span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#F4F8FC]">
          {t.deposit.title}
        </h1>
        <p className="mt-0.5 text-xs text-[#AAB8C7]">{t.deposit.subtitle}</p>
      </div>

      {/* Confirmed Banner */}
      {isConfirmed && (
        <div className="r10-enter rounded-2xl border border-emerald-500/40 bg-[#101B27] p-4 text-xs">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
            <span>
              {locale === "zh-CN" ? "订单已确认生效" : "Order Confirmed & Active"}
            </span>
          </div>
          <div className="mt-2 space-y-1 text-[#AAB8C7]">
            <div>
              {t.deposit.tierLabel}:{" "}
              <strong className="text-[#F4F8FC]">
                {order.targetPackageCode} ({order.bvAmount} BV)
              </strong>
            </div>
            {order.confirmedAtLabel && (
              <div>
                {locale === "zh-CN" ? "确认时间 (SGT)：" : "Confirmed (SGT): "}
                <strong className="font-mono-sgt text-[#F4F8FC]">{order.confirmedAtLabel}</strong>
              </div>
            )}
            {order.effectiveAtLabel && (
              <div>
                {locale === "zh-CN" ? "生效时间 (SGT)：" : "Effective (SGT): "}
                <strong className="font-mono-sgt text-[#51E7FA]">{order.effectiveAtLabel}</strong>
              </div>
            )}
          </div>
          <Link
            href="/dashboard?activated=1"
            className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#51E7FA] px-5 text-xs font-semibold text-[#0A101A] shadow-[0_0_12px_rgba(81,231,250,0.35)] hover:bg-[#74edfc]"
          >
            {t.deposit.goHomeBtn}
          </Link>
        </div>
      )}

      {/* Service Unavailable Banner */}
      {!serviceAvailable && !isConfirmed && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-500/40 bg-[#101B27] p-4 text-xs text-amber-200"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>{t.deposit.serviceUnavailable}</span>
          </div>
        </div>
      )}

      {/* Order Summary & Deposit Payment Panel */}
      {serviceAvailable && order.usdtDepositAddress && order.expectedUsdtMicros && (
        <section className="rounded-2xl border border-[#2B3D4D] bg-[#101B27] p-4 sm:p-5 space-y-4">
          {/* Status Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2B3D4D] pb-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[#AAB8C7]">
                {formatOrderType(order.orderType, locale)} · {order.targetPackageCode}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-[#F4F8FC]">
                {order.tierName} · {order.bvAmount} BV
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-[#51E7FA]/40 bg-[#51E7FA]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#51E7FA]">
                {formatNetworkLabel(order.usdtNetwork)}
              </span>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${getVerifyBadgeStyle(
                  order.depositVerifyStatus
                )}`}
              >
                {getVerifyStatusLabel(order.depositVerifyStatus, locale)}
              </span>
            </div>
          </div>

          {/* Exact Amount & QR Layout */}
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="space-y-3 min-w-0">
              {/* Payable USDT */}
              <div className="rounded-xl border border-[#51E7FA]/35 bg-[#0A101A] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[#AAB8C7]">{t.deposit.amountLabel}</span>
                  <button
                    type="button"
                    onClick={() => void copyText(expectedUsdtRawCopy, "amount")}
                    className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-[#2B3D4D] bg-[#101B27] px-2.5 text-[11px] font-medium text-[#51E7FA] hover:border-[#51E7FA]"
                  >
                    {copiedField === "amount" ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>{t.common.copied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>{t.common.copy}</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-1 tabular-nums text-2xl font-bold tracking-tight text-[#51E7FA]">
                  {expectedUsdtFormatted}
                </div>
                <p className="mt-1 text-[11px] text-[#AAB8C7]">{t.deposit.exactAmountHint}</p>
              </div>

              {/* Company Deposit Address */}
              <div className="rounded-xl border border-[#2B3D4D] bg-[#0A101A] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[#AAB8C7]">{t.deposit.addressLabel}</span>
                  <button
                    type="button"
                    onClick={() => void copyText(order.usdtDepositAddress || "", "address")}
                    className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-[#51E7FA]/40 bg-[#51E7FA]/10 px-2.5 text-[11px] font-semibold text-[#51E7FA] hover:bg-[#51E7FA]/20"
                  >
                    {copiedField === "address" ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>{t.common.copied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>{t.common.copy}</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-1.5 break-all font-mono-sgt text-xs font-medium text-[#F4F8FC]">
                  {order.usdtDepositAddress}
                </div>
              </div>

              {/* USDT Contract Address */}
              {order.usdtContractAddress && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-[#08090B] px-3 py-2 text-[11px]">
                  <span className="text-[#AAB8C7]">{t.deposit.contractLabel}</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono-sgt truncate max-w-[190px] sm:max-w-none text-[#F4F8FC]">
                      {order.usdtContractAddress}
                    </span>
                    <button
                      type="button"
                      onClick={() => void copyText(order.usdtContractAddress || "", "contract")}
                      className="text-[#51E7FA] hover:underline shrink-0"
                    >
                      {copiedField === "contract" ? t.common.copied : t.common.copy}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-[#2B3D4D] bg-[#0A101A] p-3.5">
              <QrCodeSvg value={order.usdtDepositAddress} size={156} />
              <span className="mt-2 text-[11px] font-medium text-[#AAB8C7]">
                {t.deposit.qrLabel}
              </span>
            </div>
          </div>

          {/* Network Warning */}
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-3.5 py-2.5 text-xs text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <span>{t.deposit.networkWarning}</span>
          </div>
        </section>
      )}

      {/* TxID Submission & Chain Status */}
      {!isConfirmed && serviceAvailable && (
        <section className="rounded-2xl border border-[#2B3D4D] bg-[#101B27] p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#F4F8FC]">
              <ShieldCheck className="h-4 w-4 text-[#51E7FA]" />
              <span>{t.deposit.txIdLabel}</span>
            </div>
            {order.submittedTxId && (
              <button
                type="button"
                disabled={polling || submitting}
                onClick={() => void handleSubmitTx()}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-[#2B3D4D] bg-[#0A101A] px-3 text-[11px] font-medium text-[#51E7FA] hover:border-[#51E7FA]"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${polling ? "animate-spin" : ""}`} />
                <span>{t.deposit.retryVerifyBtn}</span>
              </button>
            )}
          </div>

          {order.depositFailureReason && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 p-3 text-xs text-rose-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <span>{order.depositFailureReason}</span>
            </div>
          )}

          {order.depositVerifyStatus === "VERIFYING" && (
            <div className="flex items-start gap-2 rounded-xl border border-[#51E7FA]/35 bg-[#51E7FA]/10 p-3 text-xs text-[#F4F8FC]">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#51E7FA]" />
              <div>
                <div className="font-semibold text-[#51E7FA]">{t.deposit.waitingConfirmation}</div>
                <div className="mt-0.5 tabular-nums text-[#AAB8C7]">
                  {locale === "zh-CN"
                    ? `区块确认数: ${order.confirmationsObserved} / ${order.minConfirmations}`
                    : `Confirmations: ${order.confirmationsObserved} / ${order.minConfirmations}`}
                </div>
              </div>
            </div>
          )}

          {order.depositVerifyStatus === "VERIFIED_MATCH" && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <span>
                {locale === "zh-CN"
                  ? "链上金额与收款地址核对无误，等待管理员确认激活并安置节点。"
                  : "On-chain transfer verified. Awaiting admin attribution confirmation & placement activation."}
              </span>
            </div>
          )}

          {order.depositVerifyStatus === "MANUAL_REVIEW" && (
            <div className="flex items-start gap-2 rounded-xl border border-[#51E7FA]/40 bg-[#51E7FA]/10 p-3 text-xs text-[#F4F8FC]">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#51E7FA]" />
              <span>
                {locale === "zh-CN"
                  ? "检测到多事件或多笔待匹配订单，已进入财务人工复核队列。"
                  : "Multiple transfer events or same-amount pending orders detected. Queued for admin review."}
              </span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300"
            >
              {error}
            </div>
          )}

          {feedback && (
            <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-200">
              {feedback}
            </div>
          )}

          <form onSubmit={handleSubmitTx} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#F4F8FC]">
                {t.deposit.txIdLabel}
              </label>
              <input
                type="text"
                value={txId}
                onChange={(e) => setTxId(e.target.value)}
                disabled={!canSubmitTx || submitting}
                placeholder={t.deposit.txIdPlaceholder}
                className="font-mono-sgt min-h-[44px] w-full rounded-xl border border-[#2B3D4D] bg-[#0A101A] px-3.5 text-xs text-[#F4F8FC] placeholder:text-[#687080] focus:border-[#51E7FA] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#F4F8FC]">
                {t.deposit.proofLabel}
              </label>
              <input
                type="text"
                value={proofNote}
                onChange={(e) => setProofNote(e.target.value)}
                disabled={!canSubmitTx || submitting}
                placeholder={t.deposit.proofPlaceholder}
                className="min-h-[44px] w-full rounded-xl border border-[#2B3D4D] bg-[#0A101A] px-3.5 text-xs text-[#F4F8FC] placeholder:text-[#687080] focus:border-[#51E7FA] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmitTx || submitting}
              className="flex min-h-[46px] w-full items-center justify-center rounded-xl bg-[#51E7FA] px-4 text-sm font-semibold text-[#0A101A] shadow-[0_0_12px_rgba(81,231,250,0.35)] transition-transform duration-100 hover:bg-[#74edfc] active:scale-[0.99] disabled:opacity-50"
            >
              {submitting ? t.common.loading : t.deposit.submitTxBtn}
            </button>
          </form>

          {/* Observed Chain Events */}
          {order.events.length > 0 && (
            <div className="border-t border-[#2B3D4D] pt-3 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#AAB8C7]">
                {t.deposit.chainObservedTitle}
              </div>
              {order.events.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-xl border border-[#2B3D4D] bg-[#0A101A] p-3 text-[11px] space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-sgt text-[#51E7FA]">
                      {locale === "zh-CN" ? `事件 #${ev.eventIndex}` : `Event #${ev.eventIndex}`} ·{" "}
                      {formatUsdtMicros(ev.amountMicros)}
                    </span>
                    <span className="tabular-nums text-[#AAB8C7]">
                      {locale === "zh-CN"
                        ? `${ev.confirmations} 次确认 · ${ev.chainSuccess ? "成功" : "失败"}`
                        : `${ev.confirmations} confs · ${ev.chainSuccess ? "SUCCESS" : "FAILED"}`}
                    </span>
                  </div>
                  <div className="font-mono-sgt break-all text-[#AAB8C7]">
                    {locale === "zh-CN" ? "接收地址: " : "To: "}
                    <span className="text-[#F4F8FC]">{ev.toAddress}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
