"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Search } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { formatDecisionBasisLabel, formatLegLabel } from "@/lib/i18n-labels";
import { formatBv } from "@/lib/money";

interface EodJobSummary {
  settlementDate: string;
  recordsCount: number;
  totalFlushedBv: number;
  triggeredBySummary: string;
  latestExecutedLabel: string;
  status: string;
}

interface EodAdminRow {
  id: string;
  settlementNo: string;
  settlementDate: string;
  memberCode: string;
  memberName: string;
  leftBvBefore: number;
  rightBvBefore: number;
  leftMemberCount: number;
  rightMemberCount: number;
  retainedSide: string;
  flushedSide: string;
  flushedBv: number;
  leftBvAfter: number;
  rightBvAfter: number;
  decisionBasis: string;
  triggeredBy: string;
  ruleVersion: number;
  businessAtLabel: string;
  executedAtLabel: string;
}

export function AdminSettlementsClient({
  locale = "en",
  jobSummaries,
  settlements,
  currentSgtDate,
  laggingActiveCount,
}: {
  locale?: Locale;
  jobSummaries: EodJobSummary[];
  settlements: EodAdminRow[];
  currentSgtDate: string;
  laggingActiveCount: number;
}) {
  const isZh = locale === "zh-CN";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [memberFilter, setMemberFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const filtered = settlements.filter((s) => {
    if (dateFilter && s.settlementDate !== dateFilter) return false;
    const q = memberFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      s.memberCode.toLowerCase().includes(q) ||
      s.memberName.toLowerCase().includes(q) ||
      s.settlementNo.toLowerCase().includes(q)
    );
  });

  const runTickNow = async (targetDate = currentSgtDate) => {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/eod", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetCurrentSgtDate: targetDate }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok || !data.ok) {
      setMsg(data.error || (isZh ? "日结执行失败" : "Settlement tick failed"));
      return;
    }
    setMsg(
      isZh
        ? `日结执行完成 (${targetDate} SGT)：生成 ${data.result.eodSettlementsCreated} 条日结记录，激活 ${data.result.upgradesActivated} 笔到期升级。`
        : `Settlement tick (${targetDate} SGT) complete: ${data.result.eodSettlementsCreated} EOD record(s), ${data.result.upgradesActivated} due upgrade(s) activated.`
    );
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {isZh ? "00:00 SGT 每日日结报表" : "00:00 SGT Daily EOD Settlement Reports"}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {isZh
              ? "按新加坡日历日期展示每日结转批次状态、会员保留与清零 BV、活跃人数、规则版本及幂等重跑控制。"
              : "Daily job status by Singapore settlement date plus member-level carryover, flushed BV, headcount, rule version, and idempotent re-run controls."}
          </p>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void runTickNow(currentSgtDate)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#CBB487] px-4 py-2 text-xs font-semibold text-[#08090B] hover:bg-[#D8C39A] disabled:opacity-50"
        >
          <Play className="h-3.5 w-3.5" />
          <span>
            {busy
              ? isZh
                ? "执行中..."
                : "Running..."
              : isZh
                ? `执行日结与到期升级 (${currentSgtDate} SGT)`
                : `Run EOD + Due Upgrades (${currentSgtDate} SGT)`}
          </span>
        </button>
      </div>

      {/* Daily Job Status Summary by SGT Date */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">
            {isZh
              ? "每日日结任务状态 (Asia/Singapore)"
              : "Daily Settlement Task Status (Asia/Singapore)"}
          </h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
              laggingActiveCount === 0
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-amber-500/20 text-amber-300"
            }`}
          >
            {laggingActiveCount === 0
              ? isZh
                ? `所有活跃会员已追平至 ${currentSgtDate} SGT`
                : `All active members caught up to ${currentSgtDate} SGT`
              : isZh
                ? `仍有 ${laggingActiveCount} 名活跃会员待追平日结`
                : `${laggingActiveCount} active member(s) pending catch-up`}
          </span>
        </div>

        {jobSummaries.length === 0 ? (
          <p className="text-xs text-zinc-500">
            {isZh ? "暂无每日日结批次记录。" : "No daily EOD batches recorded yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[0.08] text-zinc-400">
                <tr>
                  <th className="py-2 pr-3">{isZh ? "SGT 结算日" : "Settlement Date (SGT)"}</th>
                  <th className="py-2 pr-3">{isZh ? "已结算会员数" : "Members Settled"}</th>
                  <th className="py-2 pr-3">{isZh ? "总清零 BV" : "Total Flushed BV"}</th>
                  <th className="py-2 pr-3">{isZh ? "触发来源" : "Trigger Sources"}</th>
                  <th className="py-2 pr-3">{isZh ? "任务状态" : "Task Status"}</th>
                  <th className="py-2 pr-3">{isZh ? "最后执行 (SGT)" : "Last Executed (SGT)"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {jobSummaries.map((j) => (
                  <tr key={j.settlementDate}>
                    <td className="py-2 pr-3 tabular-nums font-semibold text-[#D8C39A]">
                      {j.settlementDate}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-white">{j.recordsCount}</td>
                    <td className="py-2 pr-3 tabular-nums text-amber-300">
                      {formatBv(j.totalFlushedBv)}
                    </td>
                    <td className="py-2 pr-3 text-zinc-300">{j.triggeredBySummary}</td>
                    <td className="py-2 pr-3">
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                        {isZh ? "已完成" : j.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-zinc-400">
                      {j.latestExecutedLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            placeholder={
              isZh
                ? "按会员编号、昵称或日结单号筛选..."
                : "Filter by Member Code, Name, or EOD No..."
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
      </div>

      {msg && (
        <div className="rounded-xl border border-[#CBB487]/30 bg-[#CBB487]/10 px-4 py-3 text-xs text-[#F5DF96]">
          {msg}
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-5">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-xs text-zinc-500">
            {isZh
              ? "没有符合当前筛选条件的日结记录。"
              : "No EOD settlement records match the current filters."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[0.08] text-zinc-400">
                <tr>
                  <th className="py-2 pr-3">{isZh ? "SGT 日期" : "Date (SGT)"}</th>
                  <th className="py-2 pr-3">{isZh ? "会员" : "Member"}</th>
                  <th className="py-2 pr-3">{isZh ? "日结前 (左 / 右)" : "Before (L / R)"}</th>
                  <th className="py-2 pr-3">{isZh ? "活跃人数 (左 / 右)" : "Headcount (L / R)"}</th>
                  <th className="py-2 pr-3">{isZh ? "保留区" : "Retained"}</th>
                  <th className="py-2 pr-3">{isZh ? "清零 BV" : "Flushed BV"}</th>
                  <th className="py-2 pr-3">{isZh ? "结转后 (左 / 右)" : "After (L / R)"}</th>
                  <th className="py-2 pr-3">{isZh ? "判定依据与规则" : "Basis & Rule"}</th>
                  <th className="py-2 pr-3">{isZh ? "执行时间 (SGT)" : "Executed (SGT)"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2.5 pr-3 tabular-nums font-semibold text-[#D8C39A]">
                      {s.settlementDate}
                      <div className="text-[10px] font-normal text-zinc-500">
                        {s.settlementNo}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-white">{s.memberName}</div>
                      <div className="tabular-nums text-[11px] text-zinc-400">
                        {s.memberCode}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-zinc-200">
                      {s.leftBvBefore} / {s.rightBvBefore}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-zinc-300">
                      {s.leftMemberCount} / {s.rightMemberCount}
                    </td>
                    <td className="py-2.5 pr-3 font-semibold text-emerald-300">
                      {formatLegLabel(s.retainedSide, locale)}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-amber-300">
                      {formatBv(s.flushedBv)}
                      {s.flushedSide !== "NONE"
                        ? ` (${formatLegLabel(s.flushedSide, locale)})`
                        : ""}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-zinc-200">
                      {s.leftBvAfter} / {s.rightBvAfter}
                    </td>
                    <td className="py-2.5 pr-3 text-[11px] text-zinc-300">
                      {formatDecisionBasisLabel(s.decisionBasis, locale)}
                      <div className="text-[10px] text-zinc-500">
                        v{s.ruleVersion} · {s.triggeredBy}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-zinc-400">
                      <div>{s.executedAtLabel}</div>
                      <div className="text-[10px] text-zinc-500">
                        {isZh ? "业务归属: " : "Biz: "}
                        {s.businessAtLabel}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
