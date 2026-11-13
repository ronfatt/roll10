"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import type { Dictionary, Locale } from "@/lib/i18n";
import {
  formatBvEventType,
  formatDecisionBasisLabel,
  formatLegLabel,
  formatTriggerTypeLabel,
} from "@/lib/i18n-labels";
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
  locale = "en",
  initialTab = "direct",
  initialLeg = "ALL",
  directItems,
  pairingItems,
  bvItems,
  eodItems,
  eodPreview,
}: {
  t: Dictionary;
  locale?: Locale;
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
                ? "bg-[#51E7FA] text-[#0A101A] shadow-[0_0_12px_rgba(81,231,250,0.35)]"
                : "border border-[#2B3D4D] bg-[#101B27] text-[#AAB8C7] hover:border-[#51E7FA]/50 hover:text-[#F4F8FC]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "direct" && (
        <div className="rounded-2xl border border-[#2B3D4D] bg-[#101B27] p-4 sm:p-5">
          {directItems.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#AAB8C7]">{t.common.noData}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#2B3D4D] text-[#AAB8C7]">
                  <tr>
                    <th className="py-2 pr-3">{locale === "zh-CN" ? "流水号" : "Ledger No"}</th>
                    <th className="py-2 pr-3">{locale === "zh-CN" ? "来源订单" : "Source Order"}</th>
                    <th className="py-2 pr-3">{locale === "zh-CN" ? "说明" : "Detail"}</th>
                    <th className="py-2 pr-3">{locale === "zh-CN" ? "金额" : "Amount"}</th>
                    <th className="py-2 pr-3">{t.common.timeSgt}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {directItems.map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono-sgt py-2.5 pr-3 text-[#F4F8FC]">
                        {row.ledgerNo}
                      </td>
                      <td className="font-mono-sgt py-2.5 pr-3 text-[#51E7FA]">
                        {row.orderNo ?? "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-[#AAB8C7]">{row.note}</td>
                      <td className="py-2.5 pr-3 tabular-nums font-semibold text-emerald-400">
                        +{formatU(row.amountCents)} {t.common.points}
                      </td>
                      <td className="font-mono-sgt py-2.5 pr-3 text-[#AAB8C7]">
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
        <div className="rounded-2xl border border-[#2B3D4D] bg-[#101B27] p-4 sm:p-5">
          {pairingItems.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#AAB8C7]">{t.common.noData}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#2B3D4D] text-[#AAB8C7]">
                  <tr>
                    <th className="py-2 pr-3">{locale === "zh-CN" ? "结算单号" : "Settlement No"}</th>
                    <th className="py-2 pr-3">{locale === "zh-CN" ? "SGT 日期" : "SGT Date"}</th>
                    <th className="py-2 pr-3">{locale === "zh-CN" ? "触发方式" : "Trigger"}</th>
                    <th className="py-2 pr-3">{locale === "zh-CN" ? "对碰组数" : "Pairs"}</th>
                    <th className="py-2 pr-3">{locale === "zh-CN" ? "扣除积分" : "Points Deducted"}</th>
                    <th className="py-2 pr-3">{locale === "zh-CN" ? "发放奖金" : "Awarded"}</th>
                    <th className="py-2 pr-3">{locale === "zh-CN" ? "封顶进度" : "Cap Progress"}</th>
                    <th className="py-2 pr-3">{t.common.timeSgt}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {pairingItems.map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono-sgt py-2.5 pr-3 text-[#51E7FA]">
                        {row.settlementNo}
                      </td>
                      <td className="font-mono-sgt py-2.5 pr-3 text-[#F4F8FC]">
                        {row.settlementDate}
                      </td>
                      <td className="py-2.5 pr-3 text-[#AAB8C7]">
                        {formatTriggerTypeLabel(row.triggerType, locale)}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums font-semibold text-[#F4F8FC]">
                        {row.pairsCount}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-[#AAB8C7]">
                        L -{row.bvDeductedPerLeg} / R -{row.bvDeductedPerLeg}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums font-semibold text-emerald-400">
                        +{formatU(row.pointsAwardedCents)} {t.common.points}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-[#AAB8C7]">
                        {formatU(row.dailyPairedAfterCents)} /{" "}
                        {formatU(row.dailyCapPointsCents)} {t.common.points}
                      </td>
                      <td className="font-mono-sgt py-2.5 pr-3 text-[#AAB8C7]">
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
          <div className="rounded-2xl border border-[#2B3D4D] bg-[#101B27] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#F4F8FC]">
                {locale === "zh-CN" ? (
                  <>
                    下次 <span className="font-mono-sgt">00:00 SGT</span> 日结结转预估
                  </>
                ) : (
                  <>
                    Next <span className="font-mono-sgt">00:00 SGT</span> Carryover Preview
                  </>
                )}
              </h2>
              <span className="rounded border border-[#51E7FA]/40 bg-[#51E7FA]/10 px-2 py-0.5 text-[10px] font-semibold text-[#51E7FA]">
                {t.common.estimatedBadge}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-4">
              <div className="rounded-xl border border-[#2B3D4D] bg-[#0A101A] p-3">
                <div className="text-[#AAB8C7]">
                  {locale === "zh-CN" ? "当前左 / 右区积分" : "Current L / R Points"}
                </div>
                <div className="mt-1 tabular-nums font-semibold text-[#F4F8FC]">
                  {eodPreview.leftBv} / {eodPreview.rightBv}
                </div>
              </div>
              <div className="rounded-xl border border-[#2B3D4D] bg-[#0A101A] p-3">
                <div className="text-[#AAB8C7]">
                  {locale === "zh-CN" ? "活跃人数（左 / 右）" : "Active Count (L / R)"}
                </div>
                <div className="mt-1 tabular-nums font-semibold text-[#F4F8FC]">
                  {eodPreview.leftCount} / {eodPreview.rightCount}
                </div>
              </div>
              <div className="rounded-xl border border-[#2B3D4D] bg-[#0A101A] p-3">
                <div className="text-[#AAB8C7]">
                  {locale === "zh-CN" ? "预估保留区" : "Est. Retained Side"}
                </div>
                <div className="mt-1 font-semibold text-emerald-400">
                  {formatLegLabel(eodPreview.retainedSide, locale)}
                </div>
              </div>
              <div className="rounded-xl border border-[#2B3D4D] bg-[#0A101A] p-3">
                <div className="text-[#AAB8C7]">
                  {locale === "zh-CN" ? "预估清零积分" : "Est. Flushed Points"}
                </div>
                <div className="mt-1 tabular-nums font-semibold text-[#51E7FA]">
                  {formatBv(eodPreview.flushedBv)}
                </div>
              </div>
            </div>
            <p className="mt-2.5 text-[11px] text-[#AAB8C7]">
              {locale === "zh-CN" ? (
                <>
                  按当前余额测算（{formatDecisionBasisLabel(eodPreview.decisionBasis, locale)}）。实际{" "}
                  <span className="font-mono-sgt">00:00 SGT</span> 日结结果以下方日结记录为准。
                </>
              ) : (
                <>
                  Estimated ({eodPreview.decisionBasis}) from current balances. Actual{" "}
                  <span className="font-mono-sgt">00:00 SGT</span> settlement is governed by EOD
                  records below.
                </>
              )}
            </p>
          </div>

          {/* Midnight 00:00 SGT EOD Carryover Summary */}
          <div id="eod" className="rounded-2xl border border-[#2B3D4D] bg-[#101B27] p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-semibold text-[#F4F8FC]">
              {locale === "zh-CN" ? (
                <>
                  <span className="font-mono-sgt">00:00 SGT</span> 午夜清零与结转历史
                </>
              ) : (
                <>
                  <span className="font-mono-sgt">00:00 SGT</span> Midnight Flush & Carryover History
                </>
              )}
            </h2>
            {eodItems.length === 0 ? (
              <p className="py-4 text-xs text-[#AAB8C7]">
                {locale === "zh-CN"
                  ? "暂无已执行的午夜日结记录。"
                  : "No midnight EOD settlements recorded yet."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#2B3D4D] text-[#AAB8C7]">
                    <tr>
                      <th className="py-2 pr-3">{locale === "zh-CN" ? "SGT 日期" : "SGT Date"}</th>
                      <th className="py-2 pr-3">
                        {locale === "zh-CN" ? "日结前 (左/右)" : "Before (L / R)"}
                      </th>
                      <th className="py-2 pr-3">
                        {locale === "zh-CN" ? "人数 (左/右)" : "Headcount (L / R)"}
                      </th>
                      <th className="py-2 pr-3">{locale === "zh-CN" ? "保留区" : "Retained Side"}</th>
                      <th className="py-2 pr-3">{locale === "zh-CN" ? "清零积分" : "Flushed Points"}</th>
                      <th className="py-2 pr-3">
                        {locale === "zh-CN" ? "结转后 (左/右)" : "After (L / R)"}
                      </th>
                      <th className="py-2 pr-3">{locale === "zh-CN" ? "判定依据" : "Basis"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {eodItems.map((e) => (
                      <tr key={e.id}>
                        <td className="font-mono-sgt py-2.5 pr-3 font-medium text-[#51E7FA]">
                          {e.settlementDate}
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums text-[#F4F8FC]">
                          {e.leftBvBefore} / {e.rightBvBefore}
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums text-[#AAB8C7]">
                          {e.leftMemberCount} / {e.rightMemberCount}
                        </td>
                        <td className="py-2.5 pr-3 font-medium text-emerald-400">
                          {formatLegLabel(e.retainedSide, locale)}
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums text-[#51E7FA]">
                          {formatBv(e.flushedBv)}
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums text-[#F4F8FC]">
                          {e.leftBvAfter} / {e.rightBvAfter}
                        </td>
                        <td className="py-2.5 pr-3 text-[11px] text-[#AAB8C7]">
                          {formatDecisionBasisLabel(e.decisionBasis, locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detailed BV Ledger */}
          <div className="rounded-2xl border border-[#2B3D4D] bg-[#101B27] p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#F4F8FC]">
                  {locale === "zh-CN" ? "团队积分流水明细" : "Points Ledger"}
                </h2>
                <span className="text-[11px] text-[#AAB8C7]">
                  {locale === "zh-CN" ? (
                    <>
                      点击任意 <span className="font-mono-sgt">00:00 SGT</span> 日结记录可查看结转判定详情
                    </>
                  ) : (
                    <>
                      Tap any <span className="font-mono-sgt">00:00 SGT</span> EOD row to inspect
                      carryover basis
                    </>
                  )}
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
                        ? "bg-[#51E7FA] text-[#0A101A]"
                        : "border border-[#2B3D4D] bg-[#0A101A] text-[#AAB8C7]"
                    }`}
                  >
                    {lf === "ALL"
                      ? t.wallet.filterAll
                      : formatLegLabel(lf, locale)}
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
                      <th className="py-2 pr-3">{locale === "zh-CN" ? "区间" : "Leg"}</th>
                      <th className="py-2 pr-3">{locale === "zh-CN" ? "类型" : "Type"}</th>
                      <th className="py-2 pr-3">{locale === "zh-CN" ? "积分变动" : "Delta Points"}</th>
                      <th className="py-2 pr-3">{locale === "zh-CN" ? "变动后余额" : "Balance After"}</th>
                      <th className="py-2 pr-3">{locale === "zh-CN" ? "备注" : "Note"}</th>
                      <th className="py-2 pr-3">{t.common.timeSgt}</th>
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
                            {formatLegLabel(row.leg, locale)}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-[#AAB8C7]">
                          {formatBvEventType(row.entryType, locale)}
                          {row.eodDetail && (
                            <span className="ml-1.5 rounded bg-[#51E7FA]/15 px-1.5 py-0.5 text-[10px] text-[#51E7FA]">
                              {locale === "zh-CN" ? "详情" : "Details"}
                            </span>
                          )}
                        </td>
                        <td
                          className={`py-2.5 pr-3 tabular-nums font-semibold ${
                            row.deltaBv > 0
                              ? "text-emerald-400"
                              : row.deltaBv < 0
                                ? "text-[#51E7FA]"
                                : "text-[#AAB8C7]"
                          }`}
                        >
                          {row.deltaBv > 0 ? "+" : ""}
                          {formatBv(row.deltaBv)}
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums text-[#F4F8FC]">
                          {formatBv(row.balanceAfterBv)}
                        </td>
                        <td className="py-2.5 pr-3 text-[#AAB8C7]">{row.note}</td>
                        <td className="font-mono-sgt py-2.5 pr-3 text-[#AAB8C7]">
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
            ? locale === "zh-CN"
              ? `日结结转详情 · ${selectedEod.settlementDate} SGT`
              : `EOD Carryover · ${selectedEod.settlementDate} SGT`
            : locale === "zh-CN"
              ? "日结结转详情"
              : "EOD Carryover Detail"
        }
      >
        {selectedEod && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2 font-mono-sgt text-[#51E7FA]">
              <Info className="h-4 w-4" />
              <span>{selectedEod.settlementNo}</span>
            </div>

            <div className="rounded-xl border border-[#2B3D4D] bg-[#0A101A] p-4 space-y-2.5 text-[#F4F8FC]">
              <div className="flex justify-between">
                <span className="text-[#AAB8C7]">
                  {locale === "zh-CN" ? "日结前积分" : "Points Before EOD"}
                </span>
                <span className="tabular-nums font-semibold text-[#F4F8FC]">
                  L {formatBv(selectedEod.leftBvBefore)} / R {formatBv(selectedEod.rightBvBefore)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#AAB8C7]">
                  {locale === "zh-CN" ? "双边活跃人数" : "Active Headcount"}
                </span>
                <span className="tabular-nums font-semibold text-[#F4F8FC]">
                  L {selectedEod.leftMemberCount} / R {selectedEod.rightMemberCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#AAB8C7]">
                  {locale === "zh-CN" ? "保留区" : "Retained Side"}
                </span>
                <span className="font-semibold text-emerald-400">
                  {formatLegLabel(selectedEod.retainedSide, locale)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#AAB8C7]">
                  {locale === "zh-CN" ? "清零积分" : "Flushed"}
                </span>
                <span className="tabular-nums font-semibold text-[#51E7FA]">
                  {formatBv(selectedEod.flushedBv)} ({formatLegLabel(selectedEod.flushedSide, locale)})
                </span>
              </div>
              <div className="flex justify-between border-t border-[#2B3D4D] pt-2">
                <span className="text-[#AAB8C7]">
                  {locale === "zh-CN" ? "结转判定依据" : "Decision Basis"}
                </span>
                <span className="font-semibold text-[#51E7FA]">
                  {formatDecisionBasisLabel(selectedEod.decisionBasis, locale)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#AAB8C7]">
                  {locale === "zh-CN" ? "执行时间 (SGT)" : "Executed (SGT)"}
                </span>
                <span className="font-mono-sgt text-[#F4F8FC]">
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
