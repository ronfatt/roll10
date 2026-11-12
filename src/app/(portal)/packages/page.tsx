import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/session";
import { getServerT } from "@/lib/i18n-server";
import { calculatePairingResult } from "@/lib/money";
import {
  formatSgtNaturalSchedule,
  formatSgtTimestamp,
  getSgtDateString,
  getUpgradeEffectiveScheduleSgt,
} from "@/lib/sgt";
import { getOrCreateConfigTx } from "@/lib/settlement/engine";
import { isUsdtDepositConfigured } from "@/lib/usdt/address";
import { PackagesClient } from "@/components/portal/PackagesClient";

export const dynamic = "force-dynamic";

export default async function PackagesPage() {
  const member = await requireMember();
  const { locale, t } = await getServerT();
  const now = new Date();
  const currentSgtDate = getSgtDateString(now);

  const [config, rawTiers, rawOrders, waitingUpgradeOrder] = await Promise.all([
    getOrCreateConfigTx(prisma),
    prisma.packageTier.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.packageOrder.findMany({
      where: { memberId: member.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    member.pendingUpgradeOrderId
      ? prisma.packageOrder.findUnique({
          where: { id: member.pendingUpgradeOrderId },
          select: { confirmedAt: true },
        })
      : Promise.resolve(null),
  ]);

  const schedule = getUpgradeEffectiveScheduleSgt(
    now,
    config.upgradeEffectiveDaysOffset,
    config.upgradeEffectiveTimeSgt
  );

  const currentTier = rawTiers.find((x) => x.code === member.currentPackageCode) ?? null;
  const currentSortOrder = currentTier?.sortOrder ?? 0;
  const effectiveTodayPaired =
    member.activeSettlementDate === currentSgtDate ? member.todayPairedPointsCents : 0;

  const tiers = rawTiers.map((tier) => {
    const upgradePayUsdCents =
      currentTier && config.upgradePriceMode === "DIFFERENCE"
        ? Math.max(0, tier.priceUsdCents - currentTier.priceUsdCents)
        : tier.priceUsdCents;

    // Preview is explicitly labeled as ESTIMATED (uses current BV snapshot, assumes 0 prior pairings on effective day)
    const preview =
      member.status === "ACTIVE" && tier.sortOrder > currentSortOrder
        ? calculatePairingResult({
            leftBv: member.leftBv,
            rightBv: member.rightBv,
            dailyCapPointsCents: tier.dailyCapPointsCents,
            todayPairedPointsCents: 0,
            pairingUnitBv: config.pairingUnitBv,
            pairingRewardPointsCents: config.pairingRewardPointsCents,
          })
        : { pairsCount: 0, pointsAwardedCents: 0 };

    const upgradePayUsdtMicros =
      currentTier && config.upgradePriceMode === "DIFFERENCE"
        ? tier.priceUsdtMicros > currentTier.priceUsdtMicros
          ? tier.priceUsdtMicros - currentTier.priceUsdtMicros
          : BigInt(0)
        : tier.priceUsdtMicros;

    return {
      code: tier.code,
      nameEn: tier.nameEn,
      nameZh: tier.nameZh,
      priceUsdCents: tier.priceUsdCents,
      priceUsdtMicros: tier.priceUsdtMicros.toString(),
      bv: tier.bv,
      dailyCapPointsCents: tier.dailyCapPointsCents,
      sortOrder: tier.sortOrder,
      upgradePayUsdCents,
      upgradePayUsdtMicros: upgradePayUsdtMicros.toString(),
      estimatedCatchupPairs: preview.pairsCount,
      estimatedCatchupPointsCents: preview.pointsAwardedCents,
    };
  });

  const orders = rawOrders.map((o) => ({
    id: o.id,
    orderNo: o.orderNo,
    orderType: o.orderType,
    targetPackageCode: o.targetPackageCode,
    previousPackageCode: o.previousPackageCode,
    amountUsdCents: o.amountUsdCents,
    expectedUsdtMicros: o.expectedUsdtMicros ? o.expectedUsdtMicros.toString() : null,
    depositVerifyStatus: o.depositVerifyStatus,
    bvAmount: o.bvAmount,
    paymentStatus: o.paymentStatus,
    status: o.status,
    upgradeStatus: o.upgradeStatus,
    failureReason: o.failureReason,
    confirmedAtLabel: o.confirmedAt ? formatSgtTimestamp(o.confirmedAt) : null,
    effectiveAtLabel: o.effectiveAt
      ? formatSgtTimestamp(o.effectiveAt)
      : o.effectiveSgtDate
        ? `${o.effectiveSgtDate} SGT`
        : null,
    createdAtLabel: formatSgtTimestamp(o.createdAt),
  }));

  const naturalScheduleIfNow = formatSgtNaturalSchedule(
    now,
    schedule.effectiveAt,
    locale
  );
  const waitingNaturalSchedule =
    waitingUpgradeOrder?.confirmedAt && member.pendingUpgradeEffectiveAt
      ? formatSgtNaturalSchedule(
          waitingUpgradeOrder.confirmedAt,
          member.pendingUpgradeEffectiveAt,
          locale
        )
      : null;

  return (
    <PackagesClient
      t={t}
      locale={locale}
      memberStatus={member.status}
      currentPackageCode={member.currentPackageCode}
      currentSortOrder={currentSortOrder}
      pendingUpgradePackageCode={member.pendingUpgradePackageCode}
      pendingUpgradeEffectiveLabel={
        member.pendingUpgradeEffectiveAt
          ? formatSgtTimestamp(member.pendingUpgradeEffectiveAt)
          : member.pendingUpgradeEffectiveDate
            ? `${member.pendingUpgradeEffectiveDate} 00:01:00 SGT`
            : null
      }
      pendingUpgradeConfirmedLabel={
        waitingUpgradeOrder?.confirmedAt
          ? formatSgtTimestamp(waitingUpgradeOrder.confirmedAt)
          : null
      }
      waitingNaturalSchedule={waitingNaturalSchedule}
      naturalScheduleIfNow={naturalScheduleIfNow}
      leftBv={member.leftBv}
      rightBv={member.rightBv}
      todayPairedPointsCents={effectiveTodayPaired}
      dailyCapPointsCents={member.dailyCapPointsCents}
      sgtTimeNowLabel={formatSgtTimestamp(now)}
      effectiveLabelIfConfirmedNow={schedule.effectiveSgtLabel}
      upgradePriceMode={config.upgradePriceMode}
      upgradeGrantsBv={config.upgradeGrantsBv}
      depositServiceAvailable={isUsdtDepositConfigured(config)}
      usdtNetwork={config.usdtNetwork}
      tiers={tiers}
      orders={orders}
    />
  );
}
