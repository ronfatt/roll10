"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Scale } from "lucide-react";
import { formatBv, formatU } from "@/lib/money";

interface ReconcileRow {
  memberId: string;
  memberCode: string;
  displayName: string;
  availBalanceCents: number;
  availLedgerSumCents: number;
  lockedBalanceCents: number;
  lockedLedgerSumCents: number;
  leftBvBalance: number;
  leftBvLedgerSum: number;
  rightBvBalance: number;
  rightBvLedgerSum: number;
  isBalanced: boolean;
}

export function AdminReconcileClient({ rows }: { rows: ReconcileRow[] }) {
  const router = useRouter();
  const [memberId, setMemberId] = useState(rows[0]?.memberId ?? "");
  const [kind, setKind] = useState<"POINTS" | "BV">("POINTS");
  const [leg, setLeg] = useState<"LEFT" | "RIGHT">("LEFT");
  const [deltaValue, setDeltaValue] = useState("10");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const allBalanced = rows.every((r) => r.isBalanced);

  const submitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const num = Number(deltaValue);
    const payload =
      kind === "POINTS"
        ? { memberId, kind: "POINTS", deltaPoints: num, reason }
        : { memberId, kind: "BV", leg, deltaBv: Math.trunc(num), reason };

    const res = await fetch("/api/admin/reconcile/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok || !data.ok) {
      setMsg({ type: "err", text: data.error || "Adjustment failed" });
      return;
    }
    setReason("");
    setMsg({ type: "ok", text: "Adjustment ledger entry recorded and audited." });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Wallet & BV Reconciliation
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Verifies live balances against immutable ledger sums and records audited admin adjustments.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
            allBalanced
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-300"
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>{allBalanced ? "ALL LEDGERS BALANCED" : "VARIANCE DETECTED"}</span>
        </span>
      </div>

      {/* Reconciliation Table */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/[0.08] text-zinc-400">
              <tr>
                <th className="py-2 pr-3">Member</th>
                <th className="py-2 pr-3">Avail U (Bal / Sum)</th>
                <th className="py-2 pr-3">Locked U (Bal / Sum)</th>
                <th className="py-2 pr-3">Left BV (Bal / Sum)</th>
                <th className="py-2 pr-3">Right BV (Bal / Sum)</th>
                <th className="py-2 pr-3">Check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {rows.map((r) => (
                <tr key={r.memberId}>
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-white">{r.displayName}</div>
                    <div className="tabular-nums text-[11px] text-[#D8C39A]">{r.memberCode}</div>
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums text-zinc-200">
                    {formatU(r.availBalanceCents)} / {formatU(r.availLedgerSumCents)} U
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums text-zinc-300">
                    {formatU(r.lockedBalanceCents)} / {formatU(r.lockedLedgerSumCents)} U
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums text-zinc-200">
                    {formatBv(r.leftBvBalance)} / {formatBv(r.leftBvLedgerSum)}
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums text-zinc-200">
                    {formatBv(r.rightBvBalance)} / {formatBv(r.rightBvLedgerSum)}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        r.isBalanced
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-rose-500/15 text-rose-300"
                      }`}
                    >
                      {r.isBalanced ? "PASS" : "MISMATCH"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audited Manual Balance Adjustment */}
      <form
        onSubmit={submitAdjustment}
        className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#141619] p-5 sm:p-6"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Scale className="h-4 w-4 text-[#CBB487]" />
          <span>Manual Balance Adjustment (Audited Ledger Entry)</span>
        </div>

        {msg && (
          <div
            className={`rounded-xl border px-3.5 py-2.5 text-xs ${
              msg.type === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/30 bg-rose-500/10 text-rose-300"
            }`}
          >
            {msg.text}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Member</label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#08090B] px-3 py-2 text-xs text-white"
            >
              {rows.map((r) => (
                <option key={r.memberId} value={r.memberId}>
                  {r.memberCode} — {r.displayName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-400">Balance Type</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as "POINTS" | "BV")}
              className="w-full rounded-xl border border-white/10 bg-[#08090B] px-3 py-2 text-xs text-white"
            >
              <option value="POINTS">Withdrawable U</option>
              <option value="BV">Binary BV</option>
            </select>
          </div>

          {kind === "BV" && (
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Leg</label>
              <select
                value={leg}
                onChange={(e) => setLeg(e.target.value as "LEFT" | "RIGHT")}
                className="w-full rounded-xl border border-white/10 bg-[#08090B] px-3 py-2 text-xs text-white"
              >
                <option value="LEFT">LEFT</option>
                <option value="RIGHT">RIGHT</option>
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs text-zinc-400">
              Delta ({kind === "POINTS" ? "U" : "BV"}, negative to debit)
            </label>
            <input
              type="number"
              step={kind === "POINTS" ? "0.01" : "1"}
              required
              value={deltaValue}
              onChange={(e) => setDeltaValue(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#08090B] px-3 py-2 tabular-nums text-xs text-white"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-zinc-400">
            Mandatory Adjustment Reason (Recorded with Operator ID)
          </label>
          <input
            type="text"
            required
            minLength={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Reconciliation correction for test ticket #104"
            className="w-full rounded-xl border border-white/10 bg-[#08090B] px-3.5 py-2 text-xs text-white"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-[#CBB487] px-4 py-2 text-xs font-semibold text-[#08090B] hover:bg-[#D8C39A] disabled:opacity-50"
        >
          {busy ? "Recording..." : "Post Adjustment Ledger"}
        </button>
      </form>
    </div>
  );
}
