"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Compass,
  GitBranch,
  Search,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import {
  formatEffectiveStatus,
  formatLegLabel,
  formatOrderStatus,
  formatOrderType,
} from "@/lib/i18n-labels";
import { formatBv, formatU } from "@/lib/money";

interface OrderRow {
  id: string;
  orderNo: string;
  orderType: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  sponsorCode: string | null;
  targetPackageCode: string;
  previousPackageCode: string | null;
  amountUsdCents: number;
  bvAmount: number;
  paymentStatus: string;
  status: string;
  upgradeStatus: string;
  failureReason: string | null;
  requestedPlacementParentId: string | null;
  requestedPlacementLeg: "LEFT" | "RIGHT" | null;
  confirmedAtLabel: string | null;
  effectiveAtLabel: string | null;
  ruleVersion: number;
  createdAtLabel: string;
  createdSgtDate: string;
}

interface ActiveParentOption {
  id: string;
  memberCode: string;
  displayName: string;
  leftOccupied: boolean;
  rightOccupied: boolean;
}

export function AdminOrdersClient({
  locale = "en",
  orders,
  activeParents,
}: {
  locale?: Locale;
  orders: OrderRow[];
  activeParents: ActiveParentOption[];
}) {
  const isZh = locale === "zh-CN";
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [selectedParent, setSelectedParent] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const o of orders) {
      if (o.requestedPlacementParentId) map[o.id] = o.requestedPlacementParentId;
    }
    return map;
  });
  const [selectedLeg, setSelectedLeg] = useState<Record<string, "LEFT" | "RIGHT">>(() => {
    const map: Record<string, "LEFT" | "RIGHT"> = {};
    for (const o of orders) {
      map[o.id] = o.requestedPlacementLeg ?? "LEFT";
    }
    return map;
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
    if (dateFilter && o.createdSgtDate !== dateFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      o.orderNo.toLowerCase().includes(q) ||
      o.memberCode.toLowerCase().includes(q) ||
      o.memberName.toLowerCase().includes(q)
    );
  });

  const findOpenSlot = async (
    orderId: string,
    strategy: "BFS" | "EXTREME_LEFT" | "EXTREME_RIGHT"
  ) => {
    setBanner(null);
    const res = await fetch(`/api/admin/orders/${orderId}/open-slot?strategy=${strategy}`);
    const data = await res.json();
    if (!res.ok || !data.ok || !data.slot) {
      setBanner({
        type: "err",
        text: data.error || (isZh ? "未找到可用安置空位" : "No open placement slot found"),
      });
      return;
    }
    setSelectedParent((prev) => ({ ...prev, [orderId]: data.slot.parentId }));
    setSelectedLeg((prev) => ({ ...prev, [orderId]: data.slot.leg }));
    setBanner({
      type: "ok",
      text: isZh
        ? `推荐空位 (${strategy}): ${data.slot.parentCode} (${data.slot.parentName}) [${formatLegLabel(data.slot.leg, locale)}]`
        : `Suggested open slot (${strategy}): ${data.slot.parentCode} (${data.slot.parentName}) [${data.slot.leg}]`,
    });
  };

  const assignPlacement = async (orderId: string) => {
    const parentId = selectedParent[orderId];
    const leg = selectedLeg[orderId] ?? "LEFT";
    if (!parentId) {
      setBanner({
        type: "err",
        text: isZh ? "请先选择安置上级会员" : "Select a placement parent first",
      });
      return;
    }
    setBusyId(orderId);
    setBanner(null);
    const res = await fetch(`/api/admin/orders/${orderId}/placement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placementParentId: parentId, placementLeg: leg }),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok || !data.ok) {
      setBanner({
        type: "err",
        text: data.error || (isZh ? "保存安置位置失败" : "Failed to assign placement"),
      });
      return;
    }
    setBanner({
      type: "ok",
      text: isZh ? "订单安置位置已保存。" : "Placement assigned to order.",
    });
    router.refresh();
  };

  const confirmOrder = async (order: OrderRow, markPaidDemo: boolean) => {
    setBusyId(order.id);
    setBanner(null);
    const payload =
      order.orderType === "INITIAL"
        ? {
            placementParentId: selectedParent[order.id] || order.requestedPlacementParentId || null,
            placementLeg: selectedLeg[order.id] || order.requestedPlacementLeg || "LEFT",
            markPaidDemo,
          }
        : { markPaidDemo };

    const res = await fetch(`/api/admin/orders/${order.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok || !data.ok) {
      setBanner({
        type: "err",
        text: data.error || (isZh ? "订单确认失败" : "Order confirmation failed"),
      });
      router.refresh();
      return;
    }
    setBanner({
      type: "ok",
      text: isZh
        ? `已确认 ${order.orderNo}！生效日期 ${data.result?.effectiveSgtDate ?? ""} SGT。`
        : `Confirmed ${order.orderNo}! Effective ${data.result?.effectiveSgtDate ?? ""} SGT.`,
    });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          {isZh ? "订单审核、双轨安置与账本追查" : "Orders, Placement & Ledger Trace"}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {isZh
            ? "在订单确认前分配左/右区安置空位，按单追溯 BV、钱包与日结影响，并核查适用规则版本。"
            : "Assign open binary placement slots prior to confirmation, trace BV/wallet/EOD impact by order, and inspect rule versions."}
        </p>
      </div>

      {/* Placement & Upgrade Rules Reference */}
      <div className="rounded-2xl border border-[#CBB487]/25 bg-[#141619] p-4 text-xs text-zinc-300">
        <div className="flex items-center gap-2 font-semibold text-[#D8C39A]">
          <GitBranch className="h-4 w-4" />
          <span>
            {isZh
              ? "双轨安置与 D+2 00:01:00 SGT 升级生效规则"
              : "Binary Placement & D+2 00:01:00 SGT Upgrade Rules"}
          </span>
        </div>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-zinc-400">
          <li>
            {isZh
              ? "每个已激活节点下最多仅允许 1 位左区直属节点和 1 位右区直属节点（由数据库唯一约束强制校验）。"
              : "Each active node has at most one direct LEFT and one direct RIGHT child (enforced by DB unique constraint)."}
          </li>
          <li>
            {isZh
              ? "直推人获得 25% 直推奖励（不受每日对碰封顶限制）；安置上级路径沿线各节点在对应区获得订单 BV。"
              : "Direct Sponsor receives 25% direct commission (independent of binary cap); Placement ancestors receive order BV on their corresponding leg."}
          </li>
          <li>
            {isZh
              ? "已确认的升级订单进入等待生效状态，并于付款日 D+2 00:01:00 SGT 自动生效（在 D+2 00:00:00 SGT 日结之后执行）。"
              : "Confirmed upgrades enter Waiting Effective status and activate on D+2 at 00:01:00 SGT (after D+2 00:00:00 SGT EOD carryover)."}
          </li>
        </ul>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isZh
                ? "按订单号、会员编号或昵称筛选..."
                : "Filter by Order No, Member Code, or Name..."
            }
            className="w-full rounded-xl border border-white/10 bg-[#141619] py-2 pl-9 pr-3 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#CBB487]/60"
          />
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-[#141619] px-3 py-2 text-xs text-white outline-none focus:border-[#CBB487]/60"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-[#141619] px-3 py-2 text-xs text-white outline-none focus:border-[#CBB487]/60"
        >
          <option value="ALL">{isZh ? "全部状态" : "All Statuses"}</option>
          <option value="PENDING_CONFIRMATION">
            {formatOrderStatus("PENDING_CONFIRMATION", locale)}
          </option>
          <option value="CONFIRMED">{formatOrderStatus("CONFIRMED", locale)}</option>
          <option value="FAILED">{formatOrderStatus("FAILED", locale)}</option>
        </select>
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
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      <div className="space-y-4">
        {filteredOrders.map((order) => {
          const isPending = order.status === "PENDING_CONFIRMATION" || order.status === "FAILED";
          const currentParentId = selectedParent[order.id] ?? "";
          const currentLeg = selectedLeg[order.id] ?? "LEFT";

          return (
            <div
              key={order.id}
              className="rounded-2xl border border-white/[0.08] bg-[#141619] p-5"
            >
              <div className="flex flex-col justify-between gap-3 border-b border-white/[0.06] pb-3 sm:flex-row sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tabular-nums text-sm font-bold text-[#D8C39A]">
                      {order.orderNo}
                    </span>
                    <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-zinc-200">
                      {formatOrderType(order.orderType, locale)}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        order.status === "CONFIRMED"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : order.status === "FAILED"
                            ? "bg-rose-500/15 text-rose-300"
                            : "bg-amber-500/15 text-amber-300"
                      }`}
                    >
                      {formatOrderStatus(order.status, locale)}
                    </span>
                    {order.upgradeStatus !== "NOT_APPLICABLE" && (
                      <span className="rounded-full bg-[#CBB487]/15 px-2 py-0.5 text-[11px] font-medium text-[#D8C39A]">
                        {formatEffectiveStatus(order.upgradeStatus, locale)}
                      </span>
                    )}
                    <span className="rounded bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-300">
                      {formatOrderStatus(order.paymentStatus, locale)} · v{order.ruleVersion}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-300">
                    {isZh ? "会员: " : "Member: "}
                    <strong className="text-white">{order.memberName}</strong> ({order.memberCode})
                    {order.sponsorCode
                      ? isZh
                        ? ` · 推荐人: ${order.sponsorCode}`
                        : ` · Sponsor: ${order.sponsorCode}`
                      : isZh
                        ? " · 顶点"
                        : " · Root"}{" "}
                    · {order.previousPackageCode ? `${order.previousPackageCode} → ` : ""}
                    <span className="text-[#D8C39A]">{order.targetPackageCode}</span> (
                    {formatU(order.amountUsdCents)} U, {formatBv(order.bvAmount)})
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs">
                  <div className="tabular-nums text-zinc-400">
                    {isZh ? "创建: " : "Created: "}
                    {order.createdAtLabel}
                  </div>
                  {order.confirmedAtLabel && (
                    <div className="tabular-nums text-zinc-300">
                      {isZh ? "确认: " : "Confirmed: "}
                      {order.confirmedAtLabel}
                    </div>
                  )}
                  {order.effectiveAtLabel && (
                    <div className="tabular-nums text-emerald-400">
                      {isZh ? "生效: " : "Effective: "}
                      {order.effectiveAtLabel}
                    </div>
                  )}
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="inline-flex items-center gap-1 font-medium text-[#D8C39A] hover:underline"
                  >
                    <span>{isZh ? "全链路追查" : "Trace Ledgers"}</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {order.failureReason && (
                <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  <strong>{isZh ? "失败原因: " : "Failure Reason: "}</strong>
                  {order.failureReason}
                </div>
              )}

              {isPending && (
                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  {order.orderType === "INITIAL" ? (
                    <div className="flex flex-1 flex-wrap items-end gap-2">
                      <div className="min-w-[200px] flex-1">
                        <label className="mb-1 block text-[11px] text-zinc-400">
                          {isZh ? "安置上级会员" : "Placement Parent"}
                        </label>
                        <select
                          value={currentParentId}
                          onChange={(e) =>
                            setSelectedParent((prev) => ({
                              ...prev,
                              [order.id]: e.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-white/10 bg-[#08090B] px-3 py-2 text-xs text-white outline-none focus:border-[#CBB487]/60"
                        >
                          <option value="">
                            {isZh ? "-- 选择已激活安置上级 --" : "-- Select Active Parent --"}
                          </option>
                          {activeParents
                            .filter((p) => p.id !== order.memberId)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.memberCode} ({p.displayName}) [
                                {isZh
                                  ? `左:${p.leftOccupied ? "满" : "空"} / 右:${p.rightOccupied ? "满" : "空"}`
                                  : `L:${p.leftOccupied ? "Full" : "Open"} / R:${p.rightOccupied ? "Full" : "Open"}`}
                                ]
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] text-zinc-400">
                          {isZh ? "安置区间" : "Leg"}
                        </label>
                        <select
                          value={currentLeg}
                          onChange={(e) =>
                            setSelectedLeg((prev) => ({
                              ...prev,
                              [order.id]: e.target.value as "LEFT" | "RIGHT",
                            }))
                          }
                          className="rounded-xl border border-white/10 bg-[#08090B] px-3 py-2 text-xs text-white outline-none focus:border-[#CBB487]/60"
                        >
                          <option value="LEFT">{formatLegLabel("LEFT", locale)}</option>
                          <option value="RIGHT">{formatLegLabel("RIGHT", locale)}</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => void findOpenSlot(order.id, "BFS")}
                        className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 hover:border-[#CBB487]/40"
                      >
                        <Compass className="h-3.5 w-3.5 text-[#CBB487]" />
                        <span>{isZh ? "智能空位 (BFS)" : "Auto Slot (BFS)"}</span>
                      </button>

                      <button
                        type="button"
                        disabled={busyId === order.id}
                        onClick={() => void assignPlacement(order.id)}
                        className="rounded-xl border border-[#CBB487]/40 bg-[#CBB487]/10 px-3 py-2 text-xs font-medium text-[#D8C39A] hover:bg-[#CBB487]/20"
                      >
                        {isZh ? "保存安置位置" : "Save Placement"}
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-400">
                      {isZh
                        ? "升级订单 — 确认后将在现有安置节点上安排 D+2 00:01:00 SGT 自动生效。"
                        : "Upgrade order — schedules D+2 00:01:00 SGT activation on existing placement node."}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {order.paymentStatus === "UNPAID" && (
                      <button
                        type="button"
                        disabled={busyId === order.id}
                        onClick={() => void confirmOrder(order, true)}
                        className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                      >
                        {isZh ? "登记付款并确认" : "Record Payment & Confirm"}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => void confirmOrder(order, false)}
                      className="rounded-xl bg-[#CBB487] px-4 py-2 text-xs font-semibold text-[#08090B] hover:bg-[#D8C39A] disabled:opacity-50"
                    >
                      {busyId === order.id
                        ? isZh
                          ? "处理中..."
                          : "Processing..."
                        : isZh
                          ? "确认订单并结算"
                          : "Confirm & Settle Order"}
                    </button>
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
