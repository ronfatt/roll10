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
  orders,
  activeParents,
}: {
  orders: OrderRow[];
  activeParents: ActiveParentOption[];
}) {
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
      setBanner({ type: "err", text: data.error || "No open placement slot found" });
      return;
    }
    setSelectedParent((prev) => ({ ...prev, [orderId]: data.slot.parentId }));
    setSelectedLeg((prev) => ({ ...prev, [orderId]: data.slot.leg }));
    setBanner({
      type: "ok",
      text: `Suggested open slot (${strategy}): ${data.slot.parentCode} (${data.slot.parentName}) [${data.slot.leg}]`,
    });
  };

  const assignPlacement = async (orderId: string) => {
    const parentId = selectedParent[orderId];
    const leg = selectedLeg[orderId] ?? "LEFT";
    if (!parentId) {
      setBanner({ type: "err", text: "Select a placement parent first" });
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
      setBanner({ type: "err", text: data.error || "Failed to assign placement" });
      return;
    }
    setBanner({ type: "ok", text: `Placement assigned to order.` });
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
      setBanner({ type: "err", text: data.error || "Order confirmation failed" });
      router.refresh();
      return;
    }
    setBanner({
      type: "ok",
      text: `Confirmed ${order.orderNo}! Effective ${data.result?.effectiveSgtDate ?? ""} SGT.`,
    });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Orders, Placement & Ledger Trace
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Assign open binary placement slots prior to confirmation, trace BV/wallet/EOD impact by order, and inspect rule versions.
        </p>
      </div>

      {/* Placement & Upgrade Rules Reference */}
      <div className="rounded-2xl border border-[#CBB487]/25 bg-[#141619] p-4 text-xs text-zinc-300">
        <div className="flex items-center gap-2 font-semibold text-[#D8C39A]">
          <GitBranch className="h-4 w-4" />
          <span>Binary Placement & D+2 00:01:00 SGT Upgrade Rules</span>
        </div>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-zinc-400">
          <li>Each active node has at most one direct LEFT and one direct RIGHT child (enforced by DB unique constraint).</li>
          <li>Direct Sponsor receives 25% direct commission (independent of binary cap); Placement ancestors receive order BV on their corresponding leg.</li>
          <li>Confirmed upgrades enter Waiting Effective status and activate on D+2 at 00:01:00 SGT (after D+2 00:00:00 SGT EOD carryover).</li>
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
            placeholder="Filter by Order No, Member Code, or Name..."
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
          <option value="ALL">All Statuses</option>
          <option value="PENDING_CONFIRMATION">PENDING_CONFIRMATION</option>
          <option value="CONFIRMED">CONFIRMED</option>
          <option value="FAILED">FAILED</option>
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
                      {order.orderType}
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
                      {order.status}
                    </span>
                    {order.upgradeStatus !== "NOT_APPLICABLE" && (
                      <span className="rounded-full bg-[#CBB487]/15 px-2 py-0.5 text-[11px] font-medium text-[#D8C39A]">
                        {order.upgradeStatus}
                      </span>
                    )}
                    <span className="rounded bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-300">
                      {order.paymentStatus} · v{order.ruleVersion}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-300">
                    Member: <strong className="text-white">{order.memberName}</strong> ({order.memberCode})
                    {order.sponsorCode ? ` · Sponsor: ${order.sponsorCode}` : " · Root"} ·{" "}
                    {order.previousPackageCode ? `${order.previousPackageCode} → ` : ""}
                    <span className="text-[#D8C39A]">{order.targetPackageCode}</span> (
                    {formatU(order.amountUsdCents)} U, {formatBv(order.bvAmount)})
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs">
                  <div className="tabular-nums text-zinc-400">
                    Created: {order.createdAtLabel}
                  </div>
                  {order.confirmedAtLabel && (
                    <div className="tabular-nums text-zinc-300">
                      Confirmed: {order.confirmedAtLabel}
                    </div>
                  )}
                  {order.effectiveAtLabel && (
                    <div className="tabular-nums text-emerald-400">
                      Effective: {order.effectiveAtLabel}
                    </div>
                  )}
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="inline-flex items-center gap-1 font-medium text-[#D8C39A] hover:underline"
                  >
                    <span>Trace Ledgers</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {order.failureReason && (
                <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  <strong>Failure Reason:</strong> {order.failureReason}
                </div>
              )}

              {isPending && (
                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  {order.orderType === "INITIAL" ? (
                    <div className="flex flex-1 flex-wrap items-end gap-2">
                      <div className="min-w-[200px] flex-1">
                        <label className="mb-1 block text-[11px] text-zinc-400">
                          Placement Parent
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
                          <option value="">-- Select Active Parent --</option>
                          {activeParents
                            .filter((p) => p.id !== order.memberId)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.memberCode} ({p.displayName}) [L:{p.leftOccupied ? "Full" : "Open"} / R:{p.rightOccupied ? "Full" : "Open"}]
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] text-zinc-400">Leg</label>
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
                          <option value="LEFT">LEFT</option>
                          <option value="RIGHT">RIGHT</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => void findOpenSlot(order.id, "BFS")}
                        className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 hover:border-[#CBB487]/40"
                      >
                        <Compass className="h-3.5 w-3.5 text-[#CBB487]" />
                        <span>Auto Slot (BFS)</span>
                      </button>

                      <button
                        type="button"
                        disabled={busyId === order.id}
                        onClick={() => void assignPlacement(order.id)}
                        className="rounded-xl border border-[#CBB487]/40 bg-[#CBB487]/10 px-3 py-2 text-xs font-medium text-[#D8C39A] hover:bg-[#CBB487]/20"
                      >
                        Save Placement
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-400">
                      Upgrade order — schedules D+2 00:01:00 SGT activation on existing placement node.
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
                        Record Payment & Confirm
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => void confirmOrder(order, false)}
                      className="rounded-xl bg-[#CBB487] px-4 py-2 text-xs font-semibold text-[#08090B] hover:bg-[#D8C39A] disabled:opacity-50"
                    >
                      {busyId === order.id ? "Processing..." : "Confirm & Settle Order"}
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
