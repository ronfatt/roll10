"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { formatBv, formatU } from "@/lib/money";
import { BottomDrawer } from "@/components/MotionPrimitives";

interface DirectItem {
  id: string;
  ledgerNo: string;
  amountCents: number;
  orderNo: string | null;
  note: string | null;
  createdAtLabel: string;
}

interface PairingItem {
  id: string;
  settlementNo: string;
  settlementDate: string;
  triggerType: string;
  pairsCount: number;
  bvDeductedPerLeg: number;
  pointsAwardedCents: number;
  dailyPairedAfterCents: number;
  dailyCapPointsCents: number;
  createdAtLabel: string;
}

interface BvItem {
  id: string;
  leg: string;
  entryType: string;
  deltaBv: number;
  balanceAfterBv: number;
  settlementDate: string;
  note: string | null;
  createdAtLabel: string;
  eodDetail: {
    settlementNo: string;
    settlementDate: string;
    leftBvBefore: number;
    rightBvBefore: number;
    leftMemberCount: number;
    rightMemberCount: number;
    retainedSide: string;
    flushedSide: string;
    flushedBv: number;
    decisionBasis: string;
    executedAtLabel: string;
  } | null;
}

interface EodItem {
  id: string;
  settlementNo: string;
  settlementDate: string;
  leftBvBefore: number;
  rightBvBefore: number;
  leftMemberCount: number;
  rightMemberCount: number;
  retainedSide: string;
  flushedBv: number;
  leftBvAfter: number;
  rightBvAfter: number;
  decisionBasis: string;
  executedAtLabel: string;
}

interface EodPreview {
  leftBv: number;
  rightBv: number;
  leftCount: number;
  rightCount: number;
  retainedSide: string;
  flushedBv: number;
  decisionBasis: string;
}

export function LedgersClient({
  t,
  initialTab = "direct",
  initialLeg = "ALL",
  directItems,
  pairingItems,
  bvItems,
  eodItems,
  eodPreview,
}: {
  t: Dictionary;
  initialTab?: "direct" | "pairing" | "bv";
  initialLeg?: "ALL" | "LEFT" | "RIGHT";
  directItems: DirectItem[];
  pairingItems: PairingItem[];
  bvItems: BvItem[];
  eodItems: EodItem[];
  eodPreview: EodPreview;
}) {
  const [tab, setTab] = useState<"direct" | "pairing" | "bv">(initialTab);
  const [legFilter, setLegFilter] = useState<"ALL" | "LEFT" | "RIGHT">(initialLeg);
  const [selectedEod, setSelectedEod] = useState<BvItem["eodDetail"]>(null);

  const visibleBvItems =
    legFilter === "ALL" ? bvItems : bvItems.filter((b) => b.leg === legFilter);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#F2F0EB]">
          {t.ledgers.title}
        </h1>
        <p className="mt-1 text-xs text-[#A7AEBC]">{t.ledgers.subtitle}</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "direct" as const, label: `${t.ledgers.tabDirect} (${directItems.length})` },
          { key: "pairing" as const, label: `${t.ledgers.tabPairing} (${pairingItems.length})` },
          { key: "bv" as const, label: `${t.ledgers.tabBv} (${bvItems.length})` },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`min-h-[40px] rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-150 ${
              tab === item.key
                ? "bg-[#CBB487] text-[#08090B]"
                : "border border-white/[0.1] bg-[#141619] text-[#A7AEBC] hover:border-[#CBB487]/50 hover:text-[#F2F0EB]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "direct" && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-4 sm:p-5">
          {directItems.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#A7AEBC]">{t.common.noData}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/[0.1] text-[#A7AEBC]">
                  <tr>
                    <th className="py-2 pr-3">Ledger No</th>
                    <th className="py-2 pr-3">Source Order</th>
                    <th className="py-2 pr-3">Detail</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Time (SGT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {directItems.map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono-sgt py-2.5 pr-3 text-[#D6D3CC]">
                        {row.ledgerNo}
                      </td>
                      <td className="font-mono-sgt py-2.5 pr-3 text-[#CBB487]">
                        {row.orderNo ?? "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-[#D6D3CC]">{row.note}</td>
                      <td className="py-2.5 pr-3 tabular-nums font-semibold text-emerald-400">
                        +{formatU(row.amountCents)} {t.common.points}
                      </td>
                      <td className="font-mono-sgt py-2.5 pr-3 text-[#A7AEBC]">
                        {row.createdAtLabel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "pairing" && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-4 sm:p-5">
          {pairingItems.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#A7AEBC]">{t.common.noData}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/[0.1] text-[#A7AEBC]">
                  <tr>
                    <th className="py-2 pr-3">Settlement No</th>
                    <th className="py-2 pr-3">SGT Date</th>
                    <th className="py-2 pr-3">Trigger</th>
                    <th className="py-2 pr-3">Pairs</th>
                    <th className="py-2 pr-3">BV Deducted</th>
                    <th className="py-2 pr-3">Awarded</th>
                    <th className="py-2 pr-3">Cap Progress</th>
                    <th className="py-2 pr-3">Time (SGT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {pairingItems.map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono-sgt py-2.5 pr-3 text-[#CBB487]">
                        {row.settlementNo}
                      </td>
                      <td className="font-mono-sgt py-2.5 pr-3 text-[#D6D3CC]">
                        {row.settlementDate}
                      </td>
                      <td className="py-2.5 pr-3 text-[#D6D3CC]">{row.triggerType}</td>
                      <td className="py-2.5 pr-3 tabular-nums font-semibold text-[#F2F0EB]">
                        {row.pairsCount}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-[#D6D3CC]">
                        L -{row.bvDeductedPerLeg} / R -{row.bvDeductedPerLeg}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums font-semibold text-emerald-400">
                        +{formatU(row.pointsAwardedCents)} {t.common.points}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-[#A7AEBC]">
                        {formatU(row.dailyPairedAfterCents)} /{" "}
                        {formatU(row.dailyCapPointsCents)} {t.common.points}
                      </td>
                      <td className="font-mono-sgt py-2.5 pr-3 text-[#A7AEBC]">
                        {row.createdAtLabel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "bv" && (
        <div className="space-y-5">
          {/* Estimated Midnight 00:00 SGT Carryover Preview */}
          <div className="rounded-2xl border border-[#CBB487]/30 bg-[#141619] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#F2F0EB]">
                Next <span className="font-mono-sgt">00:00 SGT</span> Carryover Preview
              </h2>
              <span className="rounded border border-white/[0.1] px-2 py-0.5 text-[10px] font-semibold text-[#CBB487]">
                {t.common.estimatedBadge}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-4">
              <div className="rounded-xl border border-white/[0.06] bg-[#08090B] p-3">
                <div className="text-[#A7AEBC]">Current L / R BV</div>
                <div className="mt-1 tabular-nums font-semibold text-[#F2F0EB]">
                  {eodPreview.leftBv} / {eodPreview.rightBv}
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-[#08090B] p-3">
                <div className="text-[#A7AEBC]">Active Count (L / R)</div>
                <div className="mt-1 tabular-nums font-semibold text-[#F2F0EB]">
                  {eodPreview.leftCount} / {eodPreview.rightCount}
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-[#08090B] p-3">
                <div className="text-[#A7AEBC]">Est. Retained Side</div>
                <div className="mt-1 font-semibold text-emerald-400">
                  {eodPreview.retainedSide}
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-[#08090B] p-3">
                <div className="text-[#A7AEBC]">Est. Flushed BV</div>
                <div className="mt-1 tabular-nums font-semibold text-[#CBB487]">
                  {formatBv(eodPreview.flushedBv)}
                </div>
              </div>
            </div>
            <p className="mt-2.5 text-[11px] text-[#A7AEBC]">
              Estimated ({eodPreview.decisionBasis}) from current balances. Actual{" "}
              <span className="font-mono-sgt">00:00 SGT</span> settlement is governed by EOD
              records below.
            </p>
          </div>

          {/* Midnight 00:00 SGT EOD Carryover Summary */}
          <div id="eod" className="rounded-2xl border border-white/[0.08] bg-[#141619] p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-semibold text-[#F2F0EB]">
              <span className="font-mono-sgt">00:00 SGT</span> Midnight Flush & Carryover History
            </h2>
            {eodItems.length === 0 ? (
              <p className="py-4 text-xs text-[#A7AEBC]">No midnight EOD settlements recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/[0.1] text-[#A7AEBC]">
                    <tr>
                      <th className="py-2 pr-3">SGT Date</th>
                      <th className="py-2 pr-3">Before (L / R)</th>
                      <th className="py-2 pr-3">Headcount (L / R)</th>
                      <th className="py-2 pr-3">Retained Side</th>
                      <th className="py-2 pr-3">Flushed BV</th>
                      <th className="py-2 pr-3">After (L / R)</th>
                      <th className="py-2 pr-3">Basis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {eodItems.map((e) => (
                      <tr key={e.id}>
                        <td className="font-mono-sgt py-2.5 pr-3 font-medium text-[#CBB487]">
                          {e.settlementDate}
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums text-[#F2F0EB]">
                          {e.leftBvBefore} / {e.rightBvBefore}
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums text-[#D6D3CC]">
                          {e.leftMemberCount} / {e.rightMemberCount}
                        </td>
                        <td className="py-2.5 pr-3 font-medium text-emerald-400">
                          {e.retainedSide}
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums text-[#CBB487]">
                          {formatBv(e.flushedBv)}
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums text-[#F2F0EB]">
                          {e.leftBvAfter} / {e.rightBvAfter}
                        </td>
                        <td className="py-2.5 pr-3 text-[11px] text-[#A7AEBC]">
                          {e.decisionBasis}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detailed BV Ledger */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#F2F0EB]">BV Ledger</h2>
                <span className="text-[11px] text-[#A7AEBC]">
                  Tap any <span className="font-mono-sgt">00:00 SGT</span> EOD row to inspect
                  carryover basis
                </span>
              </div>
              <div className="flex gap-1.5">
                {(["ALL", "LEFT", "RIGHT"] as const).map((lf) => (
                  <button
                    key={lf}
                    type="button"
                    onClick={() => setLegFilter(lf)}
                    className={`min-h-[36px] rounded-full px-3 text-[11px] font-semibold transition-colors ${
                      legFilter === lf
                        ? "bg-[#CBB487] text-[#08090B]"
                        : "border border-white/[0.1] bg-[#08090B] text-[#A7AEBC]"
                    }`}
                  >
                    {lf}
                  </button>
                ))}
              </div>
            </div>

            {bvItems.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#A7AEBC]">{t.common.noData}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/[0.1] text-[#A7AEBC]">
                    <tr>
                      <th className="py-2 pr-3">Leg</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Delta BV</th>
                      <th className="py-2 pr-3">Balance After</th>
                      <th className="py-2 pr-3">Note</th>
                      <th className="py-2 pr-3">Time (SGT)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {visibleBvItems.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => {
                          if (row.eodDetail) setSelectedEod(row.eodDetail);
                        }}
                        className={
                          row.eodDetail ? "cursor-pointer transition hover:bg-white/[0.03]" : ""
                        }
                      >
                        <td className="py-2.5 pr-3 font-medium text-[#F2F0EB]">
                          <span
                            className={
                              row.leg === "LEFT" ? "text-[#56C9DC]" : "text-[#A799F7]"
                            }
                          >
                            {row.leg}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-[#D6D3CC]">
                          {row.entryType}
                          {row.eodDetail && (
                            <span className="ml-1.5 rounded bg-[#CBB487]/15 px-1.5 py-0.5 text-[10px] text-[#CBB487]">
                              Details
                            </span>
                          )}
                        </td>
                        <td
                          className={`py-2.5 pr-3 tabular-nums font-semibold ${
                            row.deltaBv > 0
                              ? "text-emerald-400"
                              : row.deltaBv < 0
                                ? "text-[#CBB487]"
                                : "text-[#A7AEBC]"
                          }`}
                        >
                          {row.deltaBv > 0 ? "+" : ""}
                          {formatBv(row.deltaBv)}
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums text-[#F2F0EB]">
                          {formatBv(row.balanceAfterBv)}
                        </td>
                        <td className="py-2.5 pr-3 text-[#A7AEBC]">{row.note}</td>
                        <td className="font-mono-sgt py-2.5 pr-3 text-[#A7AEBC]">
                          {row.createdAtLabel}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EOD Carryover Detail BottomDrawer */}
      <BottomDrawer
        open={Boolean(selectedEod)}
        onClose={() => setSelectedEod(null)}
        title={
          selectedEod
            ? `EOD Carryover · ${selectedEod.settlementDate} SGT`
            : "EOD Carryover Detail"
        }
      >
        {selectedEod && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2 font-mono-sgt text-[#CBB487]">
              <Info className="h-4 w-4" />
              <span>{selectedEod.settlementNo}</span>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#08090B] p-4 space-y-2.5 text-[#D6D3CC]">
              <div className="flex justify-between">
                <span className="text-[#A7AEBC]">BV Before EOD</span>
                <span className="tabular-nums font-semibold text-[#F2F0EB]">
                  L {formatBv(selectedEod.leftBvBefore)} / R {formatBv(selectedEod.rightBvBefore)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7AEBC]">Active Headcount</span>
                <span className="tabular-nums font-semibold text-[#F2F0EB]">
                  L {selectedEod.leftMemberCount} / R {selectedEod.rightMemberCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7AEBC]">Retained Side</span>
                <span className="font-semibold text-emerald-400">
                  {selectedEod.retainedSide}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7AEBC]">Flushed</span>
                <span className="tabular-nums font-semibold text-[#CBB487]">
                  {formatBv(selectedEod.flushedBv)} ({selectedEod.flushedSide})
                </span>
              </div>
              <div className="flex justify-between border-t border-white/[0.08] pt-2">
                <span className="text-[#A7AEBC]">Decision Basis</span>
                <span className="font-semibold text-[#CBB487]">{selectedEod.decisionBasis}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7AEBC]">Executed (SGT)</span>
                <span className="font-mono-sgt text-[#F2F0EB]">
                  {selectedEod.executedAtLabel}
                </span>
              </div>
            </div>
          </div>
        )}
      </BottomDrawer>
    </div>
  );
}
