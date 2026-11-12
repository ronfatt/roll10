import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/session";
import { getServerT } from "@/lib/i18n-server";
import { formatSgtTimestamp } from "@/lib/sgt";
import { decideEodCarryover, getOrCreateConfigTx } from "@/lib/settlement/engine";
import { countSubtreeActiveMembers } from "@/lib/settlement/tree";
import { LedgersClient } from "@/components/portal/LedgersClient";

export const dynamic = "force-dynamic";

export default async function LedgersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; leg?: string }>;
}) {
  const member = await requireMember();
  const { locale, t } = await getServerT();
  const params = await searchParams;
  const initialTab =
    params.tab === "bv" ? "bv" : params.tab === "pairing" ? "pairing" : "direct";
  const initialLeg =
    params.leg === "LEFT" || params.leg === "RIGHT" ? params.leg : "ALL";

  const [config, subtreeCounts, directLedgers, pairings, bvLedgers, eods] =
    await Promise.all([
      getOrCreateConfigTx(prisma),
      countSubtreeActiveMembers(prisma, member.id),
      prisma.walletLedger.findMany({
        where: { memberId: member.id, entryType: "DIRECT_COMMISSION" },
        include: { order: { select: { orderNo: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.binaryPairingSettlement.findMany({
        where: { memberId: member.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.bvLedger.findMany({
        where: { memberId: member.id },
        include: {
          dailySettlement: true,
        },
        orderBy: { createdAt: "desc" },
        take: 150,
      }),
      prisma.dailySettlement.findMany({
        where: { memberId: member.id },
        orderBy: { settlementDate: "desc" },
        take: 60,
      }),
    ]);

  const decision = decideEodCarryover(
    member.leftBv,
    member.rightBv,
    subtreeCounts.leftCount,
    subtreeCounts.rightCount,
    config.tieBreakerRule
  );

  return (
    <LedgersClient
      t={t}
      locale={locale}
      initialTab={initialTab}
      initialLeg={initialLeg}
      eodPreview={{
        leftBv: member.leftBv,
        rightBv: member.rightBv,
        leftCount: subtreeCounts.leftCount,
        rightCount: subtreeCounts.rightCount,
        retainedSide: decision.retainedSide,
        flushedBv: decision.flushedBv,
        decisionBasis: decision.decisionBasis,
      }}
      directItems={directLedgers.map((d) => ({
        id: d.id,
        ledgerNo: d.ledgerNo,
        amountCents: d.deltaAvailableCents,
        orderNo: d.order?.orderNo ?? null,
        note: d.note,
        createdAtLabel: formatSgtTimestamp(d.createdAt),
      }))}
      pairingItems={pairings.map((p) => ({
        id: p.id,
        settlementNo: p.settlementNo,
        settlementDate: p.settlementDate,
        triggerType: p.triggerType,
        pairsCount: p.pairsCount,
        bvDeductedPerLeg: p.bvDeductedPerLeg,
        pointsAwardedCents: p.pointsAwardedCents,
        dailyPairedAfterCents: p.dailyPairedAfterCents,
        dailyCapPointsCents: p.dailyCapPointsCents,
        createdAtLabel: formatSgtTimestamp(p.createdAt),
      }))}
      bvItems={bvLedgers.map((b) => ({
        id: b.id,
        leg: b.leg,
        entryType: b.entryType,
        deltaBv: b.deltaBv,
        balanceAfterBv: b.balanceAfterBv,
        settlementDate: b.settlementDate,
        note: b.note,
        createdAtLabel: formatSgtTimestamp(b.createdAt),
        eodDetail: b.dailySettlement
          ? {
              settlementNo: b.dailySettlement.settlementNo,
              settlementDate: b.dailySettlement.settlementDate,
              leftBvBefore: b.dailySettlement.leftBvBefore,
              rightBvBefore: b.dailySettlement.rightBvBefore,
              leftMemberCount: b.dailySettlement.leftMemberCount,
              rightMemberCount: b.dailySettlement.rightMemberCount,
              retainedSide: b.dailySettlement.retainedSide,
              flushedSide: b.dailySettlement.flushedSide,
              flushedBv: b.dailySettlement.flushedBv,
              decisionBasis: b.dailySettlement.decisionBasis,
              executedAtLabel: formatSgtTimestamp(b.dailySettlement.executedAt),
            }
          : null,
      }))}
      eodItems={eods.map((e) => ({
        id: e.id,
        settlementNo: e.settlementNo,
        settlementDate: e.settlementDate,
        leftBvBefore: e.leftBvBefore,
        rightBvBefore: e.rightBvBefore,
        leftMemberCount: e.leftMemberCount,
        rightMemberCount: e.rightMemberCount,
        retainedSide: e.retainedSide,
        flushedBv: e.flushedBv,
        leftBvAfter: e.leftBvAfter,
        rightBvAfter: e.rightBvAfter,
        decisionBasis: e.decisionBasis,
        executedAtLabel: formatSgtTimestamp(e.executedAt),
      }))}
    />
  );
}
