"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Lock, Wallet } from "lucide-react";
import type { Dictionary, Locale } from "@/lib/i18n";
import {
  formatEntryTypeLabel,
  formatTriggerTypeLabel,
  formatWithdrawalStatusLabel,
} from "@/lib/i18n-labels";
import {
  formatBv,
  formatRateMicros,
  formatU,
  formatUsdtMicros,
} from "@/lib/money";
import { formatNetworkLabel } from "@/lib/usdt/address";
import { BottomDrawer } from "@/components/MotionPrimitives";

interface SavedAddressItem {
  id: string;
  label: string;
  network: string;
  address: string;
  isDefault: boolean;
}

interface WithdrawalItem {
  id: string;
  withdrawalNo: string;
  requestedPointsCents: number;
  feePointsCents: number;
  netPointsCents: number;
  estimatedUsdCents: number;
  payoutAmountUsdtMicros: string;
  payoutNetwork: string;
  payoutDestination: string;
  status: string;
  approvalStatus: string;
  payoutStatus: string;
  payoutCheckNote: string | null;
  rejectionReason: string | null;
  payoutTxRef: string | null;
  processingDeadlineLabel: string | null;
  createdAtLabel: string;
}

function getWithdrawalStatusLabel(status: string, t: Dictionary): string {
  switch (status) {
    case "PENDING_APPROVAL":
      return t.wallet.statusPendingApproval;
    case "APPROVED":
      return t.wallet.statusApproved;
    case "CHAIN_CONFIRMING":
      return t.wallet.statusChainConfirming;
    case "PAYOUT_PENDING_CHECK":
      return t.wallet.statusPendingCheck;
    case "PAID":
      return t.wallet.statusPaid;
    case "REJECTED":
      return t.wallet.statusRejected;
    default:
      return status;
  }
}

function getWithdrawalStatusClass(status: string): string {
  switch (status) {
    case "PAID":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    case "REJECTED":
      return "border-rose-500/40 bg-rose-500/10 text-rose-300";
    case "CHAIN_CONFIRMING":
    case "PAYOUT_PENDING_CHECK":
      return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    case "APPROVED":
      return "border-[#CBB487]/50 bg-[#CBB487]/15 text-[#CBB487]";
    default:
      return "border-white/[0.12] bg-[#141619] text-[#F2F0EB]";
  }
}

type SourceDetail =
  | {
      kind: "DIRECT_ORDER";
      orderNo: string;
      sourceMember: string;
      packageCode: string;
      commissionableBv: number;
      confirmedAtLabel: string;
    }
  | {
      kind: "BINARY_PAIRING";
      settlementNo: string;
      settlementDate: string;
      triggerType: string;
      pairsCount: number;
      bvDeductedPerLeg: number;
      leftBvBefore: number;
      rightBvBefore: number;
      leftBvAfter: number;
      rightBvAfter: number;
      dailyCapPointsCents: number;
      dailyPairedAfterCents: number;
    }
  | {
      kind: "WITHDRAWAL";
      withdrawalNo: string;
      status: string;
      requestedPointsCents: number;
      feePointsCents: number;
      netPointsCents: number;
      estimatedUsdCents: number;
    }
  | null;

interface WalletLedgerItem {
  id: string;
  ledgerNo: string;
  entryType: string;
  deltaAvailableCents: number;
  deltaLockedCents: number;
  availableAfterCents: number;
  note: string | null;
  refNo: string | null;
  createdAtLabel: string;
  sourceDetail: SourceDetail;
}

interface ServerQuote {
  requestedPointsCents: number;
  feePointsCents: number;
  netPointsCents: number;
  estimatedUsdCents: number;
  payoutAmountUsdtMicros: string;
  feeRateBps: number;
  usdRateMicros: number;
  isDemoRate: boolean;
  usdtNetwork: string;
  processingHours: number;
  processingDeadlineLabel?: string;
  serviceAvailable?: boolean;
}

interface DirectUsdtItem {
  id: string;
  rewardNo: string;
  orderNo: string;
  packageCode: string;
  sourceMember: string;
  baseBv: number;
  rateBps: number;
  amountMicros: string;
  status: string;
  timeLabel: string;
}

export function WalletClient({
  t,
  locale = "en",
  initialMode = "overview",
  initialFilter = "ALL",
  memberStatus,
  availablePointsCents,
  lockedPointsCents,
  feeRateBps,
  usdRateMicros,
  isDemoRate,
  usdtNetwork,
  processingHours,
  serviceAvailable,
  directUsdtEarnedMicros = "0",
  directUsdtWithdrawalsEnabled = false,
  directUsdtItems = [],
  savedAddresses,
  withdrawals,
  ledgers,
}: {
  t: Dictionary;
  locale?: Locale;
  initialMode?: "overview" | "withdraw";
  initialFilter?: "ALL" | "DIRECT_USDT" | "DIRECT" | "PAIRING" | "WITHDRAW";
  memberStatus: string;
  availablePointsCents: number;
  lockedPointsCents: number;
  feeRateBps: number;
  usdRateMicros: number;
  isDemoRate: boolean;
  usdtNetwork: string;
  processingHours: number;
  serviceAvailable: boolean;
  directUsdtEarnedMicros?: string;
  directUsdtWithdrawalsEnabled?: boolean;
  directUsdtItems?: DirectUsdtItem[];
  savedAddresses: SavedAddressItem[];
  withdrawals: WithdrawalItem[];
  ledgers: WalletLedgerItem[];
}) {
  const router = useRouter();
  const [showWithdrawForm, setShowWithdrawForm] = useState(initialMode === "withdraw");
  const [filter, setFilter] = useState<
    "ALL" | "DIRECT_USDT" | "DIRECT" | "PAIRING" | "WITHDRAW"
  >(initialFilter);
  const [amountInput, setAmountInput] = useState("100");
  const [destination, setDestination] = useState(
    savedAddresses.find((s) => s.isDefault)?.address ?? savedAddresses[0]?.address ?? ""
  );
  const [saveAddress, setSaveAddress] = useState(false);
  const [addressLabel, setAddressLabel] = useState("");
  const [quote, setQuote] = useState<ServerQuote>({
    requestedPointsCents: 10000,
    feePointsCents: 2000,
    netPointsCents: 8000,
    estimatedUsdCents: 8000,
    payoutAmountUsdtMicros: "80000000",
    feeRateBps,
    usdRateMicros,
    isDemoRate,
    usdtNetwork,
    processingHours,
    serviceAvailable,
  });
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedWithdrawal, setSubmittedWithdrawal] = useState<WithdrawalItem | null>(null);
  const [selectedLedger, setSelectedLedger] = useState<WalletLedgerItem | null>(null);

  useEffect(() => {
    const val = Number(amountInput);
    if (!Number.isFinite(val) || val <= 0) {
      setQuoteError(null);
      setQuote((q) => ({
        ...q,
        requestedPointsCents: 0,
        feePointsCents: 0,
        netPointsCents: 0,
        estimatedUsdCents: 0,
        payoutAmountUsdtMicros: "0",
      }));
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setQuoteLoading(true);
      setQuoteError(null);
      try {
        const res = await fetch(
          `/api/withdrawals/quote?points=${encodeURIComponent(String(val))}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!cancelled) {
          if (res.ok && data.ok && data.quote) {
            setQuote(data.quote);
          } else {
            setQuoteError(data.error || t.common.loadError);
          }
        }
      } catch {
        if (!cancelled) {
          setQuoteError(t.common.loadError);
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [amountInput, t.common.loadError]);

  const filteredLedgers = ledgers.filter((l) => {
    if (filter === "ALL") return true;
    if (filter === "DIRECT") return l.entryType === "DIRECT_COMMISSION";
    if (filter === "PAIRING") return l.entryType === "BINARY_PAIRING";
    return (
      l.entryType === "WITHDRAWAL_LOCK" ||
      l.entryType === "WITHDRAWAL_RELEASE" ||
      l.entryType === "WITHDRAWAL_PAID"
    );
  });

  const handleConfirmSubmit = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedPoints: Number(amountInput),
          payoutDestination: destination.trim(),
          saveAddress,
          addressLabel: addressLabel.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || (locale === "zh-CN" ? "提现申请提交失败" : "Withdrawal request failed"));
        setLoading(false);
        inFlightRef.current = false;
        return;
      }

      const w = data.withdrawal;
      setSubmittedWithdrawal({
        id: w.id,
        withdrawalNo: w.withdrawalNo,
        requestedPointsCents: w.requestedPointsCents,
        feePointsCents: w.feePointsCents,
        netPointsCents: w.netPointsCents,
        estimatedUsdCents: w.estimatedUsdCents,
        payoutAmountUsdtMicros: String(
          w.payoutAmountUsdtMicros ?? quote.payoutAmountUsdtMicros
        ),
        payoutNetwork: w.payoutNetwork ?? usdtNetwork,
        payoutDestination: w.payoutDestination,
        status: w.status,
        approvalStatus: w.approvalStatus,
        payoutStatus: w.payoutStatus,
        payoutCheckNote: w.payoutCheckNote ?? null,
        rejectionReason: w.rejectionReason ?? null,
        payoutTxRef: w.payoutTxRef ?? null,
        processingDeadlineLabel: quote.processingDeadlineLabel ?? `${processingHours}h SGT`,
        createdAtLabel: locale === "zh-CN" ? "刚刚 (SGT)" : "Just now (SGT)",
      });
      setConfirmStep(false);
      setShowWithdrawForm(false);
      setLoading(false);
      inFlightRef.current = false;
      router.refresh();
    } catch {
      setError(
        locale === "zh-CN"
          ? "网络异常，提交失败。表单内容已保留，请重试。"
          : "Network error submitting withdrawal. Inputs preserved; please retry."
      );
      setLoading(false);
      inFlightRef.current = false;
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#F2F0EB]">
            {t.wallet.title}
          </h1>
          <p className="mt-0.5 text-xs text-[#A7AEBC]">{t.wallet.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowWithdrawForm((s) => !s);
            setConfirmStep(false);
            setError(null);
          }}
          className="min-h-[44px] shrink-0 rounded-xl bg-[#CBB487] px-4 text-xs font-semibold text-[#08090B] transition-all duration-100 hover:bg-[#D8C49B] active:scale-[0.98]"
        >
          {showWithdrawForm ? t.common.cancel : t.overview.withdrawCta}
        </button>
      </div>

      {/* Top Balances Shared Graphite Panel */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141619]">
        <div className="grid grid-cols-2 divide-x divide-white/[0.1]">
          <div className="p-4">
            <div className="flex items-center justify-between text-xs text-[#A7AEBC]">
              <span>{t.wallet.available}</span>
              <Wallet className="h-4 w-4 text-[#CBB487]" />
            </div>
            <div className="mt-2 tabular-nums text-2xl font-bold text-[#F2F0EB]">
              {formatU(availablePointsCents)}{" "}
              <span className="text-xs font-semibold text-[#CBB487]">{t.common.points}</span>
            </div>
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between text-xs text-[#A7AEBC]">
              <span>{t.wallet.locked}</span>
              <Lock className="h-4 w-4 text-[#A7AEBC]" />
            </div>
            <div className="mt-2 tabular-nums text-2xl font-bold text-[#F2F0EB]">
              {formatU(lockedPointsCents)}{" "}
              <span className="text-xs font-medium text-[#A7AEBC]">{t.common.points}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Post-Submit Detail Card */}
      {submittedWithdrawal && (
        <div className="rounded-2xl border border-emerald-500/35 bg-[#141619] p-4 text-xs">
          <div className="flex items-center gap-2 font-semibold text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>
              {t.wallet.submittedTitle}: {submittedWithdrawal.withdrawalNo}
            </span>
          </div>
          <div className="mt-2 space-y-1 text-[#A7AEBC]">
            <div>
              {t.common.status}:{" "}
              <strong className="text-[#CBB487]">
                {getWithdrawalStatusLabel(submittedWithdrawal.status, t)}
              </strong>{" "}
              · {locale === "zh-CN" ? "锁定：" : "Locked: "}
              <strong className="tabular-nums text-[#F2F0EB]">
                {formatU(submittedWithdrawal.requestedPointsCents)} {t.common.points}
              </strong>
            </div>
            <div>
              {locale === "zh-CN" ? "实际出款：" : "Net Payout: "}
              <strong className="tabular-nums text-[#CBB487]">
                {formatUsdtMicros(submittedWithdrawal.payoutAmountUsdtMicros)}
              </strong>{" "}
              ({formatNetworkLabel(submittedWithdrawal.payoutNetwork)})
            </div>
            <div className="break-all font-mono-sgt text-[11px] text-[#D6D3CC]">
              {submittedWithdrawal.payoutDestination}
            </div>
            {submittedWithdrawal.processingDeadlineLabel && (
              <div className="font-mono-sgt text-[11px] text-[#A7AEBC]">
                {t.wallet.deadlineLabel}: {submittedWithdrawal.processingDeadlineLabel}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Withdrawal Form */}
      {showWithdrawForm && (
        <div className="rounded-2xl border border-white/[0.1] bg-[#141619] p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#F2F0EB]">{t.wallet.requestTitle}</h2>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-[#CBB487]/35 bg-[#CBB487]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#CBB487]">
                {formatNetworkLabel(usdtNetwork)}
              </span>
              <span className="font-mono-sgt rounded-full border border-white/[0.1] bg-[#08090B] px-2.5 py-0.5 text-[11px] text-[#A7AEBC]">
                1 U = {formatRateMicros(quote.usdRateMicros)} USDT
              </span>
            </div>
          </div>

          {!serviceAvailable ? (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-3 text-xs text-amber-200"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>{t.wallet.serviceUnavailable}</span>
            </div>
          ) : (
            <>
              {error && (
                <div
                  role="alert"
                  className="mb-3 flex items-center gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#F2F0EB]">
                    {t.wallet.amountLabel}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="1"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-white/[0.1] bg-[#08090B] px-3.5 py-2.5 tabular-nums text-sm text-[#F2F0EB] outline-none focus:border-[#CBB487]"
                  />
                </div>

                {savedAddresses.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[11px] font-medium text-[#A7AEBC]">
                      {t.wallet.savedAddressesLabel}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {savedAddresses.map((sa) => (
                        <button
                          key={sa.id}
                          type="button"
                          onClick={() => setDestination(sa.address)}
                          className={`min-h-[34px] rounded-xl border px-3 text-[11px] transition-colors ${
                            destination.trim() === sa.address
                              ? "border-[#CBB487] bg-[#CBB487]/15 text-[#CBB487]"
                              : "border-white/[0.1] bg-[#08090B] text-[#D6D3CC] hover:border-[#CBB487]/50"
                          }`}
                        >
                          {sa.label} ({sa.address.slice(0, 6)}...{sa.address.slice(-4)})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#F2F0EB]">
                    {t.wallet.destinationLabel}
                  </label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder={t.wallet.destinationPlaceholder}
                    className="font-mono-sgt min-h-[44px] w-full rounded-xl border border-white/[0.1] bg-[#08090B] px-3.5 py-2.5 text-xs text-[#F2F0EB] placeholder-[#A7AEBC]/45 outline-none focus:border-[#CBB487]"
                  />
                  <p className="mt-1 text-[11px] text-[#A7AEBC]">{t.wallet.addressHint}</p>
                </div>

                <div className="space-y-2 rounded-xl border border-white/[0.08] bg-[#08090B] p-3 text-xs">
                  <label className="flex items-center gap-2 text-[#D6D3CC]">
                    <input
                      type="checkbox"
                      checked={saveAddress}
                      onChange={(e) => setSaveAddress(e.target.checked)}
                      className="h-4 w-4 accent-[#CBB487]"
                    />
                    <span>{t.wallet.saveAddressOption}</span>
                  </label>
                  {saveAddress && (
                    <input
                      type="text"
                      value={addressLabel}
                      onChange={(e) => setAddressLabel(e.target.value)}
                      placeholder={t.wallet.addressLabelPlaceholder}
                      className="min-h-[38px] w-full rounded-lg border border-white/[0.1] bg-[#141619] px-3 text-xs text-[#F2F0EB] placeholder:text-[#687080] outline-none focus:border-[#CBB487]"
                    />
                  )}
                </div>

                {quoteError ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-500/35 bg-[#08090B] p-3.5 text-xs text-rose-300"
                  >
                    {quoteError}
                  </div>
                ) : (
                  <div className="space-y-2 rounded-xl border border-white/[0.08] bg-[#08090B] p-3.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#A7AEBC]">{t.wallet.amountLabel}</span>
                      <span className="tabular-nums font-medium text-[#F2F0EB]">
                        {formatU(quote.requestedPointsCents)} {t.common.points}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A7AEBC]">{t.wallet.feeLabel}</span>
                      <span className="tabular-nums font-medium text-[#CBB487]">
                        -{formatU(quote.feePointsCents)} {t.common.points}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-white/[0.08] pt-2">
                      <span className="text-[#F2F0EB]">{t.wallet.netLabel}</span>
                      <span className="tabular-nums font-semibold text-[#F2F0EB]">
                        {formatU(quote.netPointsCents)} {t.common.points}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A7AEBC]">{t.wallet.rateLabel}</span>
                      <span className="font-mono-sgt text-[#A7AEBC]">
                        1 U = {formatRateMicros(quote.usdRateMicros)} USDT
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A7AEBC]">{t.wallet.deadlineLabel}</span>
                      <span className="font-mono-sgt text-[#A7AEBC]">
                        {quote.processingDeadlineLabel ?? `${processingHours}h SGT`}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-white/[0.08] pt-2 text-sm">
                      <span className="font-medium text-[#F2F0EB]">
                        {t.wallet.estimatedUsdLabel}
                      </span>
                      <span className="tabular-nums font-bold text-[#CBB487]">
                        {quoteLoading ? "..." : formatUsdtMicros(quote.payoutAmountUsdtMicros)}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  disabled={
                    memberStatus !== "ACTIVE" ||
                    quote.requestedPointsCents <= 0 ||
                    !destination.trim() ||
                    Boolean(quoteError)
                  }
                  onClick={() => {
                    const trimmed = destination.trim();
                    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(trimmed)) {
                      setError(
                        locale === "zh-CN"
                          ? "无效的 TRON (TRC20) 收款地址"
                          : "Invalid TRON (TRC20) receiving address"
                      );
                      return;
                    }
                    setError(null);
                    setConfirmStep(true);
                  }}
                  className="min-h-[44px] w-full rounded-xl bg-[#CBB487] px-4 text-sm font-semibold text-[#08090B] transition-all duration-100 hover:bg-[#D8C49B] active:scale-[0.99] disabled:opacity-50"
                >
                  {t.wallet.reviewBtn}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Filter Pills: All / Direct U / Historical Direct / Matching / Withdraw */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "ALL", label: t.wallet.filterAll },
            { key: "DIRECT_USDT", label: t.wallet.filterDirectUsdt },
            { key: "DIRECT", label: t.wallet.filterDirect },
            { key: "PAIRING", label: t.wallet.filterPairing },
            { key: "WITHDRAW", label: t.wallet.filterWithdraw },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`min-h-[40px] rounded-full px-4 text-xs font-semibold transition-colors ${
              filter === item.key
                ? "bg-[#CBB487] text-[#08090B]"
                : "border border-white/[0.1] bg-[#141619] text-[#A7AEBC] hover:text-[#F2F0EB]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Direct USDT Rewards Ledger View (when Direct USDT filter selected) */}
      {filter === "DIRECT_USDT" ? (
        <div className="rounded-2xl border border-[#6E512D]/45 bg-[#14171C] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
            <div>
              <h2 className="text-sm font-semibold text-[#F2F0EB]">
                {t.wallet.filterDirectUsdt}
              </h2>
              <div className="mt-0.5 text-[11px] text-[#9DA4B0]">{t.overview.usdtUnitNote}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-[#9DA4B0]">
                {t.overview.referralRewardsEarnedLabel}
              </div>
              <div className="tabular-nums text-lg font-bold text-[#E7C98E]">
                {formatUsdtMicros(directUsdtEarnedMicros, "U")}
              </div>
            </div>
          </div>

          {!directUsdtWithdrawalsEnabled && (
            <div className="rounded-xl border border-[#6E512D]/40 bg-[#08090B] px-3.5 py-2.5 text-[11px] text-[#9DA4B0]">
              {locale === "zh-CN"
                ? "直推奖励 U 独立提现规则（门槛/手续费）待平台最终确认；当前展示实时入账与待确认明细，钱包余额提现仍按 20% 手续费规则以 USDT 提交。"
                : "Standalone direct referral U withdrawal eligibility & fee rules are pending final confirmation; credited & pending referral U ledgers remain tracked separately while wallet balance withdraws in USDT with the configured 20% fee."}
            </div>
          )}

          {directUsdtItems.length === 0 ? (
            <p className="py-6 text-center text-xs text-[#9DA4B0]">{t.common.noData}</p>
          ) : (
            <div className="space-y-2">
              {directUsdtItems.map((item) => {
                const amtBig = BigInt(item.amountMicros);
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-white/[0.07] bg-[#08090B] p-3.5 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#F2F0EB]">
                        {item.sourceMember}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          item.status === "CREDITED"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : item.status === "REVERSED"
                              ? "bg-rose-500/15 text-rose-300"
                              : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {locale === "zh-CN"
                          ? item.status === "CREDITED"
                            ? "已入账"
                            : item.status === "REVERSED"
                              ? "已冲正"
                              : item.status === "PENDING"
                                ? "待确认"
                                : item.status
                          : item.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-sgt text-[11px] text-[#9DA4B0]">
                        {item.orderNo} · {item.packageCode} ({item.baseBv} BV ×{" "}
                        {item.rateBps / 100}%)
                      </span>
                      <span
                        className={`tabular-nums font-bold ${
                          amtBig < 0n
                            ? "text-rose-300"
                            : item.status === "PENDING"
                              ? "text-amber-300"
                              : "text-[#E7C98E]"
                        }`}
                      >
                        {amtBig > 0n ? "+" : ""}
                        {formatUsdtMicros(amtBig, "U")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#9DA4B0]">
                      <span className="font-mono-sgt">{item.rewardNo}</span>
                      <span className="font-mono-sgt">{item.timeLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Wallet Ledger List (Mobile-Friendly Cards, Clickable for Bonus Source Drawer) */
        <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#F2F0EB]">{t.wallet.ledgerTitle}</h2>
            <span className="text-[11px] text-[#A7AEBC]">
              {locale === "zh-CN" ? "点击条目查看来源详情" : "Tap item for source detail"}
            </span>
          </div>

          {filteredLedgers.length === 0 ? (
            <p className="py-6 text-center text-xs text-[#A7AEBC]">{t.common.noData}</p>
          ) : (
            <div className="space-y-2">
              {filteredLedgers.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelectedLedger(l)}
                  className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#08090B] px-3.5 py-3 text-left text-xs transition-colors hover:border-[#CBB487]/50"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[#F2F0EB]">
                      {formatEntryTypeLabel(l.entryType, locale)}
                    </div>
                    <div className="font-mono-sgt mt-0.5 truncate text-[11px] text-[#A7AEBC]">
                      {l.refNo ?? l.ledgerNo} · {l.createdAtLabel}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={`tabular-nums font-bold ${
                        l.deltaAvailableCents >= 0 ? "text-emerald-400" : "text-[#CBB487]"
                      }`}
                    >
                      {l.deltaAvailableCents >= 0 ? "+" : ""}
                      {formatU(l.deltaAvailableCents)} {t.common.points}
                    </div>
                    <div className="tabular-nums text-[10px] text-[#A7AEBC]">
                      {locale === "zh-CN" ? "余额: " : "Bal: "}
                      {formatU(l.availableAfterCents)} U
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Withdrawal History */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-4">
        <h2 className="mb-3 text-sm font-semibold text-[#F2F0EB]">{t.wallet.historyTitle}</h2>
        {withdrawals.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#A7AEBC]">{t.common.noData}</p>
        ) : (
          <div className="space-y-2.5">
            {withdrawals.map((w) => (
              <div
                key={w.id}
                className="rounded-xl border border-white/[0.07] bg-[#08090B] p-3.5 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-sgt font-semibold text-[#CBB487]">
                    {w.withdrawalNo}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getWithdrawalStatusClass(
                      w.status
                    )}`}
                  >
                    {getWithdrawalStatusLabel(w.status, t)}
                  </span>
                </div>
                <div className="flex justify-between text-[#A7AEBC]">
                  <span>
                    {locale === "zh-CN"
                      ? `申请 ${formatU(w.requestedPointsCents)} U · 手续费 ${formatU(w.feePointsCents)} U`
                      : `Req ${formatU(w.requestedPointsCents)} U · Fee ${formatU(w.feePointsCents)} U`}
                  </span>
                  <span className="tabular-nums font-semibold text-[#CBB487]">
                    {formatUsdtMicros(w.payoutAmountUsdtMicros)}
                  </span>
                </div>
                <div className="break-all font-mono-sgt text-[11px] text-[#D6D3CC]">
                  {formatNetworkLabel(w.payoutNetwork)}: {w.payoutDestination}
                </div>
                {w.payoutTxRef && (
                  <div className="break-all font-mono-sgt text-[11px] text-emerald-300">
                    TxID: {w.payoutTxRef}
                  </div>
                )}
                {w.rejectionReason && (
                  <div className="text-[11px] text-rose-300">{w.rejectionReason}</div>
                )}
                <div className="flex flex-wrap justify-between gap-2 text-[10px] text-[#A7AEBC]">
                  <span>
                    {locale === "zh-CN" ? "提交时间：" : "Submitted: "}
                    {w.createdAtLabel}
                  </span>
                  {w.processingDeadlineLabel && (
                    <span className="font-mono-sgt">
                      {locale === "zh-CN" ? "预计处理期限：" : "SLA: "}
                      {w.processingDeadlineLabel}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Withdrawal Confirmation BottomDrawer (easy one-handed thumb reach) */}
      <BottomDrawer
        open={confirmStep}
        onClose={() => {
          if (!loading) setConfirmStep(false);
        }}
        title={t.wallet.confirmPanelTitle}
      >
        <div className="space-y-4 text-xs">
          <div className="space-y-2.5 rounded-xl border border-[#CBB487]/35 bg-[#08090B] p-4">
            <div className="flex justify-between">
              <span className="text-[#A7AEBC]">{t.wallet.networkLabel}</span>
              <span className="font-semibold text-[#CBB487]">
                {formatNetworkLabel(quote.usdtNetwork)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#A7AEBC]">{t.wallet.amountLabel}</span>
              <span className="tabular-nums font-semibold text-[#F2F0EB]">
                {formatU(quote.requestedPointsCents)} {t.common.points}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#A7AEBC]">{t.wallet.feeLabel}</span>
              <span className="tabular-nums text-[#CBB487]">
                -{formatU(quote.feePointsCents)} {t.common.points}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#A7AEBC]">{t.wallet.netLabel}</span>
              <span className="tabular-nums font-semibold text-[#F2F0EB]">
                {formatU(quote.netPointsCents)} {t.common.points}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#A7AEBC]">{t.wallet.deadlineLabel}</span>
              <span className="font-mono-sgt text-[#D6D3CC]">
                {quote.processingDeadlineLabel ?? `${processingHours}h SGT`}
              </span>
            </div>
            <div className="flex justify-between border-t border-white/[0.08] pt-2">
              <span className="text-[#A7AEBC]">{t.wallet.estimatedUsdLabel}</span>
              <span className="tabular-nums font-bold text-[#CBB487]">
                {formatUsdtMicros(quote.payoutAmountUsdtMicros)}
              </span>
            </div>
            <div className="space-y-1 border-t border-white/[0.08] pt-2">
              <div className="text-[#A7AEBC]">{t.wallet.destinationLabel}</div>
              <div className="break-all rounded-lg border border-white/[0.08] bg-[#141619] p-2.5 font-mono-sgt text-xs font-medium text-[#F2F0EB]">
                {destination.trim()}
              </div>
              <p className="text-[11px] text-amber-200">{t.wallet.confirmWarning}</p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 p-3 text-rose-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={loading}
              onClick={() => setConfirmStep(false)}
              className="min-h-[48px] rounded-xl border border-white/[0.1] bg-[#08090B] font-medium text-[#F2F0EB]"
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleConfirmSubmit()}
              className="min-h-[48px] rounded-xl bg-[#CBB487] font-semibold text-[#08090B] transition-transform duration-100 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? t.common.loading : t.wallet.submitBtn}
            </button>
          </div>
        </div>
      </BottomDrawer>

      {/* Wallet Ledger Source Detail BottomDrawer */}
      <BottomDrawer
        open={Boolean(selectedLedger)}
        onClose={() => setSelectedLedger(null)}
        title={
          selectedLedger
            ? `${selectedLedger.ledgerNo} · ${formatEntryTypeLabel(selectedLedger.entryType, locale)}`
            : locale === "zh-CN"
              ? "奖金流水来源详情"
              : "Bonus Source Detail"
        }
      >
        {selectedLedger && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2 font-mono-sgt text-[#CBB487]">
              <Info className="h-4 w-4" />
              <span>{selectedLedger.createdAtLabel}</span>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#08090B] p-4 space-y-2 text-[#D6D3CC]">
              {selectedLedger.sourceDetail?.kind === "DIRECT_ORDER" && (
                <>
                  <div className="flex justify-between">
                    <span className="text-[#A7AEBC]">
                      {locale === "zh-CN" ? "来源订单" : "Source Order"}
                    </span>
                    <strong className="font-mono-sgt text-[#F2F0EB]">
                      {selectedLedger.sourceDetail.orderNo}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A7AEBC]">
                      {locale === "zh-CN" ? "直推下级会员" : "Referred Member"}
                    </span>
                    <strong className="text-[#F2F0EB]">
                      {selectedLedger.sourceDetail.sourceMember}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A7AEBC]">
                      {locale === "zh-CN" ? "配套 / BV" : "Plan / BV"}
                    </span>
                    <span>
                      {selectedLedger.sourceDetail.packageCode} ·{" "}
                      {formatBv(selectedLedger.sourceDetail.commissionableBv)} (25%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A7AEBC]">
                      {locale === "zh-CN" ? "确认时间 (SGT)" : "Confirmed (SGT)"}
                    </span>
                    <span className="font-mono-sgt text-[#F2F0EB]">
                      {selectedLedger.sourceDetail.confirmedAtLabel}
                    </span>
                  </div>
                </>
              )}
              {selectedLedger.sourceDetail?.kind === "BINARY_PAIRING" && (
                <>
                  <div className="flex justify-between">
                    <span className="text-[#A7AEBC]">
                      {locale === "zh-CN" ? "结算单号" : "Settlement No"}
                    </span>
                    <strong className="font-mono-sgt text-[#F2F0EB]">
                      {selectedLedger.sourceDetail.settlementNo}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A7AEBC]">
                      {locale === "zh-CN" ? "SGT 结算日" : "SGT Date"}
                    </span>
                    <span className="font-mono-sgt text-[#F2F0EB]">
                      {selectedLedger.sourceDetail.settlementDate} SGT
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A7AEBC]">
                      {locale === "zh-CN" ? "结算对碰组数" : "Pairs Settled"}
                    </span>
                    <strong className="text-emerald-400">
                      {selectedLedger.sourceDetail.pairsCount} (
                      {formatTriggerTypeLabel(selectedLedger.sourceDetail.triggerType, locale)})
                    </strong>
                  </div>
                  <div className="flex justify-between border-t border-white/[0.08] pt-2">
                    <span className="text-[#A7AEBC]">
                      {locale === "zh-CN" ? "双边扣减 BV" : "BV Deducted"}
                    </span>
                    <span className="tabular-nums text-[#F2F0EB]">
                      {locale === "zh-CN" ? "左" : "L"} {selectedLedger.sourceDetail.leftBvBefore} →{" "}
                      {selectedLedger.sourceDetail.leftBvAfter} · {locale === "zh-CN" ? "右" : "R"}{" "}
                      {selectedLedger.sourceDetail.rightBvBefore} →{" "}
                      {selectedLedger.sourceDetail.rightBvAfter}
                    </span>
                  </div>
                </>
              )}
              {selectedLedger.sourceDetail?.kind === "WITHDRAWAL" && (
                <>
                  <div className="flex justify-between">
                    <span className="text-[#A7AEBC]">
                      {locale === "zh-CN" ? "提现单号" : "Withdrawal No"}
                    </span>
                    <strong className="font-mono-sgt text-[#F2F0EB]">
                      {selectedLedger.sourceDetail.withdrawalNo}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A7AEBC]">{t.common.status}</span>
                    <span className="text-[#CBB487]">
                      {formatWithdrawalStatusLabel(selectedLedger.sourceDetail.status, locale)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A7AEBC]">
                      {locale === "zh-CN" ? "金额明细" : "Breakdown"}
                    </span>
                    <span className="tabular-nums text-[#F2F0EB]">
                      {locale === "zh-CN"
                        ? `申请 ${formatU(selectedLedger.sourceDetail.requestedPointsCents)} U · 手续费 ${formatU(selectedLedger.sourceDetail.feePointsCents)} U · 实得 ${formatU(selectedLedger.sourceDetail.netPointsCents)} U`
                        : `Req ${formatU(selectedLedger.sourceDetail.requestedPointsCents)} U · Fee ${formatU(selectedLedger.sourceDetail.feePointsCents)} U · Net ${formatU(selectedLedger.sourceDetail.netPointsCents)} U`}
                    </span>
                  </div>
                </>
              )}
              {!selectedLedger.sourceDetail && (
                <div>
                  {selectedLedger.note ??
                    (locale === "zh-CN" ? "系统账本自动记账条目" : "System ledger entry")}
                </div>
              )}
            </div>
          </div>
        )}
      </BottomDrawer>
    </div>
  );
}
