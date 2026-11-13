"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Coins,
  Gift,
  Info,
  Layers,
  Lock,
  Wallet,
} from "lucide-react";
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
import { SubpageHeaderTitle } from "@/components/Roll10Logo";

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
      return "border-[#51E7FA]/50 bg-[#51E7FA]/15 text-[#51E7FA]";
    default:
      return "border-[#2B3D4D] bg-[#101B27] text-[#F4F8FC]";
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
  cpBalanceCents = 0,
  rpBalanceCents = 0,
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
  cpBalanceCents?: number;
  rpBalanceCents?: number;
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
  const [selectedAsset, setSelectedAsset] = useState<"USDT" | "RP" | "CP">("CP");
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
    if (filter === "DIRECT")
      return (
        l.entryType === "DIRECT_COMMISSION" ||
        l.entryType === "DIFFERENTIAL_REWARD"
      );
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
    <div className="space-y-4 pb-4">
      {/* Subpage Header */}
      <SubpageHeaderTitle
        title={t.wallet.title}
        subtitle={t.wallet.subtitle}
      />

      {/* 1. Asset Segmented Switcher (USDT | RP | CP) */}
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-[#29363D] bg-[#10171B] p-1 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
        {(["USDT", "RP", "CP"] as const).map((asset) => {
          const active = selectedAsset === asset;
          return (
            <button
              key={asset}
              type="button"
              onClick={() => setSelectedAsset(asset)}
              className={`min-h-[42px] rounded-xl text-xs font-bold transition-all duration-150 ${
                active
                  ? "bg-[#00D9DF] text-[#070B0D] shadow-[0_0_12px_rgba(0,217,223,0.35)]"
                  : "text-[#B0BBC2] hover:text-[#F4F6F7]"
              }`}
            >
              {asset}
            </button>
          );
        })}
      </div>

      {/* 2. Hero Asset Card */}
      <div className="r10-card-dark relative overflow-hidden p-5 space-y-4 border border-[#29363D] bg-gradient-to-b from-[#172126] to-[#10171B]">
        {/* Subtle racetrack curve highlight */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-[#00D9DF]/10 blur-2xl"
        />

        {selectedAsset === "CP" && (
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#E9C66B]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#E9C66B]/50 bg-[#E9C66B]/15 text-[10px] font-bold">
                CP
              </span>
              <span>Cash Point</span>
            </div>
            <div className="mt-2 font-mono-sgt text-3xl sm:text-4xl font-black text-[#E9C66B] drop-shadow-[0_2px_10px_rgba(233,198,107,0.35)]">
              {formatU(cpBalanceCents)}{" "}
              <span className="text-xl font-bold text-[#E9C66B]/80">CP</span>
            </div>
            <p className="mt-1 text-xs text-[#829098]">
              {locale === "zh-CN" ? "直推、极差与对碰奖励账户" : "Direct, differential & matching rewards"}
            </p>

            <div className="mt-4 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => router.push("/register")}
                className="r10-btn-gold min-h-[44px] flex-1 rounded-xl text-xs font-bold text-[#070B0D]"
              >
                {locale === "zh-CN" ? "用于注册抵扣" : "Use for Registration"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowWithdrawForm((s) => !s);
                  setConfirmStep(false);
                  setError(null);
                }}
                className="r10-btn-dark min-h-[44px] px-4 rounded-xl text-xs font-semibold text-[#F4F6F7]"
              >
                {t.overview.withdrawCta}
              </button>
            </div>
          </div>
        )}

        {selectedAsset === "RP" && (
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#00D9DF]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#00D9DF]/50 bg-[#00D9DF]/15 text-[10px] font-bold">
                RP
              </span>
              <span>Register Point</span>
            </div>
            <div className="mt-2 font-mono-sgt text-3xl sm:text-4xl font-black text-[#00D9DF] drop-shadow-[0_2px_10px_rgba(0,217,223,0.35)]">
              {formatU(rpBalanceCents)}{" "}
              <span className="text-xl font-bold text-[#00D9DF]/80">RP</span>
            </div>
            <p className="mt-1 text-xs text-[#829098]">
              {locale === "zh-CN" ? "注册点数 · 由公司出售（1 RP 抵扣 1 U）" : "Registration points issued by platform"}
            </p>

            <div className="mt-4 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => router.push("/register")}
                className="r10-btn-cyan min-h-[44px] flex-1 rounded-xl text-xs font-bold text-[#070B0D]"
              >
                {locale === "zh-CN" ? "立即用于注册" : "Use for Registration"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/account")}
                className="r10-btn-dark min-h-[44px] px-4 rounded-xl text-xs font-semibold text-[#F4F6F7]"
              >
                {locale === "zh-CN" ? "购买 RP" : "Buy RP"}
              </button>
            </div>
          </div>
        )}

        {selectedAsset === "USDT" && (
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#52C898]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#52C898]/50 bg-[#52C898]/15 text-[10px] font-bold">
                ₮
              </span>
              <span>Tether (TRC20)</span>
            </div>
            <div className="mt-2 font-mono-sgt text-3xl sm:text-4xl font-black text-[#F4F6F7]">
              {formatU(availablePointsCents)}{" "}
              <span className="text-xl font-bold text-[#52C898]">U</span>
            </div>
            <p className="mt-1 text-xs text-[#829098]">
              {locale === "zh-CN" ? "可提现余额 · 72h 链上自动出款" : "Withdrawable balance · 72h on-chain payout"}
            </p>

            <div className="mt-4 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowWithdrawForm((s) => !s);
                  setConfirmStep(false);
                  setError(null);
                }}
                className="r10-btn-gold min-h-[44px] flex-1 rounded-xl text-xs font-bold text-[#070B0D]"
              >
                {showWithdrawForm ? t.common.cancel : t.wallet.requestTitle}
              </button>
            </div>
          </div>
        )}

        {/* Footnote */}
        <div className="border-t border-[#29363D] pt-2 text-[11px] text-[#829098]">
          <span>① 注册最多可使用 50% CP · 固定 50% RP ＋ USDT 补足余额</span>
        </div>
      </div>

      {/* Post-Submit Detail Card */}
      {submittedWithdrawal && (
        <div className="rounded-2xl border border-emerald-500/35 bg-[#10171B] p-4 text-xs">
          <div className="flex items-center gap-2 font-semibold text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>
              {t.wallet.submittedTitle}: {submittedWithdrawal.withdrawalNo}
            </span>
          </div>
          <div className="mt-2 space-y-1 text-[#B0BBC2]">
            <div>
              {t.common.status}:{" "}
              <strong className="text-[#00D9DF]">
                {getWithdrawalStatusLabel(submittedWithdrawal.status, t)}
              </strong>{" "}
              · {locale === "zh-CN" ? "锁定：" : "Locked: "}
              <strong className="tabular-nums text-[#F4F6F7]">
                {formatU(submittedWithdrawal.requestedPointsCents)} {t.common.points}
              </strong>
            </div>
            <div>
              {locale === "zh-CN" ? "实际出款：" : "Net Payout: "}
              <strong className="tabular-nums text-[#00D9DF]">
                {formatUsdtMicros(submittedWithdrawal.payoutAmountUsdtMicros)}
              </strong>{" "}
              ({formatNetworkLabel(submittedWithdrawal.payoutNetwork)})
            </div>
            <div className="break-all font-mono-sgt text-[11px] text-[#F4F6F7]">
              {submittedWithdrawal.payoutDestination}
            </div>
            {submittedWithdrawal.processingDeadlineLabel && (
              <div className="font-mono-sgt text-[11px] text-[#829098]">
                {t.wallet.deadlineLabel}: {submittedWithdrawal.processingDeadlineLabel}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Withdrawal Form */}
      {showWithdrawForm && (
        <div className="r10-card-dark p-5 shadow-lg space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#29363D] pb-3">
            <h2 className="text-sm font-semibold text-[#F4F6F7]">{t.wallet.requestTitle}</h2>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-[#00D9DF]/40 bg-[#00D9DF]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#00D9DF]">
                {formatNetworkLabel(usdtNetwork)}
              </span>
              <span className="font-mono-sgt rounded-full border border-[#29363D] bg-[#070B0D] px-2.5 py-0.5 text-[11px] text-[#B0BBC2]">
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
                  className="flex items-center gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#F4F6F7]">
                    {t.wallet.amountLabel}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="1"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-[#29363D] bg-[#070B0D] px-3.5 py-2.5 tabular-nums text-sm text-[#F4F6F7] outline-none focus:border-[#00D9DF]"
                  />
                </div>

                {savedAddresses.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[11px] font-medium text-[#B0BBC2]">
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
                              ? "border-[#00D9DF] bg-[#00D9DF]/15 text-[#00D9DF]"
                              : "border-[#29363D] bg-[#070B0D] text-[#B0BBC2] hover:border-[#00D9DF]/50"
                          }`}
                        >
                          {sa.label} ({sa.address.slice(0, 6)}...{sa.address.slice(-4)})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#F4F6F7]">
                    {t.wallet.destinationLabel}
                  </label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder={t.wallet.destinationPlaceholder}
                    className="font-mono-sgt min-h-[44px] w-full rounded-xl border border-[#29363D] bg-[#070B0D] px-3.5 py-2.5 text-xs text-[#F4F6F7] placeholder-[#829098]/60 outline-none focus:border-[#00D9DF]"
                  />
                  <p className="mt-1 text-[11px] text-[#829098]">{t.wallet.addressHint}</p>
                </div>

                <div className="space-y-2 rounded-xl border border-[#29363D] bg-[#070B0D] p-3 text-xs">
                  <label className="flex items-center gap-2 text-[#B0BBC2]">
                    <input
                      type="checkbox"
                      checked={saveAddress}
                      onChange={(e) => setSaveAddress(e.target.checked)}
                      className="h-4 w-4 accent-[#00D9DF]"
                    />
                    <span>{t.wallet.saveAddressOption}</span>
                  </label>
                  {saveAddress && (
                    <input
                      type="text"
                      value={addressLabel}
                      onChange={(e) => setAddressLabel(e.target.value)}
                      placeholder={t.wallet.addressLabelPlaceholder}
                      className="min-h-[38px] w-full rounded-lg border border-[#29363D] bg-[#10171B] px-3 text-xs text-[#F4F6F7] placeholder:text-[#829098] outline-none focus:border-[#00D9DF]"
                    />
                  )}
                </div>

                {quoteError ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-500/35 bg-[#070B0D] p-3.5 text-xs text-rose-300"
                  >
                    {quoteError}
                  </div>
                ) : (
                  <div className="space-y-2 rounded-xl border border-[#29363D] bg-[#070B0D] p-3.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#B0BBC2]">{t.wallet.amountLabel}</span>
                      <span className="tabular-nums font-medium text-[#F4F6F7]">
                        {formatU(quote.requestedPointsCents)} {t.common.points}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#B0BBC2]">{t.wallet.feeLabel}</span>
                      <span className="tabular-nums font-medium text-[#00D9DF]">
                        -{formatU(quote.feePointsCents)} {t.common.points}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-[#29363D] pt-2">
                      <span className="text-[#F4F6F7]">{t.wallet.netLabel}</span>
                      <span className="tabular-nums font-semibold text-[#F4F6F7]">
                        {formatU(quote.netPointsCents)} {t.common.points}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#829098]">{t.wallet.rateLabel}</span>
                      <span className="font-mono-sgt text-[#829098]">
                        1 U = {formatRateMicros(quote.usdRateMicros)} USDT
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#829098]">{t.wallet.deadlineLabel}</span>
                      <span className="font-mono-sgt text-[#829098]">
                        {quote.processingDeadlineLabel ?? `${processingHours}h SGT`}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-[#29363D] pt-2 text-sm">
                      <span className="font-medium text-[#F4F6F7]">
                        {t.wallet.estimatedUsdLabel}
                      </span>
                      <span className="tabular-nums font-bold text-[#00D9DF]">
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
                  className="r10-btn-gold min-h-[44px] w-full rounded-xl px-4 text-sm font-bold text-[#070B0D] transition-all disabled:opacity-50"
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
            className={`min-h-[40px] rounded-full px-4 text-xs font-bold transition-all ${
              filter === item.key
                ? "bg-[#00D9DF] text-[#070B0D] shadow-[0_0_12px_rgba(0,217,223,0.35)]"
                : "border border-[#29363D] bg-[#10171B] text-[#B0BBC2] hover:text-[#F4F6F7]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Direct USDT Rewards Ledger View (when Direct USDT filter selected) */}
      {filter === "DIRECT_USDT" ? (
        <div className="r10-card-dark p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#29363D] pb-3">
            <div>
              <h2 className="text-sm font-semibold text-[#F4F6F7]">
                {t.wallet.filterDirectUsdt}
              </h2>
              <div className="mt-0.5 text-[11px] text-[#829098]">{t.overview.usdtUnitNote}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-[#829098]">
                {t.overview.referralRewardsEarnedLabel}
              </div>
              <div className="tabular-nums text-lg font-bold text-[#E9C66B]">
                {formatUsdtMicros(directUsdtEarnedMicros, "U")}
              </div>
            </div>
          </div>

          {!directUsdtWithdrawalsEnabled && (
            <div className="rounded-xl border border-[#29363D] bg-[#070B0D] px-3.5 py-2.5 text-[11px] text-[#829098]">
              {locale === "zh-CN"
                ? "直推奖励 U 独立提现规则（门槛/手续费）待平台最终确认；当前展示实时入账与待确认明细，钱包余额提现仍按 20% 手续费规则以 USDT 提交。"
                : "Standalone direct referral U withdrawal eligibility & fee rules are pending final confirmation; credited & pending referral U ledgers remain tracked separately while wallet balance withdraws in USDT with the configured 20% fee."}
            </div>
          )}

          {directUsdtItems.length === 0 ? (
            <p className="py-6 text-center text-xs text-[#829098]">{t.common.noData}</p>
          ) : (
            <div className="space-y-2">
              {directUsdtItems.map((item) => {
                const amtBig = BigInt(item.amountMicros);
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[#29363D] bg-[#070B0D] p-3.5 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#F4F6F7]">
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
                      <span className="font-mono-sgt text-[11px] text-[#829098]">
                        {item.orderNo} · {item.packageCode} ({item.baseBv} U ×{" "}
                        {item.rateBps / 100}%)
                      </span>
                      <span
                        className={`tabular-nums font-bold ${
                          amtBig < 0n
                            ? "text-rose-300"
                            : item.status === "PENDING"
                              ? "text-amber-300"
                              : "text-[#E9C66B]"
                        }`}
                      >
                        {amtBig > 0n ? "+" : ""}
                        {formatUsdtMicros(amtBig, "U")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#829098]">
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
        <div className="r10-card-dark p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="h-3.5 w-[2.5px] rounded-full bg-[#00D9DF] shadow-[0_0_8px_rgba(0,217,223,0.8)]"
                aria-hidden="true"
              />
              <h2 className="text-sm font-semibold text-[#F4F6F7]">{t.wallet.ledgerTitle}</h2>
            </div>
            <span className="text-[11px] text-[#829098]">
              {locale === "zh-CN" ? "点击条目查看更多详情" : "Tap item for source detail"}
            </span>
          </div>

          {filteredLedgers.length === 0 ? (
            <p className="py-6 text-center text-xs text-[#829098]">{t.common.noData}</p>
          ) : (
            <div className="space-y-2">
              {filteredLedgers.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelectedLedger(l)}
                  className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl border border-[#29363D] bg-[#070B0D] px-3.5 py-3 text-left text-xs transition-colors hover:border-[#00D9DF]/60"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[#F4F6F7]">
                      {formatEntryTypeLabel(l.entryType, locale)}
                    </div>
                    <div className="font-mono-sgt mt-0.5 truncate text-[11px] text-[#829098]">
                      {(l.refNo && l.refNo.length > 22 ? l.refNo.slice(0, 20) + "..." : l.refNo) ?? l.ledgerNo} · {l.createdAtLabel}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={`tabular-nums font-bold ${
                        l.deltaAvailableCents >= 0 ? "text-[#E9C66B]" : "text-rose-300"
                      }`}
                    >
                      {l.deltaAvailableCents >= 0 ? "+" : ""}
                      {formatU(l.deltaAvailableCents)} {t.common.points}
                    </div>
                    <div className="tabular-nums text-[10px] text-[#829098]">
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
      <div className="r10-card-dark p-4">
        <div className="mb-3 flex items-center gap-2">
          <span
            className="h-3.5 w-[2.5px] rounded-full bg-[#00D9DF] shadow-[0_0_8px_rgba(0,217,223,0.8)]"
            aria-hidden="true"
          />
          <h2 className="text-sm font-semibold text-[#F4F6F7]">{t.wallet.historyTitle}</h2>
        </div>
        {withdrawals.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#829098]">{t.common.noData}</p>
        ) : (
          <div className="space-y-2.5">
            {withdrawals.map((w) => (
              <div
                key={w.id}
                className="rounded-xl border border-[#29363D] bg-[#070B0D] p-3.5 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-sgt font-semibold text-[#00D9DF]">
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
                <div className="flex justify-between text-[#829098]">
                  <span>
                    {locale === "zh-CN"
                      ? `申请 ${formatU(w.requestedPointsCents)} U · 手续费 ${formatU(w.feePointsCents)} U`
                      : `Req ${formatU(w.requestedPointsCents)} U · Fee ${formatU(w.feePointsCents)} U`}
                  </span>
                  <span className="tabular-nums font-semibold text-[#00D9DF]">
                    {formatUsdtMicros(w.payoutAmountUsdtMicros)}
                  </span>
                </div>
                <div className="break-all font-mono-sgt text-[11px] text-[#F4F6F7]">
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
                <div className="flex flex-wrap justify-between gap-2 text-[10px] text-[#829098]">
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
          <div className="space-y-2.5 rounded-xl border border-[#51E7FA]/35 bg-[#101B27] p-4">
            <div className="flex justify-between">
              <span className="text-[#AAB8C7]">{t.wallet.networkLabel}</span>
              <span className="font-semibold text-[#51E7FA]">
                {formatNetworkLabel(quote.usdtNetwork)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#AAB8C7]">{t.wallet.amountLabel}</span>
              <span className="tabular-nums font-semibold text-[#F4F8FC]">
                {formatU(quote.requestedPointsCents)} {t.common.points}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#AAB8C7]">{t.wallet.feeLabel}</span>
              <span className="tabular-nums text-[#51E7FA]">
                -{formatU(quote.feePointsCents)} {t.common.points}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#AAB8C7]">{t.wallet.netLabel}</span>
              <span className="tabular-nums font-semibold text-[#F4F8FC]">
                {formatU(quote.netPointsCents)} {t.common.points}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#AAB8C7]">{t.wallet.deadlineLabel}</span>
              <span className="font-mono-sgt text-[#CAD7E6]">
                {quote.processingDeadlineLabel ?? `${processingHours}h SGT`}
              </span>
            </div>
            <div className="flex justify-between border-t border-[#2B3D4D] pt-2">
              <span className="text-[#AAB8C7]">{t.wallet.estimatedUsdLabel}</span>
              <span className="tabular-nums font-bold text-[#51E7FA]">
                {formatUsdtMicros(quote.payoutAmountUsdtMicros)}
              </span>
            </div>
            <div className="space-y-1 border-t border-[#2B3D4D] pt-2">
              <div className="text-[#AAB8C7]">{t.wallet.destinationLabel}</div>
              <div className="break-all rounded-lg border border-[#2B3D4D] bg-[#0A101A] p-2.5 font-mono-sgt text-xs font-medium text-[#F4F8FC]">
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
              className="min-h-[48px] rounded-xl border border-[#2B3D4D] bg-[#0A101A] font-medium text-[#F4F8FC]"
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleConfirmSubmit()}
              className="min-h-[48px] rounded-xl bg-[#51E7FA] font-bold text-[#0A101A] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 shadow-[0_0_12px_rgba(81,231,250,0.3)]"
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
            <div className="flex items-center gap-2 font-mono-sgt text-[#51E7FA]">
              <Info className="h-4 w-4" />
              <span>{selectedLedger.createdAtLabel}</span>
            </div>

            <div className="rounded-xl border border-[#2B3D4D] bg-[#101B27] p-4 space-y-2 text-[#CAD7E6]">
              {selectedLedger.sourceDetail?.kind === "DIRECT_ORDER" && (
                <>
                  <div className="flex justify-between">
                    <span className="text-[#AAB8C7]">
                      {locale === "zh-CN" ? "来源订单" : "Source Order"}
                    </span>
                    <strong className="font-mono-sgt text-[#F4F8FC]">
                      {selectedLedger.sourceDetail.orderNo}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#AAB8C7]">
                      {locale === "zh-CN" ? "直推下级会员" : "Referred Member"}
                    </span>
                    <strong className="text-[#F4F8FC]">
                      {selectedLedger.sourceDetail.sourceMember}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#AAB8C7]">
                      {locale === "zh-CN" ? "配套 / 积分" : "Plan / Points"}
                    </span>
                    <span>
                      {selectedLedger.sourceDetail.packageCode} ·{" "}
                      {formatBv(selectedLedger.sourceDetail.commissionableBv)} (25%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#AAB8C7]">
                      {locale === "zh-CN" ? "确认时间 (SGT)" : "Confirmed (SGT)"}
                    </span>
                    <span className="font-mono-sgt text-[#F4F8FC]">
                      {selectedLedger.sourceDetail.confirmedAtLabel}
                    </span>
                  </div>
                </>
              )}
              {selectedLedger.sourceDetail?.kind === "BINARY_PAIRING" && (
                <>
                  <div className="flex justify-between">
                    <span className="text-[#AAB8C7]">
                      {locale === "zh-CN" ? "结算单号" : "Settlement No"}
                    </span>
                    <strong className="font-mono-sgt text-[#F4F8FC]">
                      {selectedLedger.sourceDetail.settlementNo}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#AAB8C7]">
                      {locale === "zh-CN" ? "SGT 结算日" : "SGT Date"}
                    </span>
                    <span className="font-mono-sgt text-[#F4F8FC]">
                      {selectedLedger.sourceDetail.settlementDate} SGT
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#AAB8C7]">
                      {locale === "zh-CN" ? "结算对碰组数" : "Pairs Settled"}
                    </span>
                    <strong className="text-[#51E7FA]">
                      {selectedLedger.sourceDetail.pairsCount} (
                      {formatTriggerTypeLabel(selectedLedger.sourceDetail.triggerType, locale)})
                    </strong>
                  </div>
                  <div className="flex justify-between border-t border-[#2B3D4D] pt-2">
                    <span className="text-[#AAB8C7]">
                      {locale === "zh-CN" ? "双边扣减积分" : "Points Deducted"}
                    </span>
                    <span className="tabular-nums text-[#F4F8FC]">
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
                    <span className="text-[#AAB8C7]">
                      {locale === "zh-CN" ? "提现单号" : "Withdrawal No"}
                    </span>
                    <strong className="font-mono-sgt text-[#F4F8FC]">
                      {selectedLedger.sourceDetail.withdrawalNo}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#AAB8C7]">{t.common.status}</span>
                    <span className="text-[#51E7FA]">
                      {formatWithdrawalStatusLabel(selectedLedger.sourceDetail.status, locale)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#AAB8C7]">
                      {locale === "zh-CN" ? "金额明细" : "Breakdown"}
                    </span>
                    <span className="tabular-nums text-[#F4F8FC]">
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
