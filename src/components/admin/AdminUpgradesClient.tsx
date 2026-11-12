"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { formatU } from "@/lib/money";

interface UpgradeRow {
  id: string;
  orderNo: string;
  memberCode: string;
  memberName: string;
  previousPackageCode: string | null;
  targetPackageCode: string;
  orderStatus: string;
  upgradeStatus: string;
  upgradeFailureReason: string | null;
  confirmedAtLabel: string | null;
  effectiveAtLabel: string | null;
  processedAtLabel: string | null;
  isDueNow: boolean;
  catchupPairs: number;
  catchupPointsCents: number;
}

export function AdminUpgradesClient({ upgrades }: { upgrades: UpgradeRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"ALL" | "WAITING_EFFECTIVE" | "EFFECTIVE" | "FAILED">("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const filtered = upgrades.filter((u) => {
    if (filter === "ALL") return true;
    return u.upgradeStatus === filter;
  });

  const retryUpgrade = async (orderId: string, orderNo: string) => {
    setBusyId(orderId);
    setBanner(null);
    const res = await fetch(`/api/admin/upgrades/${orderId}/retry`, {
      method: "POST",
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok || !data.ok) {
      setBanner({ type: "err", text: data.error || `Retry failed for ${orderNo}` });
      router.refresh();
      return;
    }
    setBanner({ type: "ok", text: `Retried upgrade ${orderNo} successfully.` });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Package Upgrades Management
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Track Waiting Effective, Effective, and Failed upgrades (D+2 00:01:00 SGT), catch-up pairing results, and retry failed upgrades using their original order number.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(["ALL", "WAITING_EFFECTIVE", "EFFECTIVE", "FAILED"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilter(st)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                filter === st
                  ? "bg-[#CBB487] text-[#08090B]"
                  : "border border-white/10 bg-[#141619] text-zinc-300"
              }`}
            >
              {st}
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
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-5">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-xs text-zinc-500">No upgrade orders found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[0.08] text-zinc-400">
                <tr>
                  <th className="py-2 pr-3">Order No</th>
                  <th className="py-2 pr-3">Member</th>
                  <th className="py-2 pr-3">Tier Change</th>
                  <th className="py-2 pr-3">Paid Confirmed (SGT)</th>
                  <th className="py-2 pr-3">Planned Effective (SGT)</th>
                  <th className="py-2 pr-3">Actual Processed (SGT)</th>
                  <th className="py-2 pr-3">Catch-Up Result</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2.5 pr-3 tabular-nums">
                      <Link
                        href={`/admin/orders/${u.id}`}
                        className="font-semibold text-[#D8C39A] hover:underline"
                      >
                        {u.orderNo}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-white">{u.memberName}</div>
                      <div className="tabular-nums text-[11px] text-zinc-400">{u.memberCode}</div>
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-zinc-200">
                      {u.previousPackageCode ?? "—"} →{" "}
                      <span className="text-[#D8C39A]">{u.targetPackageCode}</span>
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-zinc-300">
                      {u.confirmedAtLabel ?? "Unconfirmed"}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-zinc-200">
                      {u.effectiveAtLabel ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-zinc-400">
                      {u.processedAtLabel ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-emerald-300">
                      {u.catchupPairs > 0
                        ? `${u.catchupPairs} pairs (+${formatU(u.catchupPointsCents)} U)`
                        : "0 pairs"}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          u.upgradeStatus === "EFFECTIVE"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : u.upgradeStatus === "FAILED"
                              ? "bg-rose-500/15 text-rose-300"
                              : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {u.upgradeStatus}
                      </span>
                      {u.upgradeFailureReason && (
                        <div className="mt-1 text-[11px] text-rose-300">
                          {u.upgradeFailureReason}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      {(u.upgradeStatus === "FAILED" ||
                        (u.upgradeStatus === "WAITING_EFFECTIVE" && u.isDueNow)) && (
                        <button
                          type="button"
                          disabled={busyId === u.id}
                          onClick={() => void retryUpgrade(u.id, u.orderNo)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#CBB487]/40 bg-[#CBB487]/10 px-2.5 py-1 text-[11px] font-medium text-[#D8C39A] hover:bg-[#CBB487]/20 disabled:opacity-50"
                        >
                          <RefreshCw className="h-3 w-3" />
                          <span>Retry (Same No)</span>
                        </button>
                      )}
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
