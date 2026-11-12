"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import {
  formatBvEventType,
  formatEntryTypeLabel,
  formatLegLabel,
} from "@/lib/i18n-labels";
import { formatBv, formatU } from "@/lib/money";

interface AdminWalletRow {
  id: string;
  ledgerNo: string;
  memberCode: string;
  memberName: string;
  entryType: string;
  deltaAvailableCents: number;
  orderId: string | null;
  orderNo: string | null;
  settlementNo: string | null;
  withdrawalNo: string | null;
  note: string | null;
  sgtDate: string;
  createdAtLabel: string;
}

interface AdminBvRow {
  id: string;
  memberCode: string;
  memberName: string;
  leg: string;
  entryType: string;
  deltaBv: number;
  balanceAfterBv: number;
  settlementDate: string;
  orderId: string | null;
  orderNo: string | null;
  note: string | null;
  createdAtLabel: string;
}

export function AdminLedgersClient({
  locale = "en",
  walletRows,
  bvRows,
}: {
  locale?: Locale;
  walletRows: AdminWalletRow[];
  bvRows: AdminBvRow[];
}) {
  const isZh = locale === "zh-CN";
  const [tab, setTab] = useState<"wallet" | "bv">("wallet");
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const q = query.trim().toLowerCase();

  const filteredWallet = walletRows.filter((w) => {
    if (dateFilter && w.sgtDate !== dateFilter) return false;
    if (!q) return true;
    return (
      w.memberCode.toLowerCase().includes(q) ||
      w.memberName.toLowerCase().includes(q) ||
      (w.orderNo ?? "").toLowerCase().includes(q) ||
      (w.settlementNo ?? "").toLowerCase().includes(q) ||
      w.ledgerNo.toLowerCase().includes(q)
    );
  });

  const filteredBv = bvRows.filter((b) => {
    if (dateFilter && b.settlementDate !== dateFilter) return false;
    if (!q) return true;
    return (
      b.memberCode.toLowerCase().includes(q) ||
      b.memberName.toLowerCase().includes(q) ||
      (b.orderNo ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          {isZh ? "奖金与 BV 全平台流水" : "Bonus & BV Ledgers"}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {isZh
            ? "按会员、SGT 日期或订单编号筛选全平台直推佣金、对碰奖金入账及 BV 变动流水。"
            : "Filter platform-wide direct commissions, binary pairing payouts, and BV movements by member, SGT date, or order number."}
        </p>
      </div>

      {/* Filters & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("wallet")}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
              tab === "wallet"
                ? "bg-[#CBB487] text-[#08090B]"
                : "border border-white/10 bg-[#141619] text-zinc-300"
            }`}
          >
            {isZh
              ? `奖金 / 钱包流水 (${filteredWallet.length})`
              : `Bonus / Wallet Ledgers (${filteredWallet.length})`}
          </button>
          <button
            type="button"
            onClick={() => setTab("bv")}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
              tab === "bv"
                ? "bg-[#CBB487] text-[#08090B]"
                : "border border-white/10 bg-[#141619] text-zinc-300"
            }`}
          >
            {isZh ? `BV 变动流水 (${filteredBv.length})` : `BV Ledgers (${filteredBv.length})`}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isZh ? "会员编号、订单号..." : "Member Code, Order No..."}
              className="rounded-xl border border-white/10 bg-[#141619] py-2 pl-9 pr-3 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#CBB487]/60"
            />
          </div>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#141619] px-3 py-2 text-xs text-white outline-none focus:border-[#CBB487]/60"
          />
        </div>
      </div>

      {tab === "wallet" ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[0.08] text-zinc-400">
                <tr>
                  <th className="py-2 pr-3">{isZh ? "流水号" : "Ledger No"}</th>
                  <th className="py-2 pr-3">{isZh ? "会员" : "Member"}</th>
                  <th className="py-2 pr-3">{isZh ? "类型 / 说明" : "Source"}</th>
                  <th className="py-2 pr-3">{isZh ? "关联单号" : "Order / Ref"}</th>
                  <th className="py-2 pr-3">{isZh ? "U 变动" : "U Δ"}</th>
                  <th className="py-2 pr-3">{isZh ? "时间 (SGT)" : "Time (SGT)"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filteredWallet.map((w) => (
                  <tr key={w.id}>
                    <td className="py-2 pr-3 tabular-nums text-zinc-300">{w.ledgerNo}</td>
                    <td className="py-2 pr-3 text-white">
                      {w.memberCode} ({w.memberName})
                    </td>
                    <td className="py-2 pr-3 text-zinc-300">
                      <div>{formatEntryTypeLabel(w.entryType, locale)}</div>
                      {w.note && <div className="text-[11px] text-zinc-500">{w.note}</div>}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {w.orderId && w.orderNo ? (
                        <Link
                          href={`/admin/orders/${w.orderId}`}
                          className="text-[#D8C39A] hover:underline"
                        >
                          {w.orderNo}
                        </Link>
                      ) : (
                        <span className="text-zinc-400">
                          {w.settlementNo ?? w.withdrawalNo ?? "—"}
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-2 pr-3 tabular-nums font-semibold ${
                        w.deltaAvailableCents >= 0 ? "text-emerald-400" : "text-amber-300"
                      }`}
                    >
                      {w.deltaAvailableCents >= 0 ? "+" : ""}
                      {formatU(w.deltaAvailableCents)} U
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-zinc-400">{w.createdAtLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[0.08] text-zinc-400">
                <tr>
                  <th className="py-2 pr-3">{isZh ? "会员" : "Member"}</th>
                  <th className="py-2 pr-3">{isZh ? "区间" : "Leg"}</th>
                  <th className="py-2 pr-3">{isZh ? "类型" : "Type"}</th>
                  <th className="py-2 pr-3">{isZh ? "关联订单" : "Order Ref"}</th>
                  <th className="py-2 pr-3">{isZh ? "BV 变动" : "Delta BV"}</th>
                  <th className="py-2 pr-3">{isZh ? "变动后余额" : "Balance After"}</th>
                  <th className="py-2 pr-3">{isZh ? "时间 (SGT)" : "Time (SGT)"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filteredBv.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2 pr-3 text-white">
                      {b.memberCode} ({b.memberName})
                    </td>
                    <td className="py-2 pr-3 text-zinc-300">{formatLegLabel(b.leg, locale)}</td>
                    <td className="py-2 pr-3 text-zinc-300">
                      <div>{formatBvEventType(b.entryType, locale)}</div>
                      {b.note && <div className="text-[11px] text-zinc-500">{b.note}</div>}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {b.orderId && b.orderNo ? (
                        <Link
                          href={`/admin/orders/${b.orderId}`}
                          className="text-[#D8C39A] hover:underline"
                        >
                          {b.orderNo}
                        </Link>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                    <td
                      className={`py-2 pr-3 tabular-nums font-semibold ${
                        b.deltaBv >= 0 ? "text-emerald-400" : "text-amber-300"
                      }`}
                    >
                      {b.deltaBv >= 0 ? "+" : ""}
                      {formatBv(b.deltaBv)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-zinc-200">
                      {formatBv(b.balanceAfterBv)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-zinc-400">{b.createdAtLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
