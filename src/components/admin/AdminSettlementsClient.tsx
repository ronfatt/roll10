"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Search } from "lucide-react";
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
  jobSummaries,
  settlements,
  currentSgtDate,
  laggingActiveCount,
}: {
  jobSummaries: EodJobSummary[];
  settlements: EodAdminRow[];
  currentSgtDate: string;
  laggingActiveCount: number;
}) {
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
      setMsg(data.error || "Settlement tick failed");
      return;
    }
    setMsg(
      `Settlement tick (${targetDate} SGT) complete: ${data.result.eodSettlementsCreated} EOD record(s), ${data.result.upgradesActivated} due upgrade(s) activated.`
    );
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            00:00 SGT Daily EOD Settlement Reports
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Daily job status by Singapore settlement date plus member-level carryover, flushed BV, headcount, rule version, and idempotent re-run controls.
          </p>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void runTickNow(currentSgtDate)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#CBB487] px-4 py-2 text-xs font-semibold text-[#08090B] hover:bg-[#D8C39A] disabled:opacity-50"
        >
          <Play className="h-3.5 w-3.5" />
          <span>{busy ? "Running..." : `Run EOD + Due Upgrades (${currentSgtDate} SGT)`}</span>
        </button>
      </div>

      {/* Daily Job Status Summary by SGT Date */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">
            Daily Settlement Task Status (Asia/Singapore)
          </h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
              laggingActiveCount === 0
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-amber-500/20 text-amber-300"
            }`}
          >
            {laggingActiveCount === 0
              ? `All active members caught up to ${currentSgtDate} SGT`
              : `${laggingActiveCount} active member(s) pending catch-up`}
          </span>
        </div>

        {jobSummaries.length === 0 ? (
          <p className="text-xs text-zinc-500">No daily EOD batches recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[0.08] text-zinc-400">
                <tr>
                  <th className="py-2 pr-3">Settlement Date (SGT)</th>
                  <th className="py-2 pr-3">Members Settled</th>
                  <th className="py-2 pr-3">Total Flushed BV</th>
                  <th className="py-2 pr-3">Trigger Sources</th>
                  <th className="py-2 pr-3">Task Status</th>
                  <th className="py-2 pr-3">Last Executed (SGT)</th>
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
                        {j.status}
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
            placeholder="Filter by Member Code, Name, or EOD No..."
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
            No EOD settlement records match the current filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[0.08] text-zinc-400">
                <tr>
                  <th className="py-2 pr-3">Date (SGT)</th>
                  <th className="py-2 pr-3">Member</th>
                  <th className="py-2 pr-3">Before (L / R)</th>
                  <th className="py-2 pr-3">Headcount (L / R)</th>
                  <th className="py-2 pr-3">Retained</th>
                  <th className="py-2 pr-3">Flushed BV</th>
                  <th className="py-2 pr-3">After (L / R)</th>
                  <th className="py-2 pr-3">Basis & Rule</th>
                  <th className="py-2 pr-3">Executed (SGT)</th>
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
                      {s.retainedSide}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-amber-300">
                      {formatBv(s.flushedBv)}
                      {s.flushedSide !== "NONE" ? ` (${s.flushedSide})` : ""}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-zinc-200">
                      {s.leftBvAfter} / {s.rightBvAfter}
                    </td>
                    <td className="py-2.5 pr-3 text-[11px] text-zinc-300">
                      {s.decisionBasis}
                      <div className="text-[10px] text-zinc-500">
                        v{s.ruleVersion} · {s.triggeredBy}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-zinc-400">
                      <div>{s.executedAtLabel}</div>
                      <div className="text-[10px] text-zinc-500">Biz: {s.businessAtLabel}</div>
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
