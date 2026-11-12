"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { formatU, formatUsdtMicros } from "@/lib/money";
import type { Locale } from "@/lib/i18n";
import {
  formatDepositVerifyStatus,
  formatEntryTypeLabel,
  formatLegLabel,
  formatOrderStatus,
  formatOrderType,
} from "@/lib/i18n-labels";
import { formatNetworkLabel } from "@/lib/usdt/address";

interface DepositEventRow {
  id: string;
  txId: string;
  eventIndex: number;
  fromAddress: string;
  toAddress: string;
  contractAddress: string;
  amountMicros: string;
  confirmations: number;
  chainSuccess: boolean;
  claimedOrderId: string | null;
  blockTimestampLabel: string | null;
}

interface AdminDepositOrderRow {
  id: string;
  orderNo: string;
  orderType: string;
  status: string;
  paymentStatus: string;
  depositVerifyStatus: string;
  depositFailureReason: string | null;
  attributionNote: string | null;
  targetPackageCode: string;
  bvAmount: number;
  commissionableBv: number;
  usdtNetwork: string;
  usdtContractAddress: string;
  usdtDepositAddress: string;
  expectedUsdtMicros: string;
  actualUsdtMicros: string | null;
  submittedTxId: string | null;
  proofNote: string | null;
  confirmationsObserved: number;
  matchedDepositEventId: string | null;
  chainConfirmedAtLabel: string | null;
  confirmedAtLabel: string | null;
  effectiveAtLabel: string | null;
  createdAtLabel: string;
  member: {
    id: string;
    memberCode: string;
    displayName: string;
    status: string;
    sponsorCode: string | null;
    sponsorName: string | null;
    placementParentCode: string | null;
    placementLeg: string | null;
  };
  events: DepositEventRow[];
  walletLedgers: {
    id: string;
    ledgerNo: string;
    entryType: string;
    memberCode: string;
    deltaAvailableCents: number;
    note: string | null;
  }[];
  pairingSettlements: {
    id: string;
    settlementNo: string;
    memberCode: string;
    pairsCount: number;
    pointsAwardedCents: number;
  }[];
}

interface ActiveMemberOption {
  id: string;
  memberCode: string;
  displayName: string;
}

const STATUS_TABS = [
  "ALL",
  "AWAITING_TX",
  "VERIFYING",
  "VERIFIED_MATCH",
  "MANUAL_REVIEW",
  "REJECTED",
  "CONFIRMED",
] as const;

export function AdminDepositsClient({
  locale = "en",
  initialQuery,
  initialStatus,
  minConfirmations,
  orders,
  activeMembers,
}: {
  locale?: Locale;
  initialQuery: string;
  initialStatus: string;
  minConfirmations: number;
  orders: AdminDepositOrderRow[];
  activeMembers: ActiveMemberOption[];
}) {
  const isZh = locale === "zh-CN";
  const router = useRouter();
  const [searchText, setSearchText] = useState(initialQuery);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [selectedEventMap, setSelectedEventMap] = useState<Record<string, string>>({});
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [txInputMap, setTxInputMap] = useState<Record<string, string>>({});
  const [placementParentMap, setPlacementParentMap] = useState<Record<string, string>>({});
  const [placementLegMap, setPlacementLegMap] = useState<Record<string, "LEFT" | "RIGHT">>({});

  const applyFilter = (q: string, status: string) => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (status && status !== "ALL") sp.set("status", status);
    const qs = sp.toString();
    router.push(qs ? `/admin/deposits?${qs}` : "/admin/deposits");
  };

  const handleRetryChain = async (order: AdminDepositOrderRow) => {
    setBusyId(order.id);
    setBanner(null);
    const txId = (txInputMap[order.id] ?? order.submittedTxId ?? "").trim();
    const res = await fetch(`/api/admin/orders/${order.id}/deposit-verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "RETRY_CHAIN", txId: txId || undefined }),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok || !data.ok) {
      setBanner({
        type: "err",
        text: data.error || (isZh ? "链上核验失败" : "Chain verification failed"),
      });
      return;
    }
    setBanner({
      type: "ok",
      text: `${order.orderNo}: ${data.result?.message || formatDepositVerifyStatus(data.result?.depositVerifyStatus, locale)}`,
    });
    router.refresh();
  };

  const handleConfirmAndSettle = async (order: AdminDepositOrderRow) => {
    setBusyId(order.id);
    setBanner(null);

    const pickedEventId =
      selectedEventMap[order.id] ||
      order.matchedDepositEventId ||
      (order.events.length === 1 ? order.events[0].id : undefined);

    const payload: Record<string, unknown> = {
      action: "CONFIRM_AND_SETTLE",
      eventId: pickedEventId,
      attributionNote: noteMap[order.id] || undefined,
    };

    if (order.orderType === "INITIAL") {
      const parentId = placementParentMap[order.id];
      const leg = placementLegMap[order.id] ?? "LEFT";
      if (parentId) {
        payload.placementParentId = parentId;
      }
      payload.placementLeg = leg;
    }

    const res = await fetch(`/api/admin/orders/${order.id}/deposit-verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok || !data.ok) {
      setBanner({ type: "err", text: data.error || (isZh ? "确认结算失败" : "Confirmation failed") });
      return;
    }
    setBanner({
      type: "ok",
      text: isZh
        ? `订单 ${order.orderNo} 已归属确认并完成激活与结算。`
        : `Order ${order.orderNo} attributed, confirmed, and settled.`,
    });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          {isZh ? "USDT 入金与链上核验" : "USDT Deposits & Chain Verification"}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {isZh
            ? "核查 TxID 转账事件，解决多事件或同额待匹配冲突，确认归属后一键幂等激活配套与双轨安置。"
            : "Inspect TxID transfer events, resolve multi-event or same-amount collisions, verify attribution, and trigger idempotent activation + binary placement."}
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#141619] p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyFilter(searchText, initialStatus);
          }}
          className="flex flex-wrap gap-2"
        >
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={
                isZh
                  ? "搜索订单号、会员编号或交易哈希 TxID..."
                  : "Search orderNo, member code, or TxID..."
              }
              className="min-h-[40px] w-full rounded-xl border border-white/10 bg-[#08090B] pl-9 pr-3 text-xs text-white placeholder-zinc-500"
            />
          </div>
          <button
            type="submit"
            className="min-h-[40px] rounded-xl bg-[#CBB487] px-4 text-xs font-semibold text-[#08090B] hover:bg-[#D8C39A]"
          >
            {isZh ? "搜索" : "Search"}
          </button>
        </form>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => applyFilter(searchText, tab)}
              className={`min-h-[32px] rounded-full px-3 text-[11px] font-medium transition-colors ${
                initialStatus === tab
                  ? "bg-[#CBB487] text-[#08090B] font-semibold"
                  : "border border-white/10 bg-[#08090B] text-zinc-300 hover:border-[#CBB487]/50"
              }`}
            >
              {tab === "ALL"
                ? isZh
                  ? "全部"
                  : "ALL"
                : tab === "CONFIRMED"
                  ? formatOrderStatus("CONFIRMED", locale)
                  : formatDepositVerifyStatus(tab, locale)}
            </button>
          ))}
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

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-10 text-center text-sm text-zinc-400">
          {isZh ? "没有符合当前条件的 USDT 入金订单。" : "No USDT deposit orders match the current filter."}
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isConfirmed = order.status === "CONFIRMED";
            const defaultEventId =
              selectedEventMap[order.id] ??
              order.matchedDepositEventId ??
              (order.events.length === 1 ? order.events[0].id : "");

            return (
              <div
                key={order.id}
                className="rounded-2xl border border-white/[0.08] bg-[#141619] p-5 space-y-4"
              >
                {/* Header */}
                <div className="flex flex-col justify-between gap-2 border-b border-white/[0.06] pb-3 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono-sgt text-sm font-bold text-[#D8C39A]">
                        {order.orderNo}
                      </span>
                      <span className="rounded bg-white/[0.08] px-2 py-0.5 text-[11px] font-medium text-white">
                        {formatOrderType(order.orderType, locale)} · {order.targetPackageCode}
                      </span>
                      <span className="rounded bg-[#CBB487]/15 px-2 py-0.5 text-[11px] font-medium text-[#CBB487]">
                        {formatNetworkLabel(order.usdtNetwork)}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                          isConfirmed
                            ? "bg-emerald-500/15 text-emerald-300"
                            : order.depositVerifyStatus === "VERIFIED_MATCH"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : order.depositVerifyStatus === "REJECTED"
                                ? "bg-rose-500/15 text-rose-300"
                                : "bg-amber-500/15 text-amber-200"
                        }`}
                      >
                        {isZh ? "订单: " : "Order: "}
                        {formatOrderStatus(order.status, locale)} ·{" "}
                        {isZh ? "核验: " : "Verify: "}
                        {formatDepositVerifyStatus(order.depositVerifyStatus, locale)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-300">
                      {isZh ? "会员: " : "Member: "}
                      <strong>{order.member.displayName}</strong> ({order.member.memberCode}) ·{" "}
                      {isZh ? "推荐人: " : "Sponsor: "}
                      {order.member.sponsorCode
                        ? `${order.member.sponsorName} (${order.member.sponsorCode})`
                        : isZh
                          ? "顶点"
                          : "Root"}
                    </div>
                  </div>

                  <div className="text-right text-xs">
                    <div className="tabular-nums text-sm font-bold text-[#CBB487]">
                      {isZh ? "应付: " : "Expected "}
                      {formatUsdtMicros(order.expectedUsdtMicros)}
                    </div>
                    <div className="tabular-nums text-zinc-400">
                      {isZh ? "实收: " : "Actual: "}
                      {order.actualUsdtMicros
                        ? formatUsdtMicros(order.actualUsdtMicros)
                        : "—"}
                      {" · "}
                      {isZh ? "确认: " : "Confs: "}
                      {order.confirmationsObserved}/{minConfirmations}
                    </div>
                    <div className="font-mono-sgt text-[11px] text-zinc-400">
                      {isZh ? "创建: " : "Created: "}
                      {order.createdAtLabel}
                    </div>
                  </div>
                </div>

                {/* Snapshot & Proof */}
                <div className="grid gap-2 rounded-xl border border-white/[0.06] bg-[#08090B] p-3 text-xs sm:grid-cols-2">
                  <div>
                    <div className="text-zinc-400">
                      {isZh ? "订单绑定收款地址快照" : "Company Deposit Address Snapshot"}
                    </div>
                    <div className="break-all font-mono-sgt text-zinc-200">
                      {order.usdtDepositAddress}
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-400">
                      {isZh ? "会员提交 TxID 与转账备注" : "Submitted TxID & Proof Note"}
                    </div>
                    <div className="break-all font-mono-sgt text-zinc-200">
                      {order.submittedTxId ?? "—"}
                    </div>
                    {order.proofNote && (
                      <div className="mt-0.5 text-zinc-400">
                        {isZh ? "备注: " : "Note: "}
                        {order.proofNote}
                      </div>
                    )}
                  </div>
                </div>

                {order.depositFailureReason && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                    {order.depositFailureReason}
                  </div>
                )}

                {/* Observed Events (supports picking an event when 1 TxID has multiple events) */}
                {order.events.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      {isZh
                        ? `链上转账解析事件 (${order.events.length})`
                        : `Chain Transfer Events (${order.events.length})`}
                    </div>
                    <div className="space-y-1.5">
                      {order.events.map((ev) => {
                        const claimedElsewhere =
                          Boolean(ev.claimedOrderId) && ev.claimedOrderId !== order.id;
                        return (
                          <label
                            key={ev.id}
                            className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs ${
                              defaultEventId === ev.id
                                ? "border-[#CBB487] bg-[#CBB487]/10"
                                : "border-white/[0.07] bg-[#08090B]"
                            } ${claimedElsewhere ? "opacity-55" : ""}`}
                          >
                            {!isConfirmed && (
                              <input
                                type="radio"
                                name={`ev-${order.id}`}
                                disabled={claimedElsewhere}
                                checked={defaultEventId === ev.id}
                                onChange={() =>
                                  setSelectedEventMap((prev) => ({
                                    ...prev,
                                    [order.id]: ev.id,
                                  }))
                                }
                                className="mt-0.5 accent-[#CBB487]"
                              />
                            )}
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-mono-sgt font-semibold text-[#CBB487]">
                                  {isZh ? `事件 #${ev.eventIndex}` : `Event #${ev.eventIndex}`} ·{" "}
                                  {formatUsdtMicros(ev.amountMicros)}
                                </span>
                                <span className="tabular-nums text-[11px] text-zinc-300">
                                  {isZh
                                    ? `${ev.confirmations} 次确认 · ${ev.chainSuccess ? "成功" : "失败"}${claimedElsewhere ? " · 已被其他订单认领" : ""}`
                                    : `${ev.confirmations} confs · ${ev.chainSuccess ? "SUCCESS" : "FAILED"}${claimedElsewhere ? " · CLAIMED BY ANOTHER ORDER" : ""}`}
                                </span>
                              </div>
                              <div className="break-all font-mono-sgt text-[11px] text-zinc-400">
                                {ev.fromAddress} → {ev.toAddress}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pending Admin Actions */}
                {!isConfirmed && (
                  <div className="space-y-3 border-t border-white/[0.06] pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        placeholder={
                          isZh
                            ? "选填：覆写或粘贴 TxID 重新查链..."
                            : "Optional: override/paste TxID to inspect..."
                        }
                        value={txInputMap[order.id] ?? ""}
                        onChange={(e) =>
                          setTxInputMap((prev) => ({ ...prev, [order.id]: e.target.value }))
                        }
                        className="font-mono-sgt min-h-[38px] flex-1 min-w-[200px] rounded-xl border border-white/10 bg-[#08090B] px-3 text-xs text-white placeholder-zinc-500"
                      />
                      <button
                        type="button"
                        disabled={busyId === order.id}
                        onClick={() => void handleRetryChain(order)}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-white/15 bg-[#08090B] px-3.5 text-xs font-medium text-[#CBB487] hover:border-[#CBB487] disabled:opacity-50"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>{isZh ? "重新查询链上状态" : "Retry Chain Query"}</span>
                      </button>
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-3">
                      <input
                        type="text"
                        placeholder={
                          isZh
                            ? "归属复核备注（选填）..."
                            : "Attribution review note (optional)..."
                        }
                        value={noteMap[order.id] ?? ""}
                        onChange={(e) =>
                          setNoteMap((prev) => ({ ...prev, [order.id]: e.target.value }))
                        }
                        className="min-h-[38px] rounded-xl border border-white/10 bg-[#08090B] px-3 text-xs text-white placeholder-zinc-500"
                      />
                      {order.orderType === "INITIAL" && (
                        <>
                          <select
                            value={placementParentMap[order.id] ?? ""}
                            onChange={(e) =>
                              setPlacementParentMap((prev) => ({
                                ...prev,
                                [order.id]: e.target.value,
                              }))
                            }
                            className="min-h-[38px] rounded-xl border border-white/10 bg-[#08090B] px-3 text-xs text-white"
                          >
                            <option value="">
                              {isZh
                                ? `安置上级：按推荐人自动顺位查找 (${order.member.sponsorCode ?? "顶点"})`
                                : `Placement Parent: Auto-BFS under Sponsor (${order.member.sponsorCode ?? "ROOT"})`}
                            </option>
                            {activeMembers.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.memberCode} · {m.displayName}
                              </option>
                            ))}
                          </select>
                          <select
                            value={placementLegMap[order.id] ?? "LEFT"}
                            onChange={(e) =>
                              setPlacementLegMap((prev) => ({
                                ...prev,
                                [order.id]: e.target.value as "LEFT" | "RIGHT",
                              }))
                            }
                            className="min-h-[38px] rounded-xl border border-white/10 bg-[#08090B] px-3 text-xs text-white"
                          >
                            <option value="LEFT">
                              {isZh ? "安置区间：左区 (LEFT)" : "Placement Leg: LEFT"}
                            </option>
                            <option value="RIGHT">
                              {isZh ? "安置区间：右区 (RIGHT)" : "Placement Leg: RIGHT"}
                            </option>
                          </select>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => void handleConfirmAndSettle(order)}
                      className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#CBB487] px-5 text-xs font-semibold text-[#08090B] hover:bg-[#D8C39A] disabled:opacity-50"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>
                        {busyId === order.id
                          ? isZh
                            ? "正在入账结算..."
                            : "Settling..."
                          : isZh
                            ? "确认收款归属、激活并结算"
                            : "Confirm Attribution, Activate & Settle"}
                      </span>
                    </button>
                  </div>
                )}

                {/* Linked Settlement Trace */}
                {isConfirmed && (
                  <div className="space-y-2 border-t border-white/[0.06] pt-3 text-xs">
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-zinc-300">
                      <span>
                        {isZh ? "链上确认: " : "Chain Confirmed: "}
                        <strong className="font-mono-sgt text-white">
                          {order.chainConfirmedAtLabel ?? "—"}
                        </strong>
                      </span>
                      <span>
                        {isZh ? "服务端确认 (D): " : "Server Confirmed (D): "}
                        <strong className="font-mono-sgt text-[#CBB487]">
                          {order.confirmedAtLabel ?? "—"}
                        </strong>
                      </span>
                      <span>
                        {isZh ? "生效时间: " : "Effective: "}
                        <strong className="font-mono-sgt text-white">
                          {order.effectiveAtLabel ?? (isZh ? "立即生效" : "Immediate")}
                        </strong>
                      </span>
                      {order.member.placementParentCode && (
                        <span>
                          {isZh ? "已安置: " : "Placed: "}
                          <strong className="text-white">
                            {order.member.placementParentCode} →{" "}
                            {formatLegLabel(order.member.placementLeg, locale)}
                          </strong>
                        </span>
                      )}
                    </div>

                    {(order.walletLedgers.length > 0 || order.pairingSettlements.length > 0) && (
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3 space-y-1">
                        <div className="font-semibold text-emerald-300">
                          {isZh
                            ? `关联佣金与对碰结算追踪 (${order.bvAmount} BV)`
                            : `Linked Commission & Binary Pairing Trace (${order.bvAmount} BV)`}
                        </div>
                        {order.walletLedgers.map((l) => (
                          <div key={l.id} className="text-[11px] text-zinc-300">
                            <span className="font-mono-sgt text-[#CBB487]">{l.ledgerNo}</span> ·{" "}
                            {formatEntryTypeLabel(l.entryType, locale)} → {l.memberCode}: +
                            {formatU(l.deltaAvailableCents)} U
                          </div>
                        ))}
                        {order.pairingSettlements.map((p) => (
                          <div key={p.id} className="text-[11px] text-zinc-300">
                            <span className="font-mono-sgt text-[#CBB487]">{p.settlementNo}</span> ·{" "}
                            {p.memberCode}:{" "}
                            {isZh ? `${p.pairsCount} 组对碰` : `${p.pairsCount} pair(s)`} → +
                            {formatU(p.pointsAwardedCents)} U
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
