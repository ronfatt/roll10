import type {
  BinaryLeg,
  OrderType,
  Prisma,
  PrismaClient,
  RetainedSide,
  SystemConfig,
  TieBreakerRule,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  calculateDirectCommissionCents,
  calculateDirectRewardUsdtMicros,
  calculatePairingResult,
  usdCentsToUsdtMicros,
} from "@/lib/money";
import { isUsdtDepositConfigured } from "@/lib/usdt/address";
import {
  addDaysToSgtDate,
  getSgtDateString,
  getUpgradeEffectiveScheduleSgt,
  makeSgtDate,
} from "@/lib/sgt";
import { countSubtreeActiveMembers, getPlacementAncestorPath } from "./tree";
import type { ConfirmOrderResult, EodDecision, LockedMemberRow } from "./types";

type Tx = Prisma.TransactionClient;

let seqCounter = 0;
function makeDocNo(prefix: string, sgtDate: string): string {
  seqCounter = (seqCounter + 1) % 10000;
  const compact = sgtDate.replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${compact}-${String(seqCounter).padStart(4, "0")}-${rand}`;
}

export function buildRuleSnapshot(config: SystemConfig) {
  return {
    ruleVersion: config.ruleVersion,
    tieBreakerRule: config.tieBreakerRule,
    headcountRule: config.headcountRule,
    upgradePriceMode: config.upgradePriceMode,
    upgradeGrantsBv: config.upgradeGrantsBv,
    upgradeTriggersDirectCommission: config.upgradeTriggersDirectCommission,
    upgradeEffectiveDaysOffset: config.upgradeEffectiveDaysOffset,
    upgradeEffectiveTimeSgt: config.upgradeEffectiveTimeSgt,
    directCommissionRateBps: config.directCommissionRateBps,
    pairingUnitBv: config.pairingUnitBv,
    pairingRewardPointsCents: config.pairingRewardPointsCents,
    withdrawalFeeRateBps: config.withdrawalFeeRateBps,
  };
}

export function decideEodCarryover(
  leftBv: number,
  rightBv: number,
  leftCount: number,
  rightCount: number,
  tieBreakerRule: TieBreakerRule
): EodDecision {
  if (leftBv === 0 && rightBv === 0) {
    return {
      retainedSide: "NONE",
      flushedSide: "NONE",
      flushedBv: 0,
      leftBvAfter: 0,
      rightBvAfter: 0,
      decisionBasis: "ZERO_BALANCES",
    };
  }

  if (leftBv > rightBv) {
    return {
      retainedSide: "LEFT",
      flushedSide: rightBv > 0 ? "RIGHT" : "NONE",
      flushedBv: rightBv,
      leftBvAfter: leftBv,
      rightBvAfter: 0,
      decisionBasis: "HIGHER_BV_LEFT",
    };
  }

  if (rightBv > leftBv) {
    return {
      retainedSide: "RIGHT",
      flushedSide: leftBv > 0 ? "LEFT" : "NONE",
      flushedBv: leftBv,
      leftBvAfter: 0,
      rightBvAfter: rightBv,
      decisionBasis: "HIGHER_BV_RIGHT",
    };
  }

  if (leftCount > rightCount) {
    return {
      retainedSide: "LEFT",
      flushedSide: "RIGHT",
      flushedBv: rightBv,
      leftBvAfter: leftBv,
      rightBvAfter: 0,
      decisionBasis: "TIE_BV_HIGHER_HEADCOUNT_LEFT",
    };
  }

  if (rightCount > leftCount) {
    return {
      retainedSide: "RIGHT",
      flushedSide: "LEFT",
      flushedBv: leftBv,
      leftBvAfter: 0,
      rightBvAfter: rightBv,
      decisionBasis: "TIE_BV_HIGHER_HEADCOUNT_RIGHT",
    };
  }

  if (tieBreakerRule === "KEEP_RIGHT") {
    return {
      retainedSide: "RIGHT",
      flushedSide: "LEFT",
      flushedBv: leftBv,
      leftBvAfter: 0,
      rightBvAfter: rightBv,
      decisionBasis: "TIE_BV_TIE_HEADCOUNT_CONFIG_KEEP_RIGHT",
    };
  }

  return {
    retainedSide: "LEFT",
    flushedSide: "RIGHT",
    flushedBv: rightBv,
    leftBvAfter: leftBv,
    rightBvAfter: 0,
    decisionBasis: "TIE_BV_TIE_HEADCOUNT_CONFIG_KEEP_LEFT",
  };
}

export async function getOrCreateConfigTx(tx: Tx | PrismaClient): Promise<SystemConfig> {
  const existing = await tx.systemConfig.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  const created = await tx.systemConfig.create({
    data: { id: 1 },
  });
  await tx.ruleVersionRecord.upsert({
    where: { version: created.ruleVersion },
    update: {},
    create: {
      version: created.ruleVersion,
      tieBreakerRule: created.tieBreakerRule,
      headcountRule: created.headcountRule,
      upgradePriceMode: created.upgradePriceMode,
      upgradeGrantsBv: created.upgradeGrantsBv,
      upgradeTriggersDirectCommission: created.upgradeTriggersDirectCommission,
      upgradeEffectiveDaysOffset: created.upgradeEffectiveDaysOffset,
      upgradeEffectiveTimeSgt: created.upgradeEffectiveTimeSgt,
      directCommissionRateBps: created.directCommissionRateBps,
      pairingUnitBv: created.pairingUnitBv,
      pairingRewardPointsCents: created.pairingRewardPointsCents,
      withdrawalFeeRateBps: created.withdrawalFeeRateBps,
      withdrawalUsdRateMicros: created.withdrawalUsdRateMicros,
      isDemoRate: created.isDemoRate,
      productionPayoutEnabled: created.productionPayoutEnabled,
      usdtNetwork: created.usdtNetwork,
      usdtContractAddress: created.usdtContractAddress,
      usdtDepositAddress: created.usdtDepositAddress,
      usdtPayoutAddress: created.usdtPayoutAddress,
      usdtMinConfirmations: created.usdtMinConfirmations,
      usdtWithdrawalProcessingHours: created.usdtWithdrawalProcessingHours,
      usdtDepositsEnabled: created.usdtDepositsEnabled,
      usdtWithdrawalsEnabled: created.usdtWithdrawalsEnabled,
      directRewardCurrency: created.directRewardCurrency,
      directUsdtConversionMicros: created.directUsdtConversionMicros,
      directUsdtWithdrawalsEnabled: created.directUsdtWithdrawalsEnabled,
      changeNote: "Initial system defaults",
    },
  });
  return created;
}

/**
 * Awards direct referral bonus in either USDT (`referral_reward_ledgers`) or legacy
 * points (`wallet_ledgers`), strictly isolated from daily pairing cap and BV rollover.
 * Guarantees idempotency across retries and currency boundaries.
 */
async function awardDirectReferralRewardTx(params: {
  tx: Tx;
  lockedMembers: Map<string, LockedMemberRow>;
  sponsorId: string;
  sourceMemberId: string;
  sourceMemberCode: string;
  orderId: string;
  orderType: OrderType;
  commissionableBv: number;
  currentSgtDate: string;
  businessAt: Date;
  processedAt: Date;
  config: SystemConfig;
}): Promise<{ directCommissionCents: number; directRewardUsdtMicros: bigint }> {
  const { tx, lockedMembers, config, currentSgtDate, businessAt, processedAt } = params;
  if (params.commissionableBv <= 0) {
    return { directCommissionCents: 0, directRewardUsdtMicros: 0n };
  }

  let sponsor = lockedMembers.get(params.sponsorId);
  if (!sponsor || sponsor.status !== "ACTIVE") {
    return { directCommissionCents: 0, directRewardUsdtMicros: 0n };
  }

  sponsor = await ensureMemberChronologyTx(
    tx,
    sponsor,
    businessAt,
    config,
    processedAt,
    "LAZY_CATCHUP"
  );
  lockedMembers.set(sponsor.id, sponsor);

  const legacyEventKey = `direct_comm:${params.orderId}:${sponsor.id}`;
  const usdtEventKey = `direct_usdt:${params.orderId}:${sponsor.id}`;

  const [existingLegacy, existingUsdt] = await Promise.all([
    tx.walletLedger.findUnique({ where: { eventKey: legacyEventKey } }),
    tx.referralRewardLedger.findUnique({ where: { eventKey: usdtEventKey } }),
  ]);
  if (existingLegacy || existingUsdt) {
    return { directCommissionCents: 0, directRewardUsdtMicros: 0n };
  }

  const label =
    params.orderType === "UPGRADE"
      ? `Upgrade direct referral ${config.directCommissionRateBps / 100}% on ${params.commissionableBv} BV from ${params.sourceMemberCode}`
      : `Direct referral ${config.directCommissionRateBps / 100}% on ${params.commissionableBv} BV from ${params.sourceMemberCode}`;

  if (config.directRewardCurrency === "USDT") {
    const amountMicros = calculateDirectRewardUsdtMicros(
      params.commissionableBv,
      config.directCommissionRateBps,
      config.directUsdtConversionMicros
    );
    if (amountMicros > 0n) {
      await tx.referralRewardLedger.create({
        data: {
          rewardNo: makeDocNo("RR", currentSgtDate),
          eventKey: usdtEventKey,
          memberId: sponsor.id,
          sourceMemberId: params.sourceMemberId,
          orderId: params.orderId,
          currency: "USDT",
          baseBv: params.commissionableBv,
          rateBps: config.directCommissionRateBps,
          conversionMicros: config.directUsdtConversionMicros,
          amountMicros,
          status: "CREDITED",
          creditedAt: businessAt,
          note: label,
          createdAt: businessAt,
        },
      });
    }
    return { directCommissionCents: 0, directRewardUsdtMicros: amountMicros };
  }

  const directCommissionCents = calculateDirectCommissionCents(
    params.commissionableBv,
    config.directCommissionRateBps
  );
  if (directCommissionCents > 0) {
    sponsor.availablePointsCents += directCommissionCents;
    await tx.member.update({
      where: { id: sponsor.id },
      data: { availablePointsCents: sponsor.availablePointsCents },
    });
    await tx.walletLedger.create({
      data: {
        ledgerNo: makeDocNo("WL", currentSgtDate),
        eventKey: legacyEventKey,
        memberId: sponsor.id,
        entryType: "DIRECT_COMMISSION",
        deltaAvailableCents: directCommissionCents,
        deltaLockedCents: 0,
        availableAfterCents: sponsor.availablePointsCents,
        lockedAfterCents: sponsor.lockedPointsCents,
        orderId: params.orderId,
        note: label,
        createdAt: businessAt,
      },
    });
  }
  return { directCommissionCents, directRewardUsdtMicros: 0n };
}

/**
 * Records an idempotent reversal against a credited USDT direct referral reward.
 */
export async function reverseDirectReferralReward(params: {
  orderId: string;
  reason: string;
  operatorId?: string;
  asOf?: Date;
}) {
  const asOf = params.asOf ?? new Date();
  const sgtDate = getSgtDateString(asOf);

  return prisma.$transaction(async (tx) => {
    const credited = await tx.referralRewardLedger.findFirst({
      where: {
        orderId: params.orderId,
        currency: "USDT",
        status: "CREDITED",
      },
    });
    if (!credited) {
      throw new Error("No credited USDT referral reward found for this order");
    }

    const revEventKey = `direct_usdt_rev:${params.orderId}:${credited.memberId}`;
    const existing = await tx.referralRewardLedger.findUnique({
      where: { eventKey: revEventKey },
    });
    if (existing) {
      return existing;
    }

    const rev = await tx.referralRewardLedger.create({
      data: {
        rewardNo: makeDocNo("RR", sgtDate),
        eventKey: revEventKey,
        memberId: credited.memberId,
        sourceMemberId: credited.sourceMemberId,
        orderId: credited.orderId,
        currency: "USDT",
        baseBv: credited.baseBv,
        rateBps: credited.rateBps,
        conversionMicros: credited.conversionMicros,
        amountMicros: -credited.amountMicros,
        status: "REVERSED",
        creditedAt: asOf,
        note: params.reason.trim() || `Reversal for ${credited.rewardNo}`,
        createdAt: asOf,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: params.operatorId ?? null,
        actorRole: params.operatorId ? "ADMIN" : "SYSTEM",
        action: "REFERRAL_REWARD_REVERSED",
        entityType: "ReferralRewardLedger",
        entityId: rev.id,
        summary: `Reversed ${credited.rewardNo} (${rev.amountMicros.toString()} uUSDT): ${params.reason}`,
        metadata: {
          originalRewardId: credited.id,
          orderId: credited.orderId,
          amountMicros: rev.amountMicros.toString(),
        },
        createdAt: asOf,
      },
    });

    return rev;
  });
}

async function lockMembersInOrderTx(
  tx: Tx,
  memberIds: Array<string | null | undefined>
): Promise<Map<string, LockedMemberRow>> {
  const uniqueIds = Array.from(new Set(memberIds.filter((x): x is string => Boolean(x)))).sort();
  const map = new Map<string, LockedMemberRow>();
  if (uniqueIds.length === 0) return map;

  const rows = await tx.$queryRaw<LockedMemberRow[]>`
    SELECT
      id,
      "memberCode",
      email,
      "displayName",
      role,
      status,
      "sponsorId",
      "placementParentId",
      "placementLeg",
      "currentPackageCode",
      "dailyCapPointsCents",
      "pendingUpgradePackageCode",
      "pendingUpgradeEffectiveDate",
      "pendingUpgradeEffectiveAt",
      "pendingUpgradeOrderId",
      "leftBv",
      "rightBv",
      "activeSettlementDate",
      "todayPairedPointsCents",
      "availablePointsCents",
      "lockedPointsCents",
      "activatedAt"
    FROM members
    WHERE id = ANY(${uniqueIds}::text[])
    ORDER BY id ASC
    FOR UPDATE
  `;

  for (const row of rows) {
    map.set(row.id, row);
  }
  return map;
}

/**
 * Activates a member's due D+2 00:01:00 SGT upgrade inside an existing transaction
 * and immediately attempts catch-up pairing using BV still on the account at `effectiveAt`.
 */
async function activateScheduledUpgradeTx(
  tx: Tx,
  member: LockedMemberRow,
  config: SystemConfig,
  processedAt: Date,
  triggeredBy: "CRON" | "LAZY_CATCHUP" | "ADMIN_MANUAL"
): Promise<LockedMemberRow> {
  if (!member.pendingUpgradePackageCode || !member.pendingUpgradeEffectiveAt) {
    return member;
  }

  const businessEffectiveAt = member.pendingUpgradeEffectiveAt;
  const orderId = member.pendingUpgradeOrderId;
  const upgradedPkg = await tx.packageTier.findUnique({
    where: { code: member.pendingUpgradePackageCode },
  });

  let updated = { ...member };
  if (upgradedPkg) {
    const prevCode = updated.currentPackageCode;
    updated.currentPackageCode = upgradedPkg.code;
    updated.dailyCapPointsCents = upgradedPkg.dailyCapPointsCents;

    await tx.member.update({
      where: { id: updated.id },
      data: {
        currentPackageCode: updated.currentPackageCode,
        dailyCapPointsCents: updated.dailyCapPointsCents,
        pendingUpgradePackageCode: null,
        pendingUpgradeEffectiveDate: null,
        pendingUpgradeEffectiveAt: null,
        pendingUpgradeOrderId: null,
      },
    });

    if (orderId) {
      await tx.packageOrder.updateMany({
        where: { id: orderId, upgradeStatus: { in: ["WAITING_EFFECTIVE", "FAILED"] } },
        data: {
          upgradeStatus: "EFFECTIVE",
          upgradeProcessedAt: processedAt,
          upgradeFailureReason: null,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorRole: triggeredBy,
        action: "SCHEDULED_UPGRADE_ACTIVATED",
        entityType: "Member",
        entityId: updated.id,
        summary: `Upgrade ${prevCode ?? "NONE"} -> ${upgradedPkg.code} activated (effective ${getSgtDateString(businessEffectiveAt)} 00:01:00 SGT)`,
        metadata: {
          orderId,
          businessEffectiveAt: businessEffectiveAt.toISOString(),
          processedAt: processedAt.toISOString(),
          newDailyCapPointsCents: upgradedPkg.dailyCapPointsCents,
          ruleVersion: config.ruleVersion,
        },
        createdAt: processedAt,
      },
    });

    const pairingRes = await attemptBinaryPairingTx(
      tx,
      updated,
      config,
      "SCHEDULED_UPGRADE",
      `pair_scheduled_upgrade:${orderId ?? updated.id}:${updated.activeSettlementDate}`,
      orderId,
      businessEffectiveAt,
      processedAt
    );
    updated = pairingRes.member;
  } else {
    updated.pendingUpgradePackageCode = null;
    updated.pendingUpgradeEffectiveDate = null;
    updated.pendingUpgradeEffectiveAt = null;
    updated.pendingUpgradeOrderId = null;

    await tx.member.update({
      where: { id: updated.id },
      data: {
        pendingUpgradePackageCode: null,
        pendingUpgradeEffectiveDate: null,
        pendingUpgradeEffectiveAt: null,
        pendingUpgradeOrderId: null,
      },
    });
  }

  updated.pendingUpgradePackageCode = null;
  updated.pendingUpgradeEffectiveDate = null;
  updated.pendingUpgradeEffectiveAt = null;
  updated.pendingUpgradeOrderId = null;
  return updated;
}

/**
 * Replays chronological settlement milestones for an already row-locked member up to `businessAt`:
 * - For each past SGT day: activates any due 00:01 upgrade belonging to that day BEFORE midnight,
 *   then executes the 00:00:00 SGT EOD carryover/flush using boundary headcount & remaining BV.
 * - On `targetSgtDate`: if `pendingUpgradeEffectiveAt <= businessAt` (e.g. >= 00:01:00 SGT),
 *   activates the scheduled upgrade & runs catch-up pairing BEFORE processing `businessAt` BV.
 * - If `businessAt` is during 00:00:00 - 00:00:59 SGT, the upgrade stays pending so the old tier cap applies.
 */
export async function ensureMemberChronologyTx(
  tx: Tx,
  member: LockedMemberRow,
  businessAt: Date,
  config: SystemConfig,
  processedAt: Date,
  triggeredBy: "CRON" | "LAZY_CATCHUP" | "ADMIN_MANUAL"
): Promise<LockedMemberRow> {
  if (member.status !== "ACTIVE") {
    return member;
  }

  const targetSgtDate = getSgtDateString(businessAt);
  let current = { ...member };
  let guard = 0;

  while (current.activeSettlementDate < targetSgtDate && guard < 366) {
    guard++;
    const settlingDate = current.activeSettlementDate;
    const nextDate = addDaysToSgtDate(settlingDate, 1);
    const nextMidnightAt = makeSgtDate(nextDate, "00:00:00");

    // 1. If a scheduled upgrade fell during `settlingDate` (e.g. settlingDate 00:01:00 SGT)
    //    and has already reached its business effective time before `nextMidnightAt`, execute it first!
    if (
      current.pendingUpgradePackageCode &&
      current.pendingUpgradeEffectiveAt &&
      current.pendingUpgradeEffectiveAt < nextMidnightAt &&
      current.pendingUpgradeEffectiveAt <= businessAt
    ) {
      current = await activateScheduledUpgradeTx(
        tx,
        current,
        config,
        processedAt,
        triggeredBy
      );
    }

    // 2. Run 00:00:00 SGT EOD settlement for `settlingDate`
    const existingEod = await tx.dailySettlement.findUnique({
      where: {
        memberId_settlementDate: {
          memberId: current.id,
          settlementDate: settlingDate,
        },
      },
    });

    if (!existingEod) {
      const { leftCount, rightCount } = await countSubtreeActiveMembers(
        tx,
        current.id,
        nextMidnightAt
      );
      const decision = decideEodCarryover(
        current.leftBv,
        current.rightBv,
        leftCount,
        rightCount,
        config.tieBreakerRule
      );

      const eodRecord = await tx.dailySettlement.create({
        data: {
          settlementNo: makeDocNo("EOD", settlingDate),
          memberId: current.id,
          settlementDate: settlingDate,
          leftBvBefore: current.leftBv,
          rightBvBefore: current.rightBv,
          leftMemberCount: leftCount,
          rightMemberCount: rightCount,
          retainedSide: decision.retainedSide as RetainedSide,
          flushedSide: decision.flushedSide as RetainedSide,
          flushedBv: decision.flushedBv,
          leftBvAfter: decision.leftBvAfter,
          rightBvAfter: decision.rightBvAfter,
          decisionBasis: decision.decisionBasis,
          businessAt: nextMidnightAt,
          executedAt: processedAt,
          triggeredBy,
          ruleVersion: config.ruleVersion,
          ruleSnapshot: buildRuleSnapshot(config),
          createdAt: processedAt,
        },
      });

      if (decision.flushedBv > 0 && decision.flushedSide !== "NONE") {
        const flushedLeg: BinaryLeg = decision.flushedSide === "LEFT" ? "LEFT" : "RIGHT";
        await tx.bvLedger.create({
          data: {
            eventKey: `bv_eod_flush:${current.id}:${settlingDate}:${flushedLeg}`,
            memberId: current.id,
            leg: flushedLeg,
            entryType: "DEBIT_EOD_FLUSH",
            deltaBv: -decision.flushedBv,
            balanceAfterBv: 0,
            settlementDate: settlingDate,
            dailySettlementId: eodRecord.id,
            note: `00:00 SGT EOD flush (${decision.decisionBasis}, v${config.ruleVersion})`,
            createdAt: nextMidnightAt,
          },
        });
      }

      if (decision.retainedSide !== "NONE") {
        const retainedLeg: BinaryLeg = decision.retainedSide === "LEFT" ? "LEFT" : "RIGHT";
        const retainedBalance =
          retainedLeg === "LEFT" ? decision.leftBvAfter : decision.rightBvAfter;
        if (retainedBalance > 0) {
          await tx.bvLedger.create({
            data: {
              eventKey: `bv_eod_retain:${current.id}:${settlingDate}:${retainedLeg}`,
              memberId: current.id,
              leg: retainedLeg,
              entryType: "CARRYOVER_RETAIN",
              deltaBv: 0,
              balanceAfterBv: retainedBalance,
              settlementDate: settlingDate,
              dailySettlementId: eodRecord.id,
              note: `00:00 SGT carryover retained (${decision.decisionBasis}, v${config.ruleVersion})`,
              createdAt: nextMidnightAt,
            },
          });
        }
      }

      current.leftBv = decision.leftBvAfter;
      current.rightBv = decision.rightBvAfter;

      await tx.auditLog.create({
        data: {
          actorRole: triggeredBy,
          action: "EOD_SETTLEMENT",
          entityType: "DailySettlement",
          entityId: eodRecord.id,
          summary: `EOD ${settlingDate} for ${current.memberCode}: retained ${decision.retainedSide}, flushed ${decision.flushedBv} BV (${decision.decisionBasis})`,
          metadata: {
            memberId: current.id,
            settlementDate: settlingDate,
            businessAt: nextMidnightAt.toISOString(),
            processedAt: processedAt.toISOString(),
            leftBvBefore: eodRecord.leftBvBefore,
            rightBvBefore: eodRecord.rightBvBefore,
            leftCount,
            rightCount,
            retainedSide: decision.retainedSide,
            flushedBv: decision.flushedBv,
            ruleVersion: config.ruleVersion,
          },
          createdAt: processedAt,
        },
      });
    }

    current.activeSettlementDate = nextDate;
    current.todayPairedPointsCents = 0;

    await tx.member.update({
      where: { id: current.id },
      data: {
        leftBv: current.leftBv,
        rightBv: current.rightBv,
        activeSettlementDate: current.activeSettlementDate,
        todayPairedPointsCents: current.todayPairedPointsCents,
      },
    });
  }

  // 3. Now `current.activeSettlementDate >= targetSgtDate`.
  //    If a scheduled upgrade has reached its exact D+2 00:01:00 SGT business time (<= businessAt),
  //    activate it now and run catch-up pairing BEFORE any later BV event at `businessAt`!
  if (
    current.pendingUpgradePackageCode &&
    current.pendingUpgradeEffectiveAt &&
    current.pendingUpgradeEffectiveAt <= businessAt
  ) {
    current = await activateScheduledUpgradeTx(
      tx,
      current,
      config,
      processedAt,
      triggeredBy
    );
  }

  return current;
}

/**
 * Attempts instant binary pairing for a locked member inside a transaction.
 */
export async function attemptBinaryPairingTx(
  tx: Tx,
  member: LockedMemberRow,
  config: SystemConfig,
  triggerType: "ORDER_BV" | "SCHEDULED_UPGRADE" | "MANUAL_CATCHUP",
  eventKey: string,
  triggerOrderId: string | null,
  businessAt: Date,
  processedAt: Date
): Promise<{
  member: LockedMemberRow;
  pairingId: string | null;
  pairsCount: number;
  pointsAwardedCents: number;
}> {
  if (member.status !== "ACTIVE" || member.dailyCapPointsCents <= 0) {
    return { member, pairingId: null, pairsCount: 0, pointsAwardedCents: 0 };
  }

  const existingPairing = await tx.binaryPairingSettlement.findUnique({
    where: { eventKey },
  });
  if (existingPairing) {
    return {
      member,
      pairingId: existingPairing.id,
      pairsCount: existingPairing.pairsCount,
      pointsAwardedCents: existingPairing.pointsAwardedCents,
    };
  }

  const calc = calculatePairingResult({
    leftBv: member.leftBv,
    rightBv: member.rightBv,
    dailyCapPointsCents: member.dailyCapPointsCents,
    todayPairedPointsCents: member.todayPairedPointsCents,
    pairingUnitBv: config.pairingUnitBv,
    pairingRewardPointsCents: config.pairingRewardPointsCents,
  });

  if (calc.pairsCount <= 0) {
    return { member, pairingId: null, pairsCount: 0, pointsAwardedCents: 0 };
  }

  const sgtDate = member.activeSettlementDate;
  const pairing = await tx.binaryPairingSettlement.create({
    data: {
      settlementNo: makeDocNo("BP", sgtDate),
      eventKey,
      memberId: member.id,
      settlementDate: sgtDate,
      triggerType,
      triggerOrderId,
      pairsCount: calc.pairsCount,
      bvDeductedPerLeg: calc.bvDeductedPerLeg,
      pointsAwardedCents: calc.pointsAwardedCents,
      leftBvBefore: member.leftBv,
      rightBvBefore: member.rightBv,
      leftBvAfter: calc.leftBvAfter,
      rightBvAfter: calc.rightBvAfter,
      dailyCapPointsCents: member.dailyCapPointsCents,
      dailyPairedBeforeCents: member.todayPairedPointsCents,
      dailyPairedAfterCents: calc.dailyPairedAfterCents,
      businessAt,
      ruleVersion: config.ruleVersion,
      ruleSnapshot: buildRuleSnapshot(config),
      createdAt: processedAt,
    },
  });

  const updatedMember: LockedMemberRow = {
    ...member,
    leftBv: calc.leftBvAfter,
    rightBv: calc.rightBvAfter,
    todayPairedPointsCents: calc.dailyPairedAfterCents,
    availablePointsCents: member.availablePointsCents + calc.pointsAwardedCents,
  };

  await tx.member.update({
    where: { id: member.id },
    data: {
      leftBv: updatedMember.leftBv,
      rightBv: updatedMember.rightBv,
      todayPairedPointsCents: updatedMember.todayPairedPointsCents,
      availablePointsCents: updatedMember.availablePointsCents,
    },
  });

  await tx.bvLedger.createMany({
    data: [
      {
        eventKey: `bv_pair:${pairing.id}:LEFT`,
        memberId: member.id,
        leg: "LEFT",
        entryType: "DEBIT_PAIRING",
        deltaBv: -calc.bvDeductedPerLeg,
        balanceAfterBv: updatedMember.leftBv,
        settlementDate: sgtDate,
        orderId: triggerOrderId,
        pairingSettlementId: pairing.id,
        note: `Binary pairing (${calc.pairsCount} pairs)`,
        createdAt: businessAt,
      },
      {
        eventKey: `bv_pair:${pairing.id}:RIGHT`,
        memberId: member.id,
        leg: "RIGHT",
        entryType: "DEBIT_PAIRING",
        deltaBv: -calc.bvDeductedPerLeg,
        balanceAfterBv: updatedMember.rightBv,
        settlementDate: sgtDate,
        orderId: triggerOrderId,
        pairingSettlementId: pairing.id,
        note: `Binary pairing (${calc.pairsCount} pairs)`,
        createdAt: businessAt,
      },
    ],
  });

  await tx.walletLedger.create({
    data: {
      ledgerNo: makeDocNo("WL", sgtDate),
      eventKey: `wallet_pair:${pairing.id}`,
      memberId: member.id,
      entryType: "BINARY_PAIRING",
      deltaAvailableCents: calc.pointsAwardedCents,
      deltaLockedCents: 0,
      availableAfterCents: updatedMember.availablePointsCents,
      lockedAfterCents: updatedMember.lockedPointsCents,
      orderId: triggerOrderId,
      pairingSettlementId: pairing.id,
      note: `Binary pairing ${calc.pairsCount} pair(s) on ${sgtDate} SGT`,
      createdAt: businessAt,
    },
  });

  return {
    member: updatedMember,
    pairingId: pairing.id,
    pairsCount: calc.pairsCount,
    pointsAwardedCents: calc.pointsAwardedCents,
  };
}

/**
 * Credits BV to an ancestor's specified leg inside an existing transaction (idempotent per order+member).
 */
async function creditOrderBvAndPairTx(params: {
  tx: Tx;
  lockedMembers: Map<string, LockedMemberRow>;
  ancestorId: string;
  leg: BinaryLeg;
  bvAmount: number;
  orderId: string;
  sourceMemberId: string;
  sourceMemberCode: string;
  businessAt: Date;
  processedAt: Date;
  config: SystemConfig;
}): Promise<{ pairingId: string | null }> {
  const {
    tx,
    lockedMembers,
    ancestorId,
    leg,
    bvAmount,
    orderId,
    sourceMemberId,
    sourceMemberCode,
    businessAt,
    processedAt,
    config,
  } = params;

  let ancestor = lockedMembers.get(ancestorId);
  if (!ancestor || ancestor.status !== "ACTIVE") {
    return { pairingId: null };
  }

  // Chronological catch-up: 00:00 EOD and any due 00:01 upgrade execute BEFORE `businessAt` BV!
  ancestor = await ensureMemberChronologyTx(
    tx,
    ancestor,
    businessAt,
    config,
    processedAt,
    "LAZY_CATCHUP"
  );

  const currentSgtDate = getSgtDateString(businessAt);
  const bvEventKey = `bv_order:${orderId}:${ancestor.id}`;
  const existingBv = await tx.bvLedger.findUnique({ where: { eventKey: bvEventKey } });
  if (existingBv) {
    lockedMembers.set(ancestor.id, ancestor);
    return { pairingId: null };
  }

  if (leg === "LEFT") {
    ancestor.leftBv += bvAmount;
  } else {
    ancestor.rightBv += bvAmount;
  }

  const balanceAfterBv = leg === "LEFT" ? ancestor.leftBv : ancestor.rightBv;

  await tx.member.update({
    where: { id: ancestor.id },
    data: {
      leftBv: ancestor.leftBv,
      rightBv: ancestor.rightBv,
    },
  });

  await tx.bvLedger.create({
    data: {
      eventKey: bvEventKey,
      memberId: ancestor.id,
      leg,
      entryType: "CREDIT_ORDER",
      deltaBv: bvAmount,
      balanceAfterBv,
      settlementDate: currentSgtDate,
      orderId,
      sourceMemberId,
      note: `Order BV from ${sourceMemberCode} (${leg} leg)`,
      createdAt: businessAt,
    },
  });

  const pairingRes = await attemptBinaryPairingTx(
    tx,
    ancestor,
    config,
    "ORDER_BV",
    `pair_order:${orderId}:${ancestor.id}`,
    orderId,
    businessAt,
    processedAt
  );

  lockedMembers.set(ancestor.id, pairingRes.member);
  return { pairingId: pairingRes.pairingId };
}

/**
 * Creates an INITIAL or UPGRADE package order with server-computed pricing, BV, and commissionable BV.
 */
export async function createPackageOrder(params: {
  memberId: string;
  orderType: OrderType;
  targetPackageCode: string;
  payImmediatelyDemo?: boolean;
  paymentMethod?: "USDT" | "MANUAL";
  placementParentId?: string | null;
  placementLeg?: BinaryLeg | null;
  asOf?: Date;
}) {
  const asOf = params.asOf ?? new Date();
  const sgtDate = getSgtDateString(asOf);

  return prisma.$transaction(async (tx) => {
    const config = await getOrCreateConfigTx(tx);
    const paymentMethod = params.paymentMethod ?? "USDT";
    const paidDemo = Boolean(params.payImmediatelyDemo);

    if (!paidDemo && paymentMethod === "USDT" && !isUsdtDepositConfigured(config)) {
      throw new Error("USDT deposit service is temporarily unavailable");
    }

    const member = await tx.member.findUnique({ where: { id: params.memberId } });
    if (!member) throw new Error("Member not found");

    const targetPkg = await tx.packageTier.findUnique({
      where: { code: params.targetPackageCode },
    });
    if (!targetPkg || !targetPkg.isActive) {
      throw new Error("Invalid or inactive target package");
    }

    const targetUsdtMicros =
      targetPkg.priceUsdtMicros > 0n
        ? targetPkg.priceUsdtMicros
        : usdCentsToUsdtMicros(targetPkg.priceUsdCents);

    let amountUsdCents = targetPkg.priceUsdCents;
    let expectedUsdtMicros = targetUsdtMicros;
    let bvAmount = targetPkg.bv;
    let commissionableBv = targetPkg.bv;
    let previousPackageCode: string | null = null;

    if (params.orderType === "INITIAL") {
      if (member.status === "ACTIVE" && member.currentPackageCode) {
        throw new Error("Member is already active with a package; use UPGRADE");
      }
    } else {
      if (member.status !== "ACTIVE" || !member.currentPackageCode) {
        throw new Error("Member must be active before upgrading");
      }
      if (member.pendingUpgradePackageCode) {
        throw new Error(
          `An upgrade to ${member.pendingUpgradePackageCode} is already waiting to take effect on ${member.pendingUpgradeEffectiveDate} 00:01:00 SGT`
        );
      }
      const existingPendingOrder = await tx.packageOrder.findFirst({
        where: {
          memberId: member.id,
          orderType: "UPGRADE",
          status: "PENDING_CONFIRMATION",
        },
      });
      if (existingPendingOrder) {
        throw new Error(`Upgrade order ${existingPendingOrder.orderNo} is already pending confirmation`);
      }

      const currentPkg = await tx.packageTier.findUnique({
        where: { code: member.currentPackageCode },
      });
      if (!currentPkg) throw new Error("Current package not found");
      if (targetPkg.sortOrder <= currentPkg.sortOrder) {
        throw new Error("Upgrade target package must be higher than current package");
      }

      const currentUsdtMicros =
        currentPkg.priceUsdtMicros > 0n
          ? currentPkg.priceUsdtMicros
          : usdCentsToUsdtMicros(currentPkg.priceUsdCents);

      previousPackageCode = currentPkg.code;
      amountUsdCents =
        config.upgradePriceMode === "DIFFERENCE"
          ? Math.max(0, targetPkg.priceUsdCents - currentPkg.priceUsdCents)
          : targetPkg.priceUsdCents;

      expectedUsdtMicros =
        config.upgradePriceMode === "DIFFERENCE"
          ? targetUsdtMicros > currentUsdtMicros
            ? targetUsdtMicros - currentUsdtMicros
            : 0n
          : targetUsdtMicros;

      bvAmount = config.upgradeGrantsBv
        ? config.upgradePriceMode === "DIFFERENCE"
          ? Math.max(0, targetPkg.bv - currentPkg.bv)
          : targetPkg.bv
        : 0;

      commissionableBv = config.upgradeTriggersDirectCommission
        ? config.upgradeGrantsBv
          ? bvAmount
          : Math.max(0, targetPkg.bv - currentPkg.bv)
        : 0;
    }

    const order = await tx.packageOrder.create({
      data: {
        orderNo: makeDocNo("ORD", sgtDate),
        memberId: member.id,
        orderType: params.orderType,
        targetPackageCode: targetPkg.code,
        previousPackageCode,
        amountUsdCents,
        bvAmount,
        commissionableBv,
        paymentMethod,
        usdtNetwork: config.usdtNetwork || null,
        usdtContractAddress: config.usdtContractAddress || null,
        usdtDepositAddress: config.usdtDepositAddress || null,
        expectedUsdtMicros,
        paymentStatus: paidDemo ? "PAID_DEMO" : "UNPAID",
        paymentRef: paidDemo ? `PAY-${Date.now()}` : null,
        paidAt: paidDemo ? asOf : null,
        depositVerifyStatus: paidDemo ? "MATCHED_CONFIRMED" : "AWAITING_TX",
        status: "PENDING_CONFIRMATION",
        upgradeStatus: "NOT_APPLICABLE",
        requestedPlacementParentId: params.placementParentId ?? null,
        requestedPlacementLeg: params.placementLeg ?? null,
        ruleVersion: config.ruleVersion,
        createdAt: asOf,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: member.id,
        actorRole: member.role,
        action: "ORDER_CREATE",
        entityType: "PackageOrder",
        entityId: order.id,
        summary: `Created ${order.orderType} order ${order.orderNo} for ${targetPkg.code} (${expectedUsdtMicros.toString()} uUSDT)`,
        metadata: {
          orderType: order.orderType,
          targetPackageCode: targetPkg.code,
          amountUsdCents,
          expectedUsdtMicros: expectedUsdtMicros.toString(),
          usdtNetwork: config.usdtNetwork,
          usdtDepositAddress: config.usdtDepositAddress,
          bvAmount,
          commissionableBv,
          ruleVersion: config.ruleVersion,
        },
        createdAt: asOf,
      },
    });

    return order;
  });
}

/**
 * Allows admin to assign or update candidate binary placement on an unconfirmed INITIAL order.
 */
export async function assignOrderPlacement(params: {
  orderId: string;
  placementParentId: string;
  placementLeg: BinaryLeg;
  operatorId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.packageOrder.findUnique({ where: { id: params.orderId } });
    if (!order) throw new Error("Order not found");
    if (order.status === "CONFIRMED") {
      throw new Error("Cannot change placement on an already confirmed order");
    }
    if (order.orderType !== "INITIAL") {
      throw new Error("Placement is only applicable to INITIAL package orders");
    }
    if (params.placementParentId === order.memberId) {
      throw new Error("Member cannot be placed under themselves");
    }

    const parent = await tx.member.findUnique({ where: { id: params.placementParentId } });
    if (!parent || parent.status !== "ACTIVE") {
      throw new Error("Placement parent must exist and be ACTIVE");
    }

    const occupied = await tx.member.findFirst({
      where: {
        placementParentId: params.placementParentId,
        placementLeg: params.placementLeg,
      },
    });
    if (occupied) {
      throw new Error(
        `Slot ${params.placementLeg} under ${parent.memberCode} is already occupied by ${occupied.memberCode}`
      );
    }

    const updated = await tx.packageOrder.update({
      where: { id: order.id },
      data: {
        requestedPlacementParentId: params.placementParentId,
        requestedPlacementLeg: params.placementLeg,
        failureReason: null,
        status: order.status === "FAILED" ? "PENDING_CONFIRMATION" : order.status,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: params.operatorId,
        actorRole: "ADMIN",
        action: "PLACEMENT_ASSIGN",
        entityType: "PackageOrder",
        entityId: order.id,
        summary: `Assigned placement ${parent.memberCode} [${params.placementLeg}] to order ${order.orderNo}`,
        metadata: {
          placementParentId: params.placementParentId,
          placementParentCode: parent.memberCode,
          placementLeg: params.placementLeg,
        },
      },
    });

    return updated;
  });
}

/**
 * Atomically validates and confirms a package order (INITIAL or UPGRADE):
 * - Idempotent on repeated confirmation of an already CONFIRMED order.
 * - INITIAL: activates member, places node (protected by unique index + FOR UPDATE), issues direct commission,
 *   propagates BV upward, and runs instant binary pairing.
 * - UPGRADE: schedules new tier for D+2 00:01:00 SGT (status WAITING_EFFECTIVE), keeping existing daily cap
 *   until D+2 00:01:00 SGT (after D+2 00:00:00 SGT EOD completes).
 */
export interface ConfirmOrderParams {
  orderId: string;
  operatorId?: string | null;
  placementParentId?: string | null;
  placementLeg?: BinaryLeg | null;
  markPaidDemo?: boolean;
  asOf?: Date;
  processedAt?: Date;
}

export async function confirmPackageOrder(
  params: ConfirmOrderParams
): Promise<ConfirmOrderResult> {
  return prisma.$transaction((tx) => confirmPackageOrderTx(tx, params));
}

export async function confirmPackageOrderTx(
  tx: Tx,
  params: ConfirmOrderParams
): Promise<ConfirmOrderResult> {
  const businessAt = params.asOf ?? new Date();
  const processedAt = params.processedAt ?? businessAt;
  const currentSgtDate = getSgtDateString(businessAt);

    const lockedOrders = await tx.$queryRaw<
      Array<{
        id: string;
        orderNo: string;
        memberId: string;
        orderType: OrderType;
        targetPackageCode: string;
        previousPackageCode: string | null;
        amountUsdCents: number;
        bvAmount: number;
        commissionableBv: number;
        paymentStatus: "UNPAID" | "PAID_DEMO" | "PAID";
        status: "PENDING_CONFIRMATION" | "CONFIRMED" | "FAILED" | "CANCELLED";
        upgradeStatus: "NOT_APPLICABLE" | "WAITING_EFFECTIVE" | "EFFECTIVE";
        requestedPlacementParentId: string | null;
        requestedPlacementLeg: BinaryLeg | null;
        effectiveSgtDate: string | null;
        effectiveAt: Date | null;
      }>
    >`
      SELECT
        id, "orderNo", "memberId", "orderType", "targetPackageCode", "previousPackageCode",
        "amountUsdCents", "bvAmount", "commissionableBv", "paymentStatus", status,
        "upgradeStatus", "requestedPlacementParentId", "requestedPlacementLeg",
        "effectiveSgtDate", "effectiveAt"
      FROM package_orders
      WHERE id = ${params.orderId}
      FOR UPDATE
    `;

    const order = lockedOrders[0];
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status === "CONFIRMED") {
      return {
        ok: true,
        idempotent: true,
        orderId: order.id,
        orderNo: order.orderNo,
        effectiveSgtDate: order.effectiveSgtDate,
        effectiveAt: order.effectiveAt,
        upgradeStatus: order.upgradeStatus,
      };
    }

    if (order.status === "CANCELLED") {
      return {
        ok: false,
        orderId: order.id,
        orderNo: order.orderNo,
        reason: "Order is cancelled",
      };
    }

    const failOrder = async (reason: string): Promise<ConfirmOrderResult> => {
      await tx.packageOrder.update({
        where: { id: order.id },
        data: {
          status: "FAILED",
          failureReason: reason,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: params.operatorId ?? null,
          actorRole: params.operatorId ? "ADMIN" : "SYSTEM",
          action: "ORDER_CONFIRM_FAILED",
          entityType: "PackageOrder",
          entityId: order.id,
          summary: `Order ${order.orderNo} confirmation failed: ${reason}`,
          metadata: { reason, orderType: order.orderType },
          createdAt: processedAt,
        },
      });
      return {
        ok: false,
        orderId: order.id,
        orderNo: order.orderNo,
        reason,
      };
    };

    const effectivePaymentStatus =
      params.markPaidDemo && order.paymentStatus === "UNPAID" ? "PAID_DEMO" : order.paymentStatus;

    if (effectivePaymentStatus === "UNPAID") {
      return failOrder("Payment status is UNPAID; payment must be completed before confirmation");
    }

    if (params.markPaidDemo && order.paymentStatus === "UNPAID") {
      await tx.packageOrder.update({
        where: { id: order.id },
        data: {
          paymentStatus: "PAID_DEMO",
          paymentRef: `ADMIN-PAY-${Date.now()}`,
          paidAt: businessAt,
        },
      });
    }

    const config = await getOrCreateConfigTx(tx);
    const targetPkg = await tx.packageTier.findUnique({
      where: { code: order.targetPackageCode },
    });
    if (!targetPkg || !targetPkg.isActive) {
      return failOrder(`Target package ${order.targetPackageCode} is invalid or inactive`);
    }

    const rawMember = await tx.member.findUnique({ where: { id: order.memberId } });
    if (!rawMember) {
      return failOrder("Member record not found");
    }
    if (rawMember.status === "CANCELLED" || rawMember.status === "SUSPENDED") {
      return failOrder(`Member status is ${rawMember.status}`);
    }

    if (order.orderType === "INITIAL") {
      if (rawMember.status === "ACTIVE" && rawMember.currentPackageCode) {
        return failOrder("Member is already active; cannot confirm another INITIAL order");
      }

      const activeMemberCount = await tx.member.count({ where: { status: "ACTIVE" } });
      const isRootActivation = activeMemberCount === 0 && !rawMember.sponsorId;

      const resolvedParentId =
        params.placementParentId ?? order.requestedPlacementParentId ?? null;
      const resolvedLeg = params.placementLeg ?? order.requestedPlacementLeg ?? null;

      if (!isRootActivation) {
        if (!rawMember.sponsorId) {
          return failOrder("Member has no direct sponsor assigned");
        }
        const sponsorCheck = await tx.member.findUnique({ where: { id: rawMember.sponsorId } });
        if (!sponsorCheck || sponsorCheck.status !== "ACTIVE") {
          return failOrder("Direct sponsor does not exist or is not ACTIVE");
        }

        if (!resolvedParentId || !resolvedLeg) {
          return failOrder(
            "Binary placement parent and leg (LEFT/RIGHT) must be specified before confirmation"
          );
        }
        if (resolvedParentId === rawMember.id) {
          return failOrder("Member cannot be placed under themselves");
        }

        const parentCheck = await tx.member.findUnique({ where: { id: resolvedParentId } });
        if (!parentCheck || parentCheck.status !== "ACTIVE") {
          return failOrder("Placement parent does not exist or is not ACTIVE");
        }
      }

      const ancestorSteps =
        resolvedParentId && resolvedLeg
          ? await getPlacementAncestorPath(tx, resolvedParentId, resolvedLeg)
          : [];

      const idsToLock = [
        rawMember.id,
        rawMember.sponsorId,
        resolvedParentId,
        ...ancestorSteps.map((s) => s.ancestorId),
      ];
      const lockedMembers = await lockMembersInOrderTx(tx, idsToLock);
      const lockedTargetMember = lockedMembers.get(rawMember.id)!;

      if (!isRootActivation && resolvedParentId && resolvedLeg) {
        const occupied = await tx.member.findFirst({
          where: {
            placementParentId: resolvedParentId,
            placementLeg: resolvedLeg,
          },
          select: { id: true, memberCode: true },
        });
        if (occupied) {
          const parentLocked = lockedMembers.get(resolvedParentId);
          return failOrder(
            `Placement slot ${resolvedLeg} under ${parentLocked?.memberCode ?? resolvedParentId} is already occupied by ${occupied.memberCode}`
          );
        }
      }

      await tx.member.update({
        where: { id: lockedTargetMember.id },
        data: {
          status: "ACTIVE",
          currentPackageCode: targetPkg.code,
          dailyCapPointsCents: targetPkg.dailyCapPointsCents,
          placementParentId: isRootActivation ? null : resolvedParentId,
          placementLeg: isRootActivation ? null : resolvedLeg,
          placedAt: isRootActivation ? null : businessAt,
          placedById: isRootActivation ? null : (params.operatorId ?? null),
          activatedAt: businessAt,
          activeSettlementDate: currentSgtDate,
          todayPairedPointsCents: 0,
        },
      });

      let directCommissionCents = 0;
      let directRewardUsdtMicros = 0n;
      if (lockedTargetMember.sponsorId && order.commissionableBv > 0) {
        const directRes = await awardDirectReferralRewardTx({
          tx,
          lockedMembers,
          sponsorId: lockedTargetMember.sponsorId,
          sourceMemberId: lockedTargetMember.id,
          sourceMemberCode: lockedTargetMember.memberCode,
          orderId: order.id,
          orderType: "INITIAL",
          commissionableBv: order.commissionableBv,
          currentSgtDate,
          businessAt,
          processedAt,
          config,
        });
        directCommissionCents = directRes.directCommissionCents;
        directRewardUsdtMicros = directRes.directRewardUsdtMicros;
      }

      let pairingSettlementsCount = 0;
      if (order.bvAmount > 0 && ancestorSteps.length > 0) {
        for (const step of ancestorSteps) {
          const res = await creditOrderBvAndPairTx({
            tx,
            lockedMembers,
            ancestorId: step.ancestorId,
            leg: step.leg,
            bvAmount: order.bvAmount,
            orderId: order.id,
            sourceMemberId: lockedTargetMember.id,
            sourceMemberCode: lockedTargetMember.memberCode,
            businessAt,
            processedAt,
            config,
          });
          if (res.pairingId) pairingSettlementsCount++;
        }
      }

      await tx.packageOrder.update({
        where: { id: order.id },
        data: {
          status: "CONFIRMED",
          upgradeStatus: "NOT_APPLICABLE",
          failureReason: null,
          confirmedAt: businessAt,
          confirmedById: params.operatorId ?? null,
          effectiveSgtDate: currentSgtDate,
          effectiveAt: businessAt,
          isSameDayEffective: true,
          ruleVersion: config.ruleVersion,
          requestedPlacementParentId: isRootActivation ? null : resolvedParentId,
          requestedPlacementLeg: isRootActivation ? null : resolvedLeg,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: params.operatorId ?? null,
          actorRole: params.operatorId ? "ADMIN" : "SYSTEM",
          action: "ORDER_CONFIRM",
          entityType: "PackageOrder",
          entityId: order.id,
          summary: `Confirmed INITIAL order ${order.orderNo} for ${lockedTargetMember.memberCode} (${targetPkg.code}, ${order.bvAmount} BV)`,
          metadata: {
            memberId: lockedTargetMember.id,
            packageCode: targetPkg.code,
            placementParentId: resolvedParentId,
            placementLeg: resolvedLeg,
            directCommissionCents,
            pairingSettlementsCount,
            businessAt: businessAt.toISOString(),
            processedAt: processedAt.toISOString(),
            ruleVersion: config.ruleVersion,
          },
          createdAt: processedAt,
        },
      });

      return {
        ok: true,
        orderId: order.id,
        orderNo: order.orderNo,
        effectiveSgtDate: currentSgtDate,
        effectiveAt: businessAt,
        upgradeStatus: "NOT_APPLICABLE",
        directCommissionCents,
        directRewardUsdtMicros: directRewardUsdtMicros.toString(),
        pairingSettlementsCount,
      };
    }

    // UPGRADE Order: Always D+2 at 00:01:00 SGT!
    if (rawMember.status !== "ACTIVE" || !rawMember.currentPackageCode) {
      return failOrder("Member must be ACTIVE with an existing package to upgrade");
    }
    const currentPkg = await tx.packageTier.findUnique({
      where: { code: rawMember.currentPackageCode },
    });
    if (!currentPkg || targetPkg.sortOrder <= currentPkg.sortOrder) {
      return failOrder("Target upgrade package must be strictly higher than current package");
    }

    const ancestorSteps =
      order.bvAmount > 0 && rawMember.placementParentId && rawMember.placementLeg
        ? await getPlacementAncestorPath(tx, rawMember.placementParentId, rawMember.placementLeg)
        : [];

    const idsToLock = [
      rawMember.id,
      order.commissionableBv > 0 ? rawMember.sponsorId : null,
      ...ancestorSteps.map((s) => s.ancestorId),
    ];
    const lockedMembers = await lockMembersInOrderTx(tx, idsToLock);
    let member = lockedMembers.get(rawMember.id)!;

    // Advance member chronology up to `businessAt` before scheduling the new upgrade
    member = await ensureMemberChronologyTx(
      tx,
      member,
      businessAt,
      config,
      processedAt,
      "LAZY_CATCHUP"
    );

    if (member.pendingUpgradePackageCode) {
      return failOrder(
        `Member already has a pending upgrade (${member.pendingUpgradePackageCode}) effective ${member.pendingUpgradeEffectiveDate} 00:01:00 SGT`
      );
    }

    const schedule = getUpgradeEffectiveScheduleSgt(
      businessAt,
      config.upgradeEffectiveDaysOffset,
      config.upgradeEffectiveTimeSgt
    );

    member.pendingUpgradePackageCode = targetPkg.code;
    member.pendingUpgradeEffectiveDate = schedule.effectiveSgtDate;
    member.pendingUpgradeEffectiveAt = schedule.effectiveAt;
    member.pendingUpgradeOrderId = order.id;

    await tx.member.update({
      where: { id: member.id },
      data: {
        pendingUpgradePackageCode: member.pendingUpgradePackageCode,
        pendingUpgradeEffectiveDate: member.pendingUpgradeEffectiveDate,
        pendingUpgradeEffectiveAt: member.pendingUpgradeEffectiveAt,
        pendingUpgradeOrderId: member.pendingUpgradeOrderId,
      },
    });

    let directCommissionCents = 0;
    let directRewardUsdtMicros = 0n;
    if (order.commissionableBv > 0 && member.sponsorId) {
      const directRes = await awardDirectReferralRewardTx({
        tx,
        lockedMembers,
        sponsorId: member.sponsorId,
        sourceMemberId: member.id,
        sourceMemberCode: member.memberCode,
        orderId: order.id,
        orderType: "UPGRADE",
        commissionableBv: order.commissionableBv,
        currentSgtDate,
        businessAt,
        processedAt,
        config,
      });
      directCommissionCents = directRes.directCommissionCents;
      directRewardUsdtMicros = directRes.directRewardUsdtMicros;
    }

    let pairingSettlementsCount = 0;
    if (order.bvAmount > 0 && ancestorSteps.length > 0) {
      for (const step of ancestorSteps) {
        const res = await creditOrderBvAndPairTx({
          tx,
          lockedMembers,
          ancestorId: step.ancestorId,
          leg: step.leg,
          bvAmount: order.bvAmount,
          orderId: order.id,
          sourceMemberId: member.id,
          sourceMemberCode: member.memberCode,
          businessAt,
          processedAt,
          config,
        });
        if (res.pairingId) pairingSettlementsCount++;
      }
    }

    await tx.packageOrder.update({
      where: { id: order.id },
      data: {
        status: "CONFIRMED",
        upgradeStatus: "WAITING_EFFECTIVE",
        failureReason: null,
        confirmedAt: businessAt,
        confirmedById: params.operatorId ?? null,
        effectiveSgtDate: schedule.effectiveSgtDate,
        effectiveAt: schedule.effectiveAt,
        isSameDayEffective: false,
        ruleVersion: config.ruleVersion,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: params.operatorId ?? null,
        actorRole: params.operatorId ? "ADMIN" : "SYSTEM",
        action: "ORDER_CONFIRM",
        entityType: "PackageOrder",
        entityId: order.id,
        summary: `Confirmed UPGRADE order ${order.orderNo} for ${member.memberCode} -> ${targetPkg.code} (waiting effective ${schedule.effectiveSgtLabel})`,
        metadata: {
          memberId: member.id,
          previousPackageCode: currentPkg.code,
          targetPackageCode: targetPkg.code,
          confirmedAt: businessAt.toISOString(),
          effectiveSgtDate: schedule.effectiveSgtDate,
          effectiveAt: schedule.effectiveAt.toISOString(),
          processedAt: processedAt.toISOString(),
          ruleVersion: config.ruleVersion,
        },
        createdAt: processedAt,
      },
    });

    return {
      ok: true,
      orderId: order.id,
      orderNo: order.orderNo,
      effectiveSgtDate: schedule.effectiveSgtDate,
      effectiveAt: schedule.effectiveAt,
      upgradeStatus: "WAITING_EFFECTIVE",
      directCommissionCents,
      directRewardUsdtMicros: directRewardUsdtMicros.toString(),
      pairingSettlementsCount,
    };
}

/**
 * Runs 00:00 SGT EOD settlement for all active members whose activeSettlementDate < targetCurrentSgtDate.
 * Idempotent: re-running for the same date will not flush BV again.
 */
export async function runEodSettlement(params?: {
  targetCurrentSgtDate?: string;
  asOf?: Date;
  processedAt?: Date;
  triggeredBy?: "CRON" | "ADMIN_MANUAL";
}): Promise<{
  targetCurrentSgtDate: string;
  membersProcessed: number;
  settlementsCreated: number;
}> {
  const businessAt = params?.asOf ?? new Date();
  const targetCurrentSgtDate = params?.targetCurrentSgtDate ?? getSgtDateString(businessAt);
  const effectiveBusinessAt = params?.asOf ?? makeSgtDate(targetCurrentSgtDate, "00:00:00");
  const processedAt = params?.processedAt ?? new Date();
  const triggeredBy = params?.triggeredBy ?? "CRON";

  const candidateMembers = await prisma.member.findMany({
    where: {
      status: "ACTIVE",
      activeSettlementDate: { lt: targetCurrentSgtDate },
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  let settlementsCreated = 0;

  for (const candidate of candidateMembers) {
    const createdForMember = await prisma.$transaction(async (tx) => {
      const config = await getOrCreateConfigTx(tx);
      const locked = await lockMembersInOrderTx(tx, [candidate.id]);
      const member = locked.get(candidate.id);
      if (!member || member.status !== "ACTIVE") return 0;

      const beforeCount = await tx.dailySettlement.count({
        where: { memberId: member.id },
      });

      await ensureMemberChronologyTx(
        tx,
        member,
        effectiveBusinessAt,
        config,
        processedAt,
        triggeredBy
      );

      const afterCount = await tx.dailySettlement.count({
        where: { memberId: member.id },
      });
      return afterCount - beforeCount;
    });

    settlementsCreated += createdForMember;
  }

  return {
    targetCurrentSgtDate,
    membersProcessed: candidateMembers.length,
    settlementsCreated,
  };
}

/**
 * Processes due D+2 00:01:00 SGT upgrades in strict chronological order:
 * Always settles 00:00 SGT EOD first, then activates 00:01:00 SGT upgrades and triggers catch-up pairing.
 */
export async function processDueUpgrades(params?: {
  asOf?: Date;
  processedAt?: Date;
  triggeredBy?: "CRON" | "ADMIN_MANUAL";
}): Promise<{
  eodSettlementsCreated: number;
  upgradesActivated: number;
}> {
  const businessAt = params?.asOf ?? new Date();
  const processedAt = params?.processedAt ?? businessAt;
  const triggeredBy = params?.triggeredBy ?? "CRON";

  const eodRes = await runEodSettlement({
    targetCurrentSgtDate: getSgtDateString(businessAt),
    asOf: businessAt,
    processedAt,
    triggeredBy,
  });

  const dueMembers = await prisma.member.findMany({
    where: {
      status: "ACTIVE",
      pendingUpgradePackageCode: { not: null },
      pendingUpgradeEffectiveAt: { lte: businessAt },
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  let upgradesActivated = 0;
  for (const candidate of dueMembers) {
    const activated = await prisma.$transaction(async (tx) => {
      const config = await getOrCreateConfigTx(tx);
      const locked = await lockMembersInOrderTx(tx, [candidate.id]);
      const member = locked.get(candidate.id);
      if (!member || !member.pendingUpgradePackageCode) return 0;
      const hadPending = Boolean(member.pendingUpgradePackageCode);
      const after = await ensureMemberChronologyTx(
        tx,
        member,
        businessAt,
        config,
        processedAt,
        triggeredBy
      );
      return hadPending && !after.pendingUpgradePackageCode ? 1 : 0;
    });
    upgradesActivated += activated;
  }

  return {
    eodSettlementsCreated: eodRes.settlementsCreated,
    upgradesActivated,
  };
}

/**
 * Retries a FAILED or due WAITING_EFFECTIVE upgrade order preserving its original orderNo & event keys.
 */
export async function retryUpgradeActivation(params: {
  orderId: string;
  operatorId: string;
  asOf?: Date;
}) {
  const asOf = params.asOf ?? new Date();

  return prisma.$transaction(async (tx) => {
    const order = await tx.packageOrder.findUnique({ where: { id: params.orderId } });
    if (!order || order.orderType !== "UPGRADE") {
      throw new Error("Upgrade order not found");
    }
    if (order.status !== "CONFIRMED") {
      throw new Error("Upgrade order payment has not been confirmed yet");
    }
    if (order.upgradeStatus === "EFFECTIVE") {
      return { ok: true, idempotent: true, orderNo: order.orderNo };
    }
    if (!order.effectiveAt || order.effectiveAt > asOf) {
      throw new Error("Upgrade has not reached its scheduled D+2 00:01:00 SGT effective time yet");
    }

    const config = await getOrCreateConfigTx(tx);
    const locked = await lockMembersInOrderTx(tx, [order.memberId]);
    let member = locked.get(order.memberId);
    if (!member) throw new Error("Member not found");

    // Re-bind pending upgrade pointer if previously marked FAILED
    if (!member.pendingUpgradePackageCode) {
      member.pendingUpgradePackageCode = order.targetPackageCode;
      member.pendingUpgradeEffectiveDate = order.effectiveSgtDate;
      member.pendingUpgradeEffectiveAt = order.effectiveAt;
      member.pendingUpgradeOrderId = order.id;
    }

    const targetPkg = await tx.packageTier.findUnique({
      where: { code: order.targetPackageCode },
    });
    if (!targetPkg || !targetPkg.isActive) {
      await tx.packageOrder.update({
        where: { id: order.id },
        data: {
          upgradeStatus: "FAILED",
          upgradeFailureReason: `Target package ${order.targetPackageCode} is inactive or missing`,
        },
      });
      return {
        ok: false,
        orderNo: order.orderNo,
        reason: `Target package ${order.targetPackageCode} is inactive or missing`,
      };
    }

    member = await ensureMemberChronologyTx(
      tx,
      member,
      asOf,
      config,
      asOf,
      "ADMIN_MANUAL"
    );

    await tx.auditLog.create({
      data: {
        actorId: params.operatorId,
        actorRole: "ADMIN",
        action: "UPGRADE_RETRY",
        entityType: "PackageOrder",
        entityId: order.id,
        summary: `Retried upgrade activation for ${order.orderNo} (${member.memberCode})`,
        createdAt: asOf,
      },
    });

    return { ok: true, orderNo: order.orderNo, currentPackageCode: member.currentPackageCode };
  });
}

/**
 * Admin manual balance adjustment (points or BV) with mandatory reason and audit log.
 */
export async function adjustMemberBalance(params: {
  memberId: string;
  operatorId: string;
  kind: "POINTS" | "BV";
  deltaPointsCents?: number;
  leg?: BinaryLeg;
  deltaBv?: number;
  reason: string;
  asOf?: Date;
}) {
  const asOf = params.asOf ?? new Date();
  const sgtDate = getSgtDateString(asOf);
  if (!params.reason.trim()) {
    throw new Error("Adjustment reason is required");
  }

  return prisma.$transaction(async (tx) => {
    const config = await getOrCreateConfigTx(tx);
    const locked = await lockMembersInOrderTx(tx, [params.memberId]);
    let member = locked.get(params.memberId);
    if (!member) throw new Error("Member not found");

    member = await ensureMemberChronologyTx(
      tx,
      member,
      asOf,
      config,
      asOf,
      "LAZY_CATCHUP"
    );

    if (params.kind === "POINTS") {
      const delta = params.deltaPointsCents ?? 0;
      if (delta === 0) throw new Error("Balance delta (U) must be non-zero");
      const nextAvailable = member.availablePointsCents + delta;
      if (nextAvailable < 0) {
        throw new Error("Resulting available U balance cannot be negative");
      }

      await tx.member.update({
        where: { id: member.id },
        data: { availablePointsCents: nextAvailable },
      });

      const ledger = await tx.walletLedger.create({
        data: {
          ledgerNo: makeDocNo("WL", sgtDate),
          eventKey: `admin_adj_pts:${member.id}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
          memberId: member.id,
          entryType: "ADMIN_ADJUSTMENT",
          deltaAvailableCents: delta,
          deltaLockedCents: 0,
          availableAfterCents: nextAvailable,
          lockedAfterCents: member.lockedPointsCents,
          operatorId: params.operatorId,
          note: params.reason.trim(),
          createdAt: asOf,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: params.operatorId,
          actorRole: "ADMIN",
          action: "ADMIN_BALANCE_ADJUST",
          entityType: "Member",
          entityId: member.id,
          summary: `Adjusted U balance for ${member.memberCode} by ${delta} cents: ${params.reason}`,
          metadata: {
            kind: "POINTS",
            deltaPointsCents: delta,
            reason: params.reason,
            ledgerId: ledger.id,
          },
          createdAt: asOf,
        },
      });

      return { kind: "POINTS" as const, availableAfterCents: nextAvailable };
    }

    const leg = params.leg;
    const deltaBv = params.deltaBv ?? 0;
    if (!leg || deltaBv === 0) {
      throw new Error("Leg and non-zero BV delta are required");
    }

    const currentLegBv = leg === "LEFT" ? member.leftBv : member.rightBv;
    const nextLegBv = currentLegBv + deltaBv;
    if (nextLegBv < 0) {
      throw new Error("Resulting leg BV cannot be negative");
    }

    await tx.member.update({
      where: { id: member.id },
      data: leg === "LEFT" ? { leftBv: nextLegBv } : { rightBv: nextLegBv },
    });

    const ledger = await tx.bvLedger.create({
      data: {
        eventKey: `admin_adj_bv:${member.id}:${leg}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
        memberId: member.id,
        leg,
        entryType: "ADMIN_ADJUSTMENT",
        deltaBv,
        balanceAfterBv: nextLegBv,
        settlementDate: sgtDate,
        note: params.reason.trim(),
        createdAt: asOf,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: params.operatorId,
        actorRole: "ADMIN",
        action: "ADMIN_BALANCE_ADJUST",
        entityType: "Member",
        entityId: member.id,
        summary: `Adjusted ${leg} BV for ${member.memberCode} by ${deltaBv} BV: ${params.reason}`,
        metadata: { kind: "BV", leg, deltaBv, reason: params.reason, ledgerId: ledger.id },
        createdAt: asOf,
      },
    });

    return { kind: "BV" as const, leg, balanceAfterBv: nextLegBv };
  });
}
