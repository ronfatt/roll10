import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getServerLocale } from "@/lib/i18n-server";
import { formatSgtTimestamp } from "@/lib/sgt";
import { AdminUpgradesClient } from "@/components/admin/AdminUpgradesClient";

export const dynamic = "force-dynamic";

export default async function AdminUpgradesPage() {
  await requireAdmin();
  const locale = await getServerLocale();
  const now = new Date();

  const orders = await prisma.packageOrder.findMany({
    where: { orderType: "UPGRADE" },
    include: {
      member: { select: { memberCode: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const orderIds = orders.map((o) => o.id);
  const catchupPairings = orderIds.length
    ? await prisma.binaryPairingSettlement.findMany({
        where: {
          triggerOrderId: { in: orderIds },
          triggerType: "SCHEDULED_UPGRADE",
        },
      })
    : [];

  const pairingMap = new Map<string, { pairs: number; pointsCents: number }>();
  for (const p of catchupPairings) {
    if (!p.triggerOrderId) continue;
    const prev = pairingMap.get(p.triggerOrderId) ?? { pairs: 0, pointsCents: 0 };
    prev.pairs += p.pairsCount;
    prev.pointsCents += p.pointsAwardedCents;
    pairingMap.set(p.triggerOrderId, prev);
  }

  return (
    <AdminUpgradesClient
      locale={locale}
      upgrades={orders.map((o) => {
        const catchup = pairingMap.get(o.id) ?? { pairs: 0, pointsCents: 0 };
        return {
          id: o.id,
          orderNo: o.orderNo,
          memberCode: o.member.memberCode,
          memberName: o.member.displayName,
          previousPackageCode: o.previousPackageCode,
          targetPackageCode: o.targetPackageCode,
          orderStatus: o.status,
          upgradeStatus: o.upgradeStatus,
          upgradeFailureReason: o.upgradeFailureReason,
          confirmedAtLabel: o.confirmedAt ? formatSgtTimestamp(o.confirmedAt) : null,
          effectiveAtLabel: o.effectiveAt ? formatSgtTimestamp(o.effectiveAt) : null,
          processedAtLabel: o.upgradeProcessedAt
            ? formatSgtTimestamp(o.upgradeProcessedAt)
            : null,
          isDueNow: Boolean(o.effectiveAt && o.effectiveAt <= now),
          catchupPairs: catchup.pairs,
          catchupPointsCents: catchup.pointsCents,
        };
      })}
    />
  );
}
