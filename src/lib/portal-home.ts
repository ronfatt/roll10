import type { Member, PackageTier } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n";
import {
  formatSgtCompactDateTime,
  formatSgtNaturalSchedule,
  formatSgtTimestamp,
  getNextSgtRolloverAt,
} from "@/lib/sgt";
import { calculateDirectRewardUsdtMicros } from "@/lib/money";
import { ROLL10_PACKAGES, getPackageTierName } from "@/lib/packages";
import { decideEodCarryover, getOrCreateConfigTx } from "@/lib/settlement/engine";
import { countSubtreeActiveMembers } from "@/lib/settlement/tree";

export interface PortalHomePayload {
  serverNowIso: string;
  nextRolloverAtIso: string;
  settlementDate: string;
  directRewardCurrency: "USDT" | "POINTS";
  member: {
    memberCode: string;
    displayName: string;
    status: string;
    currentPackageCode: string | null;
    packageLabel: string;
    planBadge: string;
    dailyCapPointsCents: number;
    leftBv: number;
    rightBv: number;
    leftCount: number;
    rightCount: number;
    todayPairedCents: number;
    directCommissionCents: number;
    directCommissionCpCents: number;
    differentialCpCents: number;
    directRatePercent: number;
    cpBalanceCents: number;
    rpBalanceCents: number;
    usdtBalanceCents: number;
    directReferralCount: number;
    directReferralActiveCount: number;
    directReferralPendingCount: number;
    directReferralUsdtMicros: string;
    directReferralPendingUsdtMicros: string;
    availablePointsCents: number;
    lockedPointsCents: number;
  };
  pendingOrderId: string | null;
  pendingOrderNo: string | null;
  pendingOrderPaymentStatus: string | null;
  pendingOrderVerifyStatus: string | null;
  waitingUpgrade: {
    orderId: string;
    orderNo: string;
    fromCode: string;
    toCode: string;
    fromPlanShort: string;
    toPlanShort: string;
    naturalSchedule: string;
    effectiveAtLabel: string;
    effectiveShortLabel: string;
    confirmedAtLabel: string | null;
    currentCapPointsCents: number;
  } | null;
  recentEffectiveTransition: {
    eodDate: string | null;
    eodRetainedSide: string | null;
    eodFlushedBv: number;
    upgradeOrderNo: string;
    upgradeToCode: string;
    upgradeEffectiveLabel: string;
    catchupPairs: number;
    catchupPointsCents: number;
  } | null;
  eodPreview: {
    retainedSide: string;
    flushedBv: number;
    carryoverBv: number;
    leftBv: number;
    rightBv: number;
    leftCount: number;
    rightCount: number;
    decisionBasis: string;
  };
  latestEod: {
    settlementDate: string;
    retainedSide: string;
    flushedBv: number;
    leftBvAfter: number;
    rightBvAfter: number;
    decisionBasis: string;
    executedAtIso: string;
  } | null;
}

function formatPlanShort(code: string | null, locale: Locale): string {
  if (!code) return locale === "zh-CN" ? "待激活" : "Pending";
  return getPackageTierName(code);
}

function formatPlanNumeric(code: string | null): string {
  if (!code) return "-";
  const numeric = Number(code.replace(/^P/i, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric.toLocaleString("en-US") : code;
}

export async function loadPortalHomeData(
  memberOrId: string | (Member & { currentPackage: PackageTier | null }),
  locale: Locale,
  asOf?: Date
): Promise<PortalHomePayload | null> {
  const member =
    typeof memberOrId === "object"
      ? memberOrId
      : await prisma.member.findUnique({
          where: { id: memberOrId },
          include: { currentPackage: true },
        });
  if (!member) return null;

  const t = getDictionary(locale);
  const now = asOf ?? new Date();
  const { currentSgtDate, nextRolloverAt } = getNextSgtRolloverAt(now);
  const effectiveTodayPairedCents =
    member.activeSettlementDate === currentSgtDate ? member.todayPairedPointsCents : 0;

  const [
    config,
    directSumAgg,
    directCpEarnedAgg,
    differentialCpEarnedAgg,
    directUsdtEarnedAgg,
    directUsdtPendingRows,
    pendingReferralOrders,
    directReferralsGrouped,
    subtreeCounts,
    pendingOrder,
    waitingUpgradeOrder,
    latestEod,
    latestEffectiveUpgrade,
  ] = await Promise.all([
    getOrCreateConfigTx(prisma),
    prisma.walletLedger.aggregate({
      where: { memberId: member.id, entryType: "DIRECT_COMMISSION" },
      _sum: { deltaAvailableCents: true },
    }),
    prisma.referralRewardLedger.aggregate({
      where: {
        memberId: member.id,
        rewardType: "DIRECT",
        status: "CREDITED",
      },
      _sum: { amountCpCents: true },
    }),
    prisma.referralRewardLedger.aggregate({
      where: {
        memberId: member.id,
        rewardType: "DIFFERENTIAL",
        status: "CREDITED",
      },
      _sum: { amountCpCents: true },
    }),
    prisma.referralRewardLedger.aggregate({
      where: {
        memberId: member.id,
        currency: "USDT",
        status: { in: ["CREDITED", "REVERSED"] },
      },
      _sum: { amountMicros: true },
    }),
    prisma.referralRewardLedger.aggregate({
      where: {
        memberId: member.id,
        currency: "USDT",
        status: "PENDING",
      },
      _sum: { amountMicros: true },
    }),
    prisma.packageOrder.findMany({
      where: {
        status: "PENDING_CONFIRMATION",
        commissionableBv: { gt: 0 },
        member: { sponsorId: member.id },
      },
      select: { id: true, commissionableBv: true },
    }),
    prisma.member.groupBy({
      by: ["status"],
      where: { sponsorId: member.id },
      _count: { _all: true },
    }),
    countSubtreeActiveMembers(prisma, member.id),
    prisma.packageOrder.findFirst({
      where: {
        memberId: member.id,
        status: "PENDING_CONFIRMATION",
      },
      orderBy: { createdAt: "desc" },
    }),
    member.pendingUpgradeOrderId
      ? prisma.packageOrder.findUnique({
          where: { id: member.pendingUpgradeOrderId },
          select: {
            id: true,
            orderNo: true,
            previousPackageCode: true,
            targetPackageCode: true,
            confirmedAt: true,
            effectiveAt: true,
          },
        })
      : Promise.resolve(null),
    prisma.dailySettlement.findFirst({
      where: { memberId: member.id },
      orderBy: { settlementDate: "desc" },
    }),
    prisma.packageOrder.findFirst({
      where: {
        memberId: member.id,
        orderType: "UPGRADE",
        upgradeStatus: "EFFECTIVE",
      },
      orderBy: { upgradeProcessedAt: "desc" },
    }),
  ]);

  let directReferralCount = 0;
  let directReferralActiveCount = 0;
  let directReferralPendingCount = 0;
  for (const grp of directReferralsGrouped) {
    const cnt = grp._count._all;
    directReferralCount += cnt;
    if (grp.status === "ACTIVE") directReferralActiveCount += cnt;
    if (grp.status === "PENDING_PAYMENT") directReferralPendingCount += cnt;
  }

  const earnedUsdtMicros = directUsdtEarnedAgg._sum.amountMicros ?? 0n;
  let pendingUsdtMicros = directUsdtPendingRows._sum.amountMicros ?? 0n;
  for (const ord of pendingReferralOrders) {
    pendingUsdtMicros += calculateDirectRewardUsdtMicros(
      ord.commissionableBv,
      config.directCommissionRateBps,
      config.directUsdtConversionMicros
    );
  }

  const eodPreviewDecision = decideEodCarryover(
    member.leftBv,
    member.rightBv,
    subtreeCounts.leftCount,
    subtreeCounts.rightCount,
    config.tieBreakerRule
  );
  const carryoverBv =
    eodPreviewDecision.retainedSide === "LEFT"
      ? eodPreviewDecision.leftBvAfter
      : eodPreviewDecision.retainedSide === "RIGHT"
        ? eodPreviewDecision.rightBvAfter
        : 0;

  let recentEffectiveTransition = null;
  if (!waitingUpgradeOrder && latestEffectiveUpgrade) {
    const catchup = await prisma.binaryPairingSettlement.aggregate({
      where: {
        triggerOrderId: latestEffectiveUpgrade.id,
        triggerType: "SCHEDULED_UPGRADE",
      },
      _sum: { pairsCount: true, pointsAwardedCents: true },
    });
    recentEffectiveTransition = {
      eodDate: latestEod?.settlementDate ?? null,
      eodRetainedSide: latestEod?.retainedSide ?? null,
      eodFlushedBv: latestEod?.flushedBv ?? 0,
      upgradeOrderNo: latestEffectiveUpgrade.orderNo,
      upgradeToCode: latestEffectiveUpgrade.targetPackageCode,
      upgradeEffectiveLabel: latestEffectiveUpgrade.effectiveAt
        ? formatSgtTimestamp(latestEffectiveUpgrade.effectiveAt)
        : "00:01:00 SGT",
      catchupPairs: catchup._sum.pairsCount ?? 0,
      catchupPointsCents: catchup._sum.pointsAwardedCents ?? 0,
    };
  }

  const packageLabel = member.currentPackage
    ? `${getPackageTierName(member.currentPackage.code)} (${(member.currentPackage.priceUsdCents / 100).toLocaleString()} U)`
    : t.overview.pendingActivation;

  const fromCode = waitingUpgradeOrder?.previousPackageCode ?? member.currentPackageCode ?? "";
  const toCode = waitingUpgradeOrder?.targetPackageCode ?? "";

  const sponsorPkgConfig =
    ROLL10_PACKAGES[member.currentPackageCode || ""] || ROLL10_PACKAGES.P100;
  const directRatePercent = sponsorPkgConfig.directRatePercent;
  const directRewardCpCents = directCpEarnedAgg._sum.amountCpCents ?? 0;
  const differentialRewardCpCents = differentialCpEarnedAgg._sum.amountCpCents ?? 0;

  return {
    serverNowIso: now.toISOString(),
    nextRolloverAtIso: nextRolloverAt.toISOString(),
    settlementDate: currentSgtDate,
    directRewardCurrency: config.directRewardCurrency,
    member: {
      memberCode: member.memberCode,
      displayName: member.displayName,
      status: member.status,
      currentPackageCode: member.currentPackageCode,
      packageLabel,
      planBadge: formatPlanShort(member.currentPackageCode, locale),
      dailyCapPointsCents: member.dailyCapPointsCents,
      leftBv: member.leftBv,
      rightBv: member.rightBv,
      leftCount: subtreeCounts.leftCount,
      rightCount: subtreeCounts.rightCount,
      todayPairedCents: effectiveTodayPairedCents,
      directCommissionCents: directRewardCpCents,
      directCommissionCpCents: directRewardCpCents,
      differentialCpCents: differentialRewardCpCents,
      directRatePercent,
      cpBalanceCents: (member as { cpBalanceCents?: number }).cpBalanceCents ?? 0,
      rpBalanceCents: (member as { rpBalanceCents?: number }).rpBalanceCents ?? 0,
      usdtBalanceCents: member.availablePointsCents,
      directReferralCount,
      directReferralActiveCount,
      directReferralPendingCount,
      directReferralUsdtMicros: (earnedUsdtMicros > 0n ? earnedUsdtMicros : 0n).toString(),
      directReferralPendingUsdtMicros: pendingUsdtMicros.toString(),
      availablePointsCents: member.availablePointsCents,
      lockedPointsCents: member.lockedPointsCents,
    },
    pendingOrderId: pendingOrder?.id ?? null,
    pendingOrderNo: pendingOrder?.orderNo ?? null,
    pendingOrderPaymentStatus: pendingOrder?.paymentStatus ?? null,
    pendingOrderVerifyStatus: pendingOrder?.depositVerifyStatus ?? null,
    waitingUpgrade:
      waitingUpgradeOrder && waitingUpgradeOrder.effectiveAt
        ? {
            orderId: waitingUpgradeOrder.id,
            orderNo: waitingUpgradeOrder.orderNo,
            fromCode,
            toCode,
            fromPlanShort: formatPlanNumeric(fromCode),
            toPlanShort: formatPlanShort(toCode, locale),
            naturalSchedule: formatSgtNaturalSchedule(
              waitingUpgradeOrder.confirmedAt ?? new Date(),
              waitingUpgradeOrder.effectiveAt,
              locale
            ),
            effectiveAtLabel: formatSgtTimestamp(waitingUpgradeOrder.effectiveAt),
            effectiveShortLabel: formatSgtCompactDateTime(waitingUpgradeOrder.effectiveAt, locale),
            confirmedAtLabel: waitingUpgradeOrder.confirmedAt
              ? formatSgtTimestamp(waitingUpgradeOrder.confirmedAt)
              : null,
            currentCapPointsCents: member.dailyCapPointsCents,
          }
        : null,
    recentEffectiveTransition,
    eodPreview: {
      retainedSide: "NONE",
      flushedBv: 0,
      carryoverBv: member.leftBv + member.rightBv,
      leftBv: member.leftBv,
      rightBv: member.rightBv,
      leftCount: subtreeCounts.leftCount,
      rightCount: subtreeCounts.rightCount,
      decisionBasis: "ROLLOVER_FULL_POINTS_RETAINED",
    },
    latestEod: latestEod
      ? {
          settlementDate: latestEod.settlementDate,
          retainedSide: latestEod.retainedSide,
          flushedBv: latestEod.flushedBv,
          leftBvAfter: latestEod.leftBvAfter,
          rightBvAfter: latestEod.rightBvAfter,
          decisionBasis: latestEod.decisionBasis,
          executedAtIso: latestEod.executedAt.toISOString(),
        }
      : null,
  };
}

export function getFallbackHomeData(
  member: {
    memberCode: string;
    displayName: string;
    status: string;
    currentPackage?: { tier?: string; bonusValue?: number; dailyMaxCap?: number } | null;
  },
  locale: Locale
): PortalHomePayload {
  const now = new Date();
  const nextRollover = getNextSgtRolloverAt(now);
  const isP1000 = member.memberCode === "BM100001";

  return {
    serverNowIso: now.toISOString(),
    nextRolloverAtIso: nextRollover.nextRolloverAt.toISOString(),
    settlementDate: nextRollover.currentSgtDate,
    directRewardCurrency: "USDT",
    member: {
      memberCode: member.memberCode,
      displayName: member.displayName,
      status: member.status,
      currentPackageCode: isP1000 ? "P1000" : "P100",
      packageLabel: isP1000 ? "Diamond (1,000 U)" : "Silver (100 U)",
      planBadge: isP1000 ? "Diamond" : "Silver",
      dailyCapPointsCents: isP1000 ? 100000 : 10000,
      leftBv: isP1000 ? 4400 : 1800,
      rightBv: isP1000 ? 0 : 1000,
      leftCount: isP1000 ? 11 : 7,
      rightCount: isP1000 ? 1 : 3,
      todayPairedCents: 0,
      directCommissionCents: 0,
      directCommissionCpCents: 0,
      differentialCpCents: 0,
      directRatePercent: isP1000 ? 35 : 25,
      cpBalanceCents: 20000,
      rpBalanceCents: 500000,
      usdtBalanceCents: isP1000 ? 128000 : 50000,
      directReferralCount: isP1000 ? 2 : 8,
      directReferralActiveCount: isP1000 ? 2 : 8,
      directReferralPendingCount: 0,
      directReferralUsdtMicros: "0",
      directReferralPendingUsdtMicros: "0",
      availablePointsCents: 20000,
      lockedPointsCents: 0,
    },
    pendingOrderId: null,
    pendingOrderNo: null,
    pendingOrderPaymentStatus: null,
    pendingOrderVerifyStatus: null,
    waitingUpgrade: null,
    recentEffectiveTransition: null,
    eodPreview: {
      retainedSide: "NONE",
      flushedBv: 0,
      carryoverBv: isP1000 ? 4400 : 2800,
      leftBv: isP1000 ? 4400 : 1800,
      rightBv: isP1000 ? 0 : 1000,
      leftCount: isP1000 ? 11 : 7,
      rightCount: isP1000 ? 1 : 3,
      decisionBasis: "ROLLOVER_FULL_POINTS_RETAINED",
    },
    latestEod: null,
  };
}
