"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Lock,
  RefreshCw,
  Send,
  UserCheck,
} from "lucide-react";
import { formatU, formatRateMicros, formatUsdtMicros } from "@/lib/money";
import type { Locale } from "@/lib/i18n";
import { formatWithdrawalStatusLabel } from "@/lib/i18n-labels";
import { formatNetworkLabel } from "@/lib/usdt/address";

interface WithdrawalAdminRow {
  id: string;
  withdrawalNo: string;
  memberCode: string;
  memberName: string;
  memberLockedPointsCents: number;
  requestedPointsCents: number;
  feeRateBpsSnapshot: number;
  feePointsCents: number;
  netPointsCents: number;
  usdRateMicros: number;
  estimatedUsdCents: number;
  payoutAmountUsdtMicros: string;
  payoutNetwork: string;
  isDemoRate: boolean;
  payoutDestination: string;
  status: string;
  approvalStatus: string;
  payoutStatus: string;
  payoutCheckNote: string | null;
  payoutTxRef: string | null;
  confirmationsObserved: number;
  rejectionReason: string | null;
  claimedById: string | null;
  claimedByLabel: string | null;
  processingDeadlineLabel: string | null;
  isOverdue: boolean;
  isNearDeadline: boolean;
  createdAtLabel: string;
}

export function AdminWithdrawalsClient({
  locale = "en",
  currentAdminId,
  sortMode,
  withdrawals,
  productionPayoutEnabled,
  usdtPayoutAddress,
}: {
  locale?: Locale;
  currentAdminId: string;
  sortMode: "deadline" | "newest";
  withdrawals: WithdrawalAdminRow[];
  productionPayoutEnabled: boolean;
  usdtPayoutAddress: string | null;
}) {
  const isZh = locale === "zh-CN";
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [txRefInput, setTxRefInput] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const act = async (
    id: string,
    action:
      | "CLAIM"
      | "TAKEOVER"
      | "APPROVE"
      | "SUBMIT_TX"
      | "RETRY_TX"
      | "MARK_PENDING_CHECK"
      | "PAY"
      | "REJECT",
    extra?: { reason?: string; payoutTxRef?: string; takeoverNote?: string }
  ) => {
    setBusyId(id);
    setBanner(null);
    const res = await fetch(`/api/admin/withdrawals/${id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok || !data.ok) {
      setBanner({ type: "err", text: data.error || (isZh ? "操作失败" : "Action failed") });
      return;
    }
    const statusLabel = formatWithdrawalStatusLabel(data.withdrawal?.status ?? "", locale);
    setBanner({
      type: "ok",
      text: data.message
        ? `${statusLabel}: ${data.message}`
        : isZh
          ? `提现状态已更新（${statusLabel}）。`
          : `Withdrawal updated (${statusLabel}).`,
    });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {isZh ? "USDT 提现审核与出款队列" : "USDT Withdrawals & Treasury Queue"}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {isZh
              ? "支持多人并发领单锁与接管，按净出款 USDT 与收款地址核验 TRON TRC20 出款 TxID，并严格控制 SLA 期限。"
              : "Claim concurrent payouts safely, verify outbound TRON TRC20 TxIDs against net USDT & receiving address, and enforce processing deadlines."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              router.push(
                sortMode === "deadline"
                  ? "/admin/withdrawals?sort=newest"
                  : "/admin/withdrawals"
              )
            }
            className="rounded-full border border-white/15 bg-[#141619] px-3 py-1 text-xs font-medium text-[#CBB487] hover:border-[#CBB487]"
          >
            {isZh ? "排序: " : "Sort: "}
            {sortMode === "deadline"
              ? isZh
                ? "处理期限升序 (SLA)"
                : "Deadline ASC (SLA)"
              : isZh
                ? "最新提交优先"
                : "Newest First"}
          </button>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              productionPayoutEnabled
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-[#CBB487]/35 bg-[#CBB487]/10 text-[#CBB487]"
            }`}
          >
            {isZh ? "出款钱包: " : "Payout Wallet: "}
            {usdtPayoutAddress
              ? `${usdtPayoutAddress.slice(0, 6)}...${usdtPayoutAddress.slice(-4)}`
              : isZh
                ? "未配置"
                : "Not Configured"}
          </span>
        </div>
      </div>

      {banner && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs ${
            banner.type === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-300"
          }`}
        >
          {banner.type === "ok" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      <div className="rounded-2xl border border-amber-500/35 bg-amber-500/[0.08] px-4 py-3 text-xs text-amber-200">
        {isZh ? (
          <>
            <strong className="font-semibold">待确认规则说明（直推 U vs 对碰 U 提现规则）：</strong>{" "}
            当前钱包余额提现统一按已配置的 <strong>20% 手续费</strong> 经由 TRON (TRC20) 以{" "}
            <strong>U / USDT</strong> 出款；直推奖励 U 与双轨对碰 U 的独立提现门槛及分账手续费规则待业务最终确认。
          </>
        ) : (
          <>
            <strong className="font-semibold">
              Pending Confirmation (待确认 · 直推 U vs 对碰 U 提现规则):
            </strong>{" "}
            Wallet balance withdrawals are submitted and paid out in <strong>U / USDT</strong> with the configured{" "}
            <strong>20% fee</strong> over TRON (TRC20). Standalone withdrawal eligibility &amp; separate fee rules for{" "}
            <strong>Direct U</strong> vs <strong>Pairing U</strong> remain pending final business confirmation.
          </>
        )}
      </div>

      <div className="space-y-4">
        {withdrawals.map((w) => {
          const isOpen =
            w.status === "PENDING_APPROVAL" ||
            w.status === "APPROVED" ||
            w.status === "CHAIN_CONFIRMING" ||
            w.status === "PAYOUT_PENDING_CHECK";
          const lockedForThis = isOpen ? w.requestedPointsCents : 0;
          const claimedByOther =
            Boolean(w.claimedById) && w.claimedById !== currentAdminId;
          const hasTxRecorded = Boolean(w.payoutTxRef);

          return (
            <div
              key={w.id}
              className="rounded-2xl border border-white/[0.08] bg-[#141619] p-5"
            >
              <div className="flex flex-col justify-between gap-3 border-b border-white/[0.06] pb-3 sm:flex-row sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono-sgt text-sm font-bold text-[#D8C39A]">
                      {w.withdrawalNo}
                    </span>
                    <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[11px] text-zinc-200">
                      {isZh ? "状态: " : "Status: "}
                      {formatWithdrawalStatusLabel(w.status, locale)}
                    </span>
                    <span className="rounded bg-[#CBB487]/15 px-2 py-0.5 text-[11px] text-[#CBB487]">
                      {formatNetworkLabel(w.payoutNetwork)} · {isZh ? "汇率" : "Rate"} 1:
                      {formatRateMicros(w.usdRateMicros)}
                    </span>
                    {w.isOverdue && (
                      <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
                        <Clock className="h-3 w-3" /> {isZh ? "已超 SLA 期限" : "OVERDUE SLA"}
                      </span>
                    )}
                    {w.isNearDeadline && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                        <Clock className="h-3 w-3" /> {isZh ? "即将到期 (<12h)" : "DUE SOON (<12h)"}
                      </span>
                    )}
                    {w.claimedByLabel && (
                      <span className="inline-flex items-center gap-1 rounded bg-white/[0.08] px-2 py-0.5 text-[11px] text-zinc-200">
                        <UserCheck className="h-3 w-3 text-[#CBB487]" /> {w.claimedByLabel}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 text-xs text-zinc-300">
                    {w.memberName} ({w.memberCode}) · {isZh ? "会员当前总冻结: " : "Member Total Locked: "}
                    <span className="tabular-nums font-semibold text-white">
                      {formatU(w.memberLockedPointsCents)} U
                    </span>
                  </div>
                  <div className="mt-1 break-all font-mono-sgt text-xs text-[#F2F0EB]">
                    {isZh ? "收款地址: " : "Receiving Address: "}
                    {w.payoutDestination}
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="tabular-nums text-base font-bold text-[#CBB487]">
                    {isZh ? "实付净额: " : "Net Payout: "}
                    {formatUsdtMicros(w.payoutAmountUsdtMicros)}
                  </div>
                  <div className="tabular-nums text-zinc-300">
                    {isZh
                      ? `申请 ${formatU(w.requestedPointsCents)} U · 本单冻结 ${formatU(lockedForThis)} U · 手续费 (${w.feeRateBpsSnapshot / 100}%) ${formatU(w.feePointsCents)} U → ${formatU(w.netPointsCents)} U`
                      : `Req ${formatU(w.requestedPointsCents)} U · Locked ${formatU(lockedForThis)} U · Fee (${w.feeRateBpsSnapshot / 100}%) ${formatU(w.feePointsCents)} U → ${formatU(w.netPointsCents)} U`}
                  </div>
                  <div className="font-mono-sgt text-[11px] text-zinc-400">
                    {isZh ? "提交: " : "Submitted: "}
                    {w.createdAtLabel}
                  </div>
                  {w.processingDeadlineLabel && (
                    <div
                      className={`font-mono-sgt text-[11px] ${
                        w.isOverdue
                          ? "font-semibold text-rose-300"
                          : w.isNearDeadline
                            ? "font-semibold text-amber-200"
                            : "text-zinc-400"
                      }`}
                    >
                      {isZh ? "处理期限: " : "Deadline: "}
                      {w.processingDeadlineLabel}
                    </div>
                  )}
                </div>
              </div>

              {w.payoutCheckNote && (
                <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  <strong>{isZh ? "链上 / 对账备注: " : "Chain / Reconciliation Note: "}</strong>
                  {w.payoutCheckNote}
                </div>
              )}
              {w.rejectionReason && (
                <div className="mt-3 text-xs text-rose-300">
                  {isZh ? "驳回原因: " : "Rejected: "}
                  {w.rejectionReason}
                </div>
              )}
              {w.payoutTxRef && (
                <div className="mt-3 break-all font-mono-sgt text-xs text-emerald-300">
                  {isZh ? "出款 TxID: " : "Outbound TxID: "}
                  {w.payoutTxRef} ({isZh ? "确认数: " : "Confs: "}
                  {w.confirmationsObserved})
                </div>
              )}

              {isOpen && (
                <div className="mt-4 space-y-3">
                  {/* Handler Claim / Takeover + Approve Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {!w.claimedById ? (
                      <button
                        type="button"
                        disabled={busyId === w.id}
                        onClick={() => void act(w.id, "CLAIM")}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#CBB487]/50 bg-[#08090B] px-3.5 text-xs font-semibold text-[#CBB487] hover:bg-[#CBB487]/10 disabled:opacity-50"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        <span>{isZh ? "锁定接单处理" : "Claim Handler Lock"}</span>
                      </button>
                    ) : claimedByOther ? (
                      <button
                        type="button"
                        disabled={busyId === w.id}
                        onClick={() =>
                          void act(w.id, "TAKEOVER", {
                            takeoverNote: isZh ? "管理员强行接管结算" : "Manager takeover for settlement",
                          })
                        }
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>
                          {isZh ? `接管 ${w.claimedByLabel} 的工单` : `Takeover from ${w.claimedByLabel}`}
                        </span>
                      </button>
                    ) : null}

                    {w.status === "PENDING_APPROVAL" && (
                      <button
                        type="button"
                        disabled={busyId === w.id || claimedByOther}
                        onClick={() => void act(w.id, "APPROVE")}
                        className="min-h-[38px] rounded-xl bg-[#CBB487] px-4 text-xs font-semibold text-[#08090B] hover:bg-[#D8C39A] disabled:opacity-50"
                      >
                        {isZh ? "审核通过并待打款" : "Approve for Payout"}
                      </button>
                    )}

                    {(w.status === "APPROVED" ||
                      w.status === "CHAIN_CONFIRMING" ||
                      w.status === "PAYOUT_PENDING_CHECK") && (
                      <div className="flex flex-1 flex-wrap items-center gap-2">
                        <input
                          type="text"
                          placeholder={
                            isZh
                              ? "粘贴 64 位 TRON 出款交易哈希 TxID..."
                              : "Paste 64-char outbound TRON TxID..."
                          }
                          value={txRefInput[w.id] ?? w.payoutTxRef ?? ""}
                          onChange={(e) =>
                            setTxRefInput((prev) => ({ ...prev, [w.id]: e.target.value }))
                          }
                          className="font-mono-sgt min-h-[38px] flex-1 min-w-[220px] rounded-xl border border-white/10 bg-[#08090B] px-3 text-xs text-white placeholder-zinc-500"
                        />
                        <button
                          type="button"
                          disabled={busyId === w.id || claimedByOther}
                          onClick={() =>
                            void act(w.id, w.payoutTxRef ? "RETRY_TX" : "SUBMIT_TX", {
                              payoutTxRef: (txRefInput[w.id] ?? w.payoutTxRef ?? "").trim(),
                            })
                          }
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-emerald-500 px-4 text-xs font-semibold text-[#08090B] hover:bg-emerald-400 disabled:opacity-50"
                        >
                          {w.payoutTxRef ? (
                            <RefreshCw className="h-3.5 w-3.5" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          <span>
                            {w.payoutTxRef
                              ? isZh
                                ? "重新查链核验"
                                : "Retry Chain Verification"
                              : isZh
                                ? "提交出款 TxID 并校验"
                                : "Submit Outbound TxID & Verify"}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Reject Row (Blocked once outbound TxID recorded) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                    {hasTxRecorded ? (
                      <span className="text-[11px] text-amber-200">
                        {isZh
                          ? "已锁定驳回操作：该笔提现已登记链上出款 TxID，请先重新查链核实后再做人工处理。"
                          : "Rejection locked: outbound TxID already recorded. Re-check chain status before taking manual action."}
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          placeholder={isZh ? "输入驳回原因..." : "Rejection reason..."}
                          value={rejectReason[w.id] ?? ""}
                          onChange={(e) =>
                            setRejectReason((prev) => ({ ...prev, [w.id]: e.target.value }))
                          }
                          className="min-h-[36px] rounded-xl border border-white/10 bg-[#08090B] px-3 text-xs text-white placeholder-zinc-500"
                        />
                        <button
                          type="button"
                          disabled={busyId === w.id || claimedByOther}
                          onClick={() =>
                            void act(w.id, "REJECT", {
                              reason:
                                rejectReason[w.id] || (isZh ? "管理员审核驳回" : "Rejected by Admin"),
                            })
                          }
                          className="min-h-[36px] rounded-xl border border-rose-500/40 bg-rose-500/15 px-3.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/25 disabled:opacity-50"
                        >
                          {isZh ? "驳回并解冻余额" : "Reject & Release Lock"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
