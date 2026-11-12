import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getServerLocale } from "@/lib/i18n-server";
import {
  formatBvEventType,
  formatDecisionBasisLabel,
  formatEntryTypeLabel,
  formatLegLabel,
  formatOrderStatus,
  formatOrderType,
  formatTriggerTypeLabel,
} from "@/lib/i18n-labels";
import { formatBv, formatU } from "@/lib/money";
import { formatSgtTimestamp, getSgtDateString } from "@/lib/sgt";

export const dynamic = "force-dynamic";

export default async function AdminOrderTracePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const locale = await getServerLocale();
  const isZh = locale === "zh-CN";
  const { id } = await params;

  const order = await prisma.packageOrder.findUnique({
    where: { id },
    include: {
      member: {
        include: {
          sponsor: { select: { memberCode: true, displayName: true } },
          placementParent: { select: { memberCode: true, displayName: true } },
        },
      },
      confirmedBy: { select: { memberCode: true, displayName: true } },
    },
  });

  if (!order) notFound();

  const [bvLedgers, pairingSettlements, walletLedgers] = await Promise.all([
    prisma.bvLedger.findMany({
      where: { orderId: order.id },
      include: { member: { select: { memberCode: true, displayName: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.binaryPairingSettlement.findMany({
      where: { triggerOrderId: order.id },
      include: { member: { select: { memberCode: true, displayName: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.walletLedger.findMany({
      where: { orderId: order.id },
      include: { member: { select: { memberCode: true, displayName: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const impactedMemberIds = Array.from(
    new Set([
      order.memberId,
      ...bvLedgers.map((b) => b.memberId),
      ...pairingSettlements.map((p) => p.memberId),
    ])
  );
  const settlementDate = order.confirmedAt
    ? getSgtDateString(order.confirmedAt)
    : getSgtDateString(order.createdAt);

  const eodSettlements = await prisma.dailySettlement.findMany({
    where: {
      memberId: { in: impactedMemberIds },
      settlementDate: { gte: settlementDate },
    },
    include: { member: { select: { memberCode: true, displayName: true } } },
    orderBy: [{ settlementDate: "asc" }, { memberId: "asc" }],
    take: 40,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#D8C39A] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{isZh ? "返回订单列表" : "Back to Orders"}</span>
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
          {isZh ? `订单全链路追查: ${order.orderNo}` : `Order Trace: ${order.orderNo}`}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {isZh
            ? "点击下方任意关联账本条目，展开查看不可篡改事件唯一键、变更前后余额及规则快照。"
            : "Click any linked ledger entry below to inspect immutable event keys, before/after balances, and rule snapshots."}
        </p>
      </div>

      {/* Order Summary */}
      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-white/[0.08] bg-[#141619] p-5 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-zinc-400">{isZh ? "会员与推荐人" : "Member & Sponsor"}</div>
          <div className="mt-1 font-semibold text-white">
            {order.member.displayName} ({order.member.memberCode})
          </div>
          <div className="text-zinc-400">
            {isZh ? "推荐人: " : "Sponsor: "}
            {order.member.sponsor?.memberCode ?? (isZh ? "顶点" : "Root")}
          </div>
        </div>
        <div>
          <div className="text-zinc-400">{isZh ? "双轨安置路径" : "Placement Path"}</div>
          <div className="mt-1 font-semibold text-white">
            {order.member.placementParent
              ? `${order.member.placementParent.memberCode} · ${formatLegLabel(order.member.placementLeg, locale)}`
              : isZh
                ? "顶点 / 暂未安置"
                : "Root / Unplaced"}
          </div>
          <div className="text-zinc-400">
            {isZh ? `规则版本: v${order.ruleVersion}` : `Rule Version: v${order.ruleVersion}`}
          </div>
        </div>
        <div>
          <div className="text-zinc-400">{isZh ? "配套与金额" : "Package & Amounts"}</div>
          <div className="mt-1 font-semibold text-[#D8C39A]">
            {formatOrderType(order.orderType, locale)} · {order.targetPackageCode} (
            {formatU(order.amountUsdCents)} U)
          </div>
          <div className="text-zinc-400">
            BV: {formatBv(order.bvAmount)} · {isZh ? "付款状态: " : "Payment: "}
            {formatOrderStatus(order.paymentStatus, locale)}
          </div>
        </div>
        <div>
          <div className="text-zinc-400">{isZh ? "时间戳 (SGT)" : "Timestamps (SGT)"}</div>
          <div className="mt-1 tabular-nums text-zinc-200">
            {isZh ? "确认: " : "Confirmed: "}
            {order.confirmedAt ? formatSgtTimestamp(order.confirmedAt) : "—"}
          </div>
          <div className="tabular-nums text-emerald-400">
            {isZh ? "生效: " : "Effective: "}
            {order.effectiveAt ? formatSgtTimestamp(order.effectiveAt) : "—"}
          </div>
        </div>
      </div>

      {/* BV Ledgers */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">
          {isZh ? `1. BV 账本影响 (${bvLedgers.length})` : `1. BV Ledger Impact (${bvLedgers.length})`}
        </h2>
        {bvLedgers.length === 0 ? (
          <p className="text-xs text-zinc-500">
            {isZh ? "该订单暂无关联的 BV 变动流水。" : "No BV entries linked to this order."}
          </p>
        ) : (
          <div className="space-y-2">
            {bvLedgers.map((b) => (
              <details
                key={b.id}
                className="rounded-xl border border-white/[0.06] bg-[#08090B] px-3.5 py-2.5 text-xs"
              >
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{b.member.memberCode}</span>
                    <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[11px] text-zinc-300">
                      {formatLegLabel(b.leg, locale)}
                    </span>
                    <span className="text-zinc-400">{formatBvEventType(b.entryType, locale)}</span>
                  </div>
                  <div className="flex items-center gap-4 tabular-nums">
                    <span
                      className={`font-semibold ${
                        b.deltaBv >= 0 ? "text-emerald-400" : "text-amber-300"
                      }`}
                    >
                      {b.deltaBv >= 0 ? "+" : ""}
                      {formatBv(b.deltaBv)}
                    </span>
                    <span className="text-zinc-400">
                      {isZh ? "变动后: " : "After: "}
                      {formatBv(b.balanceAfterBv)}
                    </span>
                    <span className="text-zinc-500">{formatSgtTimestamp(b.createdAt)}</span>
                  </div>
                </summary>
                <div className="mt-2 border-t border-white/[0.06] pt-2 text-[11px] text-zinc-400">
                  <div>
                    {isZh ? "事件唯一键: " : "Event Key: "}
                    <code className="text-[#D8C39A]">{b.eventKey}</code>
                  </div>
                  <div>
                    {isZh ? "结算日期: " : "Settlement Date: "}
                    {b.settlementDate} SGT · {isZh ? "备注: " : "Note: "}
                    {b.note ?? "—"}
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      {/* Binary Pairing Settlements */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">
          {isZh
            ? `2. 对碰结算记录 (${pairingSettlements.length})`
            : `2. Binary Pairing Settlements (${pairingSettlements.length})`}
        </h2>
        {pairingSettlements.length === 0 ? (
          <p className="text-xs text-zinc-500">
            {isZh ? "该订单未触发对碰奖金结算。" : "No binary pairing triggered by this order."}
          </p>
        ) : (
          <div className="space-y-2">
            {pairingSettlements.map((p) => (
              <details
                key={p.id}
                className="rounded-xl border border-white/[0.06] bg-[#08090B] px-3.5 py-2.5 text-xs"
              >
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums font-semibold text-[#D8C39A]">
                      {p.settlementNo}
                    </span>
                    <span className="text-white">{p.member.memberCode}</span>
                    <span className="text-zinc-400">
                      {formatTriggerTypeLabel(p.triggerType, locale)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 tabular-nums">
                    <span className="text-zinc-200">
                      {isZh ? `${p.pairsCount} 组` : `${p.pairsCount} pairs`}
                    </span>
                    <span className="font-semibold text-emerald-400">
                      +{formatU(p.pointsAwardedCents)} U
                    </span>
                    <span className="text-zinc-500">{formatSgtTimestamp(p.businessAt)}</span>
                  </div>
                </summary>
                <div className="mt-2 grid grid-cols-1 gap-1 border-t border-white/[0.06] pt-2 text-[11px] text-zinc-400 sm:grid-cols-2">
                  <div>
                    {isZh ? "事件唯一键: " : "Event Key: "}
                    <code className="text-zinc-200">{p.eventKey}</code>
                  </div>
                  <div>
                    {isZh ? `规则版本: v${p.ruleVersion}` : `Rule Version: v${p.ruleVersion}`}
                  </div>
                  <div>
                    {isZh ? "左区 BV: " : "Left BV: "}
                    {p.leftBvBefore} → {p.leftBvAfter} · {isZh ? "右区 BV: " : "Right BV: "}
                    {p.rightBvBefore} → {p.rightBvAfter}
                  </div>
                  <div>
                    {isZh ? "今日封顶消耗: " : "Daily Cap Used: "}
                    {formatU(p.dailyPairedBeforeCents)} → {formatU(p.dailyPairedAfterCents)} /{" "}
                    {formatU(p.dailyCapPointsCents)} U
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      {/* Wallet Ledgers */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">
          {isZh
            ? `3. 钱包奖金入账明细 (${walletLedgers.length})`
            : `3. Wallet Ledger Payouts (${walletLedgers.length})`}
        </h2>
        {walletLedgers.length === 0 ? (
          <p className="text-xs text-zinc-500">
            {isZh ? "该订单暂无关联的钱包流水。" : "No wallet credits linked to this order."}
          </p>
        ) : (
          <div className="space-y-2">
            {walletLedgers.map((w) => (
              <details
                key={w.id}
                className="rounded-xl border border-white/[0.06] bg-[#08090B] px-3.5 py-2.5 text-xs"
              >
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums font-semibold text-[#D8C39A]">{w.ledgerNo}</span>
                    <span className="text-white">{w.member.memberCode}</span>
                    <span className="text-zinc-400">
                      {formatEntryTypeLabel(w.entryType, locale)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 tabular-nums">
                    <span className="font-semibold text-emerald-400">
                      +{formatU(w.deltaAvailableCents)} U
                    </span>
                    <span className="text-zinc-500">{formatSgtTimestamp(w.createdAt)}</span>
                  </div>
                </summary>
                <div className="mt-2 border-t border-white/[0.06] pt-2 text-[11px] text-zinc-400">
                  <div>
                    {isZh ? "事件唯一键: " : "Event Key: "}
                    <code className="text-zinc-200">{w.eventKey}</code>
                  </div>
                  <div>
                    {isZh
                      ? `变动后余额: 可提 ${formatU(w.availableAfterCents)} U / 冻结 ${formatU(w.lockedAfterCents)} U · 备注: ${w.note ?? "—"}`
                      : `Balance After: ${formatU(w.availableAfterCents)} U Avail / ${formatU(w.lockedAfterCents)} U Locked · Note: ${w.note ?? "—"}`}
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      {/* Related Daily EOD Settlements */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">
          {isZh
            ? `4. 受影响会员后续日结记录 (${eodSettlements.length})`
            : `4. Subsequent EOD Settlements for Impacted Members (${eodSettlements.length})`}
        </h2>
        {eodSettlements.length === 0 ? (
          <p className="text-xs text-zinc-500">
            {isZh
              ? `自 ${settlementDate} SGT 起暂未执行新的午夜日结。`
              : `No midnight EOD settlements have executed yet on or after ${settlementDate} SGT.`}
          </p>
        ) : (
          <div className="space-y-2">
            {eodSettlements.map((e) => (
              <details
                key={e.id}
                className="rounded-xl border border-white/[0.06] bg-[#08090B] px-3.5 py-2.5 text-xs"
              >
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums font-semibold text-[#D8C39A]">
                      {e.settlementDate}
                    </span>
                    <span className="text-white">{e.member.memberCode}</span>
                    <span className="text-emerald-300">
                      {isZh ? "保留 " : "Retained "}
                      {formatLegLabel(e.retainedSide, locale)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 tabular-nums">
                    <span className="text-amber-300">
                      {isZh ? "清零 " : "Flushed "}
                      {formatBv(e.flushedBv)}
                    </span>
                    <span className="text-zinc-400">
                      {formatDecisionBasisLabel(e.decisionBasis, locale)} (v{e.ruleVersion})
                    </span>
                  </div>
                </summary>
                <div className="mt-2 border-t border-white/[0.06] pt-2 text-[11px] text-zinc-400">
                  <div>
                    {isZh ? "日结前: " : "Before: "}
                    {e.leftBvBefore}L / {e.rightBvBefore}R · {isZh ? "人数: " : "Headcounts: "}
                    {e.leftMemberCount}L / {e.rightMemberCount}R · {isZh ? "结转后: " : "After: "}
                    {e.leftBvAfter}L / {e.rightBvAfter}R
                  </div>
                  <div>
                    {isZh ? "日结单号: " : "Settlement No: "}
                    {e.settlementNo} · {isZh ? "执行时间: " : "Executed: "}
                    {formatSgtTimestamp(e.executedAt)}
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
