import "dotenv/config";
import { prisma } from "../lib/db";
import { formatSgtTimestamp, getUpgradeEffectiveScheduleSgt } from "../lib/sgt";

/**
 * Idempotent migration helper for converting any legacy pending upgrades
 * to the fixed D+2 00:01:00 SGT rule while preserving original paidAt & confirmedAt.
 */
async function main() {
  const pendingMembers = await prisma.member.findMany({
    where: { pendingUpgradePackageCode: { not: null } },
    select: {
      id: true,
      memberCode: true,
      pendingUpgradePackageCode: true,
      pendingUpgradeEffectiveDate: true,
      pendingUpgradeEffectiveAt: true,
      pendingUpgradeOrderId: true,
    },
  });

  if (pendingMembers.length === 0) {
    console.log("No pending upgrade orders require migration.");
    return;
  }

  for (const m of pendingMembers) {
    if (!m.pendingUpgradeOrderId) continue;
    const order = await prisma.packageOrder.findUnique({
      where: { id: m.pendingUpgradeOrderId },
    });
    if (!order) continue;

    const anchorTime = order.confirmedAt ?? order.paidAt ?? order.createdAt;
    const schedule = getUpgradeEffectiveScheduleSgt(anchorTime, 2, "00:01:00");

    await prisma.$transaction([
      prisma.packageOrder.update({
        where: { id: order.id },
        data: {
          upgradeStatus: "WAITING_EFFECTIVE",
          effectiveSgtDate: schedule.effectiveSgtDate,
          effectiveAt: schedule.effectiveAt,
          isSameDayEffective: false,
        },
      }),
      prisma.member.update({
        where: { id: m.id },
        data: {
          pendingUpgradeEffectiveDate: schedule.effectiveSgtDate,
          pendingUpgradeEffectiveAt: schedule.effectiveAt,
        },
      }),
    ]);

    console.log(
      `Migrated order ${order.orderNo} (${m.memberCode}): confirmedAt=${formatSgtTimestamp(
        anchorTime
      )} -> effectiveAt=${schedule.effectiveSgtLabel}`
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
