import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { getUpgradeEffectiveScheduleSgt, makeSgtDate } from "@/lib/sgt";
import {
  calculateWithdrawalQuote,
  formatPoints,
  formatUsd,
} from "@/lib/money";

import { prisma } from "@/lib/db";

if (!process.env.DATABASE_URL?.includes("binary_member_portal_test")) {
  throw new Error(
    `Refusing to run test suite against non-test DATABASE_URL: ${process.env.DATABASE_URL}`
  );
}
import {
  confirmPackageOrder,
  createPackageOrder,
  decideEodCarryover,
  processDueUpgrades,
  runEodSettlement,
} from "@/lib/settlement/engine";
import {
  approveWithdrawal,
  markWithdrawalPaid,
  markWithdrawalPendingCheck,
  rejectWithdrawal,
  requestWithdrawal,
} from "@/lib/settlement/withdrawals";
import { retryUpgradeActivation } from "@/lib/settlement/engine";

let pwHash = "";

async function resetTestDb(baseSgtDate = "2026-11-16") {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      audit_logs,
      wallet_ledgers,
      referral_reward_ledgers,
      bv_ledgers,
      binary_pairing_settlements,
      daily_settlements,
      withdrawal_requests,
      package_orders,
      members,
      package_tiers,
      rule_version_records,
      system_configs
    RESTART IDENTITY CASCADE
  `);

  await prisma.systemConfig.create({
    data: {
      id: 1,
      ruleVersion: 1,
      tieBreakerRule: "KEEP_LEFT",
      headcountRule: "ACTIVE_PAID_ALL_DEPTHS",
      upgradePriceMode: "DIFFERENCE",
      upgradeGrantsBv: false,
      upgradeTriggersDirectCommission: false,
      upgradeEffectiveDaysOffset: 2,
      upgradeEffectiveTimeSgt: "00:01:00",
      directCommissionRateBps: 2500,
      pairingUnitBv: 100,
      pairingRewardPointsCents: 1000,
      withdrawalFeeRateBps: 2000,
      withdrawalUsdRateMicros: 1000000,
      isDemoRate: true,
      productionPayoutEnabled: false,
      directRewardCurrency: "POINTS",
    },
  });

  await prisma.ruleVersionRecord.create({
    data: {
      version: 1,
      tieBreakerRule: "KEEP_LEFT",
      headcountRule: "ACTIVE_PAID_ALL_DEPTHS",
      upgradePriceMode: "DIFFERENCE",
      upgradeGrantsBv: false,
      upgradeTriggersDirectCommission: false,
      upgradeEffectiveDaysOffset: 2,
      upgradeEffectiveTimeSgt: "00:01:00",
      directCommissionRateBps: 2500,
      pairingUnitBv: 100,
      pairingRewardPointsCents: 1000,
      withdrawalFeeRateBps: 2000,
      withdrawalUsdRateMicros: 1000000,
      isDemoRate: true,
      productionPayoutEnabled: false,
      changeNote: "Test suite v1",
    },
  });

  await prisma.packageTier.createMany({
    data: [
      {
        code: "P100",
        nameEn: "Starter 100",
        nameZh: "入门配套 100",
        priceUsdCents: 10000,
        bv: 100,
        dailyCapPointsCents: 10000,
        sortOrder: 1,
      },
      {
        code: "P500",
        nameEn: "Pro 500",
        nameZh: "进阶配套 500",
        priceUsdCents: 50000,
        bv: 500,
        dailyCapPointsCents: 50000,
        sortOrder: 2,
      },
      {
        code: "P1000",
        nameEn: "Elite 1000",
        nameZh: "尊享配套 1000",
        priceUsdCents: 100000,
        bv: 1000,
        dailyCapPointsCents: 100000,
        sortOrder: 3,
      },
    ],
  });

  const root = await prisma.member.create({
    data: {
      memberCode: "BM100001",
      email: "root@test.io",
      passwordHash: pwHash,
      displayName: "Root Admin",
      role: "ADMIN",
      status: "ACTIVE",
      currentPackageCode: "P1000",
      dailyCapPointsCents: 100000,
      activeSettlementDate: baseSgtDate,
      activatedAt: makeSgtDate(baseSgtDate, "00:00:10"),
    },
  });

  return { root };
}

async function createAndPlaceMember(params: {
  memberCode: string;
  sponsorId: string;
  placementParentId: string;
  placementLeg: "LEFT" | "RIGHT";
  packageCode: "P100" | "P500" | "P1000";
  asOf: Date;
  operatorId: string;
}) {
  const sgtDate = new Date(params.asOf.getTime() + 8 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
  const member = await prisma.member.create({
    data: {
      memberCode: params.memberCode,
      email: `${params.memberCode.toLowerCase()}@test.io`,
      passwordHash: pwHash,
      displayName: params.memberCode,
      role: "MEMBER",
      status: "PENDING_PAYMENT",
      sponsorId: params.sponsorId,
      activeSettlementDate: sgtDate,
      createdAt: params.asOf,
    },
  });

  const order = await createPackageOrder({
    memberId: member.id,
    orderType: "INITIAL",
    targetPackageCode: params.packageCode,
    payImmediatelyDemo: true,
    placementParentId: params.placementParentId,
    placementLeg: params.placementLeg,
    asOf: params.asOf,
  });

  const result = await confirmPackageOrder({
    orderId: order.id,
    operatorId: params.operatorId,
    asOf: params.asOf,
  });

  expect(result.ok).toBe(true);
  return { member, order, result };
}

describe("Binary Member Portal — D+2 00:01 SGT Acceptance & Concurrency Suite", () => {
  beforeAll(async () => {
    pwHash = await bcrypt.hash("Test1234!", 8);
  });

  beforeEach(async () => {
    await resetTestDb("2026-11-16"); // Monday 2026-11-16
  });

  it("Test 1: Direct sponsoring a 500 BV package immediately credits 125 pts without changing pairing quota", async () => {
    const root = await prisma.member.findUniqueOrThrow({ where: { memberCode: "BM100001" } });
    const { member: sponsor } = await createAndPlaceMember({
      memberCode: "BM100002",
      sponsorId: root.id,
      placementParentId: root.id,
      placementLeg: "LEFT",
      packageCode: "P100",
      asOf: makeSgtDate("2026-11-16", "10:00:00"),
      operatorId: root.id,
    });

    const { result } = await createAndPlaceMember({
      memberCode: "BM100003",
      sponsorId: sponsor.id,
      placementParentId: sponsor.id,
      placementLeg: "LEFT",
      packageCode: "P500",
      asOf: makeSgtDate("2026-11-16", "10:05:00"),
      operatorId: root.id,
    });

    expect(result.directCommissionCents).toBe(12500);
    const updatedSponsor = await prisma.member.findUniqueOrThrow({ where: { id: sponsor.id } });
    expect(updatedSponsor.availablePointsCents).toBe(12500);
    expect(updatedSponsor.todayPairedPointsCents).toBe(0);
    expect(updatedSponsor.leftBv).toBe(500);
  });

  it("Test 2: P100 with 1500/1500 BV settles 10 pairs (100 pts) and retains 500/500 BV", async () => {
    const root = await prisma.member.findUniqueOrThrow({ where: { memberCode: "BM100001" } });
    const { member: m } = await createAndPlaceMember({
      memberCode: "BM100002",
      sponsorId: root.id,
      placementParentId: root.id,
      placementLeg: "LEFT",
      packageCode: "P100",
      asOf: makeSgtDate("2026-11-16", "09:00:00"),
      operatorId: root.id,
    });

    const { member: l1 } = await createAndPlaceMember({
      memberCode: "BM100003",
      sponsorId: root.id,
      placementParentId: m.id,
      placementLeg: "LEFT",
      packageCode: "P500",
      asOf: makeSgtDate("2026-11-16", "10:00:00"),
      operatorId: root.id,
    });
    await createAndPlaceMember({
      memberCode: "BM100004",
      sponsorId: root.id,
      placementParentId: l1.id,
      placementLeg: "LEFT",
      packageCode: "P1000",
      asOf: makeSgtDate("2026-11-16", "10:01:00"),
      operatorId: root.id,
    });
    const { member: r1 } = await createAndPlaceMember({
      memberCode: "BM100005",
      sponsorId: root.id,
      placementParentId: m.id,
      placementLeg: "RIGHT",
      packageCode: "P500",
      asOf: makeSgtDate("2026-11-16", "10:02:00"),
      operatorId: root.id,
    });
    await createAndPlaceMember({
      memberCode: "BM100006",
      sponsorId: root.id,
      placementParentId: r1.id,
      placementLeg: "RIGHT",
      packageCode: "P1000",
      asOf: makeSgtDate("2026-11-16", "10:03:00"),
      operatorId: root.id,
    });

    const after = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(after.todayPairedPointsCents).toBe(10000);
    expect(after.availablePointsCents).toBe(10000);
    expect(after.leftBv).toBe(500);
    expect(after.rightBv).toBe(500);
  });

  it("Test 3 & 4: Monday 17:00 SGT upgrade (and 00:00 / 23:59:59) stays P100 through Tue & Wed 00:00:59, activates P500 at Wed 00:01:00 SGT", async () => {
    // Test 4: 00:00:00, 17:00:00, and 23:59:59 on 2026-11-16 all schedule for 2026-11-18 00:01:00 SGT
    for (const timeStr of ["00:00:00", "17:00:00", "23:59:59"]) {
      const sched = getUpgradeEffectiveScheduleSgt(
        makeSgtDate("2026-11-16", timeStr),
        2,
        "00:01:00"
      );
      expect(sched.effectiveSgtDate).toBe("2026-11-18");
      expect(sched.effectiveAt.toISOString()).toBe(
        makeSgtDate("2026-11-18", "00:01:00").toISOString()
      );
    }

    const root = await prisma.member.findUniqueOrThrow({ where: { memberCode: "BM100001" } });
    const { member: m } = await createAndPlaceMember({
      memberCode: "BM100002",
      sponsorId: root.id,
      placementParentId: root.id,
      placementLeg: "LEFT",
      packageCode: "P100",
      asOf: makeSgtDate("2026-11-16", "09:00:00"),
      operatorId: root.id,
    });

    // Monday 17:00 SGT: confirm upgrade P100 -> P500
    const upgOrder = await createPackageOrder({
      memberId: m.id,
      orderType: "UPGRADE",
      targetPackageCode: "P500",
      payImmediatelyDemo: true,
      asOf: makeSgtDate("2026-11-16", "17:00:00"),
    });
    const upgRes = await confirmPackageOrder({
      orderId: upgOrder.id,
      operatorId: root.id,
      asOf: makeSgtDate("2026-11-16", "17:00:00"),
    });
    expect(upgRes.ok).toBe(true);
    expect(upgRes.upgradeStatus).toBe("WAITING_EFFECTIVE");
    expect(upgRes.effectiveSgtDate).toBe("2026-11-18");

    // Tuesday 15:00 SGT: 2000 BV Left + 1500 BV Right -> still capped at 100 pts (P100)!
    // Leaves 1000 BV Left, 500 BV Right.
    const { member: l1 } = await createAndPlaceMember({
      memberCode: "BM100003",
      sponsorId: root.id,
      placementParentId: m.id,
      placementLeg: "LEFT",
      packageCode: "P1000",
      asOf: makeSgtDate("2026-11-17", "15:00:00"),
      operatorId: root.id,
    });
    const { member: l2 } = await createAndPlaceMember({
      memberCode: "BM100004",
      sponsorId: root.id,
      placementParentId: l1.id,
      placementLeg: "LEFT",
      packageCode: "P1000",
      asOf: makeSgtDate("2026-11-17", "15:01:00"),
      operatorId: root.id,
    });
    const { member: r1 } = await createAndPlaceMember({
      memberCode: "BM100005",
      sponsorId: root.id,
      placementParentId: m.id,
      placementLeg: "RIGHT",
      packageCode: "P500",
      asOf: makeSgtDate("2026-11-17", "15:02:00"),
      operatorId: root.id,
    });
    const { member: r2 } = await createAndPlaceMember({
      memberCode: "BM100006",
      sponsorId: root.id,
      placementParentId: r1.id,
      placementLeg: "RIGHT",
      packageCode: "P1000",
      asOf: makeSgtDate("2026-11-17", "15:03:00"),
      operatorId: root.id,
    });

    const tueMember = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(tueMember.currentPackageCode).toBe("P100");
    expect(tueMember.dailyCapPointsCents).toBe(10000);
    expect(tueMember.leftBv).toBe(1000);
    expect(tueMember.rightBv).toBe(500);

    // Wednesday 00:00:00 SGT EOD runs -> keeps Left 1000 BV, flushes Right 500 BV to 0!
    await runEodSettlement({
      targetCurrentSgtDate: "2026-11-18",
      asOf: makeSgtDate("2026-11-18", "00:00:02"),
      triggeredBy: "CRON",
    });

    // Wednesday 00:00:30 SGT (before 00:01:00 SGT!) -> add 1500 BV Right (1000+500) + 500 BV Left
    // Under P100 (100 pts cap): pairs 10 pairs (100 pts) and leaves 500L + 500R unpaired before 00:01:00!
    await createAndPlaceMember({
      memberCode: "BM100007",
      sponsorId: root.id,
      placementParentId: r2.id,
      placementLeg: "RIGHT",
      packageCode: "P1000",
      asOf: makeSgtDate("2026-11-18", "00:00:30"),
      operatorId: root.id,
    });
    const { member: l3 } = await createAndPlaceMember({
      memberCode: "BM100008",
      sponsorId: root.id,
      placementParentId: l2.id,
      placementLeg: "LEFT",
      packageCode: "P500",
      asOf: makeSgtDate("2026-11-18", "00:00:35"),
      operatorId: root.id,
    });
    const r3Parent = await prisma.member.findUniqueOrThrow({ where: { memberCode: "BM100007" } });
    await createAndPlaceMember({
      memberCode: "BM100009",
      sponsorId: root.id,
      placementParentId: r3Parent.id,
      placementLeg: "RIGHT",
      packageCode: "P500",
      asOf: makeSgtDate("2026-11-18", "00:00:40"),
      operatorId: root.id,
    });

    const wed000059 = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(wed000059.currentPackageCode).toBe("P100");
    expect(wed000059.dailyCapPointsCents).toBe(10000);
    expect(wed000059.todayPairedPointsCents).toBe(10000); // Capped at 100 pts during 00:00:00-00:00:59
    expect(wed000059.leftBv).toBe(500);
    expect(wed000059.rightBv).toBe(500);
    expect(l3.id).toBeTruthy();

    // Run processDueUpgrades at Wednesday 00:01:00 SGT -> activates P500 & catch-up pairs remaining 500/500 BV!
    const dueRes = await processDueUpgrades({
      asOf: makeSgtDate("2026-11-18", "00:01:00"),
      triggeredBy: "CRON",
    });
    expect(dueRes.upgradesActivated).toBe(1);

    const wed0001 = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(wed0001.currentPackageCode).toBe("P500");
    expect(wed0001.dailyCapPointsCents).toBe(50000);
    expect(wed0001.pendingUpgradePackageCode).toBeNull();
    expect(wed0001.todayPairedPointsCents).toBe(15000); // 100 pts (00:00:30) + 50 pts (00:01:00 catch-up)
    expect(wed0001.leftBv).toBe(0);
    expect(wed0001.rightBv).toBe(0);
  });

  it("Test 5 & 6: Flushed BV at 00:00 SGT cannot be catch-up paired at 00:01 SGT; 00:00-00:00:59 pairings count toward new 500 cap (leaving 400 remaining)", async () => {
    const root = await prisma.member.findUniqueOrThrow({ where: { memberCode: "BM100001" } });
    const { member: m } = await createAndPlaceMember({
      memberCode: "BM100002",
      sponsorId: root.id,
      placementParentId: root.id,
      placementLeg: "LEFT",
      packageCode: "P100",
      asOf: makeSgtDate("2026-11-16", "09:00:00"),
      operatorId: root.id,
    });

    // Confirm upgrade on Monday 2026-11-16 -> effective 2026-11-18 00:01:00 SGT
    const upgOrder = await createPackageOrder({
      memberId: m.id,
      orderType: "UPGRADE",
      targetPackageCode: "P500",
      payImmediatelyDemo: true,
      asOf: makeSgtDate("2026-11-16", "17:00:00"),
    });
    await confirmPackageOrder({
      orderId: upgOrder.id,
      operatorId: root.id,
      asOf: makeSgtDate("2026-11-16", "17:00:00"),
    });

    // Tuesday 2026-11-17: 1500 BV Left + 1500 BV Right -> pairs 100 pts, leaves 500L / 500R
    const { member: l1 } = await createAndPlaceMember({
      memberCode: "BM100003",
      sponsorId: root.id,
      placementParentId: m.id,
      placementLeg: "LEFT",
      packageCode: "P500",
      asOf: makeSgtDate("2026-11-17", "10:00:00"),
      operatorId: root.id,
    });
    await createAndPlaceMember({
      memberCode: "BM100004",
      sponsorId: root.id,
      placementParentId: l1.id,
      placementLeg: "LEFT",
      packageCode: "P1000",
      asOf: makeSgtDate("2026-11-17", "10:01:00"),
      operatorId: root.id,
    });
    const { member: r1 } = await createAndPlaceMember({
      memberCode: "BM100005",
      sponsorId: root.id,
      placementParentId: m.id,
      placementLeg: "RIGHT",
      packageCode: "P500",
      asOf: makeSgtDate("2026-11-17", "10:02:00"),
      operatorId: root.id,
    });
    await createAndPlaceMember({
      memberCode: "BM100006",
      sponsorId: root.id,
      placementParentId: r1.id,
      placementLeg: "RIGHT",
      packageCode: "P1000",
      asOf: makeSgtDate("2026-11-17", "10:03:00"),
      operatorId: root.id,
    });

    // Wed 00:00:00 SGT EOD runs -> tie 500/500 & 2/2 -> KEEP_LEFT -> Left=500, Right=0 (Right flushed!)
    await runEodSettlement({
      targetCurrentSgtDate: "2026-11-18",
      asOf: makeSgtDate("2026-11-18", "00:00:02"),
    });

    // Test 5: At 00:01:00 SGT upgrade activates, Right is 0 (flushed), so NO catch-up pairing occurs!
    // First wait: let's test Test 6 on 00:00:30 SGT BEFORE 00:01:00 SGT!
    // Suppose at 00:00:30 SGT (under old P100 cap), 1000 BV Right + 500 BV Left arrives -> wait: Left already has 500 BV!
    // Let's add 1000 BV Left + 1000 BV Right at 00:00:30 SGT -> Left=1500, Right=1000 -> under P100 cap (100 pts),
    // it pairs 10 pairs = 100 pts! Remaining: Left=500, Right=0!
    const l2 = await prisma.member.findUniqueOrThrow({ where: { memberCode: "BM100004" } });
    const r2 = await prisma.member.findUniqueOrThrow({ where: { memberCode: "BM100006" } });
    await createAndPlaceMember({
      memberCode: "BM100007",
      sponsorId: root.id,
      placementParentId: l2.id,
      placementLeg: "LEFT",
      packageCode: "P1000",
      asOf: makeSgtDate("2026-11-18", "00:00:30"),
      operatorId: root.id,
    });
    await createAndPlaceMember({
      memberCode: "BM100008",
      sponsorId: root.id,
      placementParentId: r2.id,
      placementLeg: "RIGHT",
      packageCode: "P1000",
      asOf: makeSgtDate("2026-11-18", "00:00:40"),
      operatorId: root.id,
    });

    const before0001 = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(before0001.todayPairedPointsCents).toBe(10000); // 100 pts paired during 00:00:00-00:00:59
    expect(before0001.leftBv).toBe(500);
    expect(before0001.rightBv).toBe(0);

    // At 00:01:00 SGT, P500 activates -> Right is 0 so 0 catch-up pairs from flushed BV!
    await processDueUpgrades({
      asOf: makeSgtDate("2026-11-18", "00:01:00"),
      triggeredBy: "CRON",
    });

    const at0001 = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(at0001.currentPackageCode).toBe("P500");
    expect(at0001.todayPairedPointsCents).toBe(10000); // Still 100 pts

    // Now at 00:05:00 SGT, add 5000 BV Left + 5000 BV Right (e.g. 5x1000? Let's test 5000 via admin BV or 5 nodes -> 4500+500L=5000L, 5000R -> enough to exceed 400 remaining cap!)
    // Quickest clean way: place 5 P1000 nodes? Or 4 P1000 on Right + 4 P1000 on Left -> 4000R + 4500L -> pairs 40 pairs = 400 pts (remaining cap = 500 - 100 = 400 pts)!
    let prevL = await prisma.member.findUniqueOrThrow({ where: { memberCode: "BM100007" } });
    let prevR = await prisma.member.findUniqueOrThrow({ where: { memberCode: "BM100008" } });
    for (let i = 1; i <= 5; i++) {
      const nl = await createAndPlaceMember({
        memberCode: `BM10010${i}`,
        sponsorId: root.id,
        placementParentId: prevL.id,
        placementLeg: "LEFT",
        packageCode: "P1000",
        asOf: makeSgtDate("2026-11-18", `00:05:0${i}`),
        operatorId: root.id,
      });
      prevL = nl.member;
      const nr = await createAndPlaceMember({
        memberCode: `BM10020${i}`,
        sponsorId: root.id,
        placementParentId: prevR.id,
        placementLeg: "RIGHT",
        packageCode: "P1000",
        asOf: makeSgtDate("2026-11-18", `00:05:1${i}`),
        operatorId: root.id,
      });
      prevR = nr.member;
    }

    const finalM = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    // Total paired on Wed 2026-11-18 = 100 (from 00:00:40) + 400 (remaining cap under P500) = 500 pts!
    expect(finalM.todayPairedPointsCents).toBe(50000);
    // Remaining BV: Left had 500 + 5000 - 4000 = 1500; Right had 0 + 5000 - 4000 = 1000!
    expect(finalM.leftBv).toBe(1500);
    expect(finalM.rightBv).toBe(1000);
  });

  it("Test 7 & 8: Midnight EOD carryover rules (higher BV, tie BV + higher headcount, tie BV + tie headcount -> KEEP_LEFT, excluding CANCELLED)", async () => {
    expect(decideEodCarryover(700, 500, 10, 20, "KEEP_LEFT")).toMatchObject({
      retainedSide: "LEFT",
      leftBvAfter: 700,
      rightBvAfter: 0,
      flushedBv: 500,
    });
    expect(decideEodCarryover(500, 500, 10, 20, "KEEP_LEFT")).toMatchObject({
      retainedSide: "RIGHT",
      leftBvAfter: 0,
      rightBvAfter: 500,
      flushedBv: 500,
    });
    expect(decideEodCarryover(500, 500, 10, 10, "KEEP_LEFT")).toMatchObject({
      retainedSide: "LEFT",
      leftBvAfter: 500,
      rightBvAfter: 0,
      flushedBv: 500,
    });

    // DB-level boundary headcount verification
    const root = await prisma.member.findUniqueOrThrow({ where: { memberCode: "BM100001" } });
    const t = makeSgtDate("2026-11-16", "14:00:00");
    const { member: l1 } = await createAndPlaceMember({
      memberCode: "BM100030",
      sponsorId: root.id,
      placementParentId: root.id,
      placementLeg: "LEFT",
      packageCode: "P500",
      asOf: t,
      operatorId: root.id,
    });
    const { member: r1 } = await createAndPlaceMember({
      memberCode: "BM100031",
      sponsorId: root.id,
      placementParentId: root.id,
      placementLeg: "RIGHT",
      packageCode: "P100",
      asOf: t,
      operatorId: root.id,
    });
    await createAndPlaceMember({
      memberCode: "BM100032",
      sponsorId: root.id,
      placementParentId: r1.id,
      placementLeg: "RIGHT",
      packageCode: "P100",
      asOf: t,
      operatorId: root.id,
    });

    // Attach CANCELLED node under Left AND an active node activated AFTER midnight 00:00:05
    await prisma.member.create({
      data: {
        memberCode: "BM100033",
        email: "cancelled@test.io",
        passwordHash: pwHash,
        displayName: "Cancelled Node",
        role: "MEMBER",
        status: "CANCELLED",
        sponsorId: root.id,
        placementParentId: l1.id,
        placementLeg: "LEFT",
        activeSettlementDate: "2026-11-16",
      },
    });
    await prisma.member.update({
      where: { id: root.id },
      data: { leftBv: 300, rightBv: 300 },
    });

    await runEodSettlement({
      targetCurrentSgtDate: "2026-11-17",
      asOf: makeSgtDate("2026-11-17", "00:00:05"),
    });

    const eod = await prisma.dailySettlement.findUniqueOrThrow({
      where: {
        memberId_settlementDate: { memberId: root.id, settlementDate: "2026-11-16" },
      },
    });
    expect(eod.leftMemberCount).toBe(1);
    expect(eod.rightMemberCount).toBe(2);
    expect(eod.retainedSide).toBe("RIGHT");
    expect(eod.leftBvAfter).toBe(0);
    expect(eod.rightBvAfter).toBe(300);
    expect(eod.ruleVersion).toBe(1);
  });

  it("Test 9: Delayed EOD + delayed upgrade + duplicate order callback + concurrent BV around midnight execute in exact business order", async () => {
    const root = await prisma.member.findUniqueOrThrow({ where: { memberCode: "BM100001" } });
    const { member: m } = await createAndPlaceMember({
      memberCode: "BM100002",
      sponsorId: root.id,
      placementParentId: root.id,
      placementLeg: "LEFT",
      packageCode: "P100",
      asOf: makeSgtDate("2026-11-16", "09:00:00"),
      operatorId: root.id,
    });

    // Upgrade scheduled on Monday 2026-11-16 -> effective Wed 2026-11-18 00:01:00 SGT
    const upgOrder = await createPackageOrder({
      memberId: m.id,
      orderType: "UPGRADE",
      targetPackageCode: "P500",
      payImmediatelyDemo: true,
      asOf: makeSgtDate("2026-11-16", "17:00:00"),
    });
    // Duplicate callback confirmation of the upgrade order simultaneously!
    const [u1, u2] = await Promise.all([
      confirmPackageOrder({
        orderId: upgOrder.id,
        operatorId: root.id,
        asOf: makeSgtDate("2026-11-16", "17:00:00"),
      }),
      confirmPackageOrder({
        orderId: upgOrder.id,
        operatorId: root.id,
        asOf: makeSgtDate("2026-11-16", "17:00:00"),
      }),
    ]);
    expect(u1.ok && u2.ok).toBe(true);

    // Give m 500L / 0R on Tuesday 2026-11-17
    await createAndPlaceMember({
      memberCode: "BM100003",
      sponsorId: root.id,
      placementParentId: m.id,
      placementLeg: "LEFT",
      packageCode: "P500",
      asOf: makeSgtDate("2026-11-17", "20:00:00"),
      operatorId: root.id,
    });

    // Simulate BOTH EOD & Upgrade cron jobs DELAYED until Wed 2026-11-18 09:00:00 SGT!
    // At 09:00:00 SGT, two orders arrive concurrently on Right leg of m (each 1000 BV)!
    const rParent = m;
    const mR1 = await prisma.member.create({
      data: {
        memberCode: "BM100010",
        email: "mr1@test.io",
        passwordHash: pwHash,
        displayName: "MR1",
        role: "MEMBER",
        status: "PENDING_PAYMENT",
        sponsorId: root.id,
        activeSettlementDate: "2026-11-18",
      },
    });
    const oR1 = await createPackageOrder({
      memberId: mR1.id,
      orderType: "INITIAL",
      targetPackageCode: "P1000",
      payImmediatelyDemo: true,
      placementParentId: rParent.id,
      placementLeg: "RIGHT",
      asOf: makeSgtDate("2026-11-18", "09:00:00"),
    });
    // Duplicate confirm of oR1 + concurrent processDueUpgrades at 09:00:00 SGT!
    await Promise.all([
      confirmPackageOrder({
        orderId: oR1.id,
        operatorId: root.id,
        asOf: makeSgtDate("2026-11-18", "09:00:00"),
      }),
      confirmPackageOrder({
        orderId: oR1.id,
        operatorId: root.id,
        asOf: makeSgtDate("2026-11-18", "09:00:00"),
      }),
      processDueUpgrades({
        asOf: makeSgtDate("2026-11-18", "09:00:00"),
        triggeredBy: "CRON",
      }),
    ]);

    // Chronological expectations:
    // 1. Mon & Tue EOD settled ONCE each (Tue retained 500L)
    // 2. Wed 00:01:00 SGT upgrade activated BEFORE 09:00:00 SGT BV!
    // 3. Wed 09:00:00 SGT 1000 BV Right credited ONCE -> pairs 5 pairs (50 pts) against carried 500L -> Left=0, Right=500!
    const mFinal = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(mFinal.activeSettlementDate).toBe("2026-11-18");
    expect(mFinal.currentPackageCode).toBe("P500");
    expect(mFinal.pendingUpgradePackageCode).toBeNull();
    expect(mFinal.leftBv).toBe(0);
    expect(mFinal.rightBv).toBe(500);
    expect(mFinal.todayPairedPointsCents).toBe(5000);

    const eodTue = await prisma.dailySettlement.count({
      where: { memberId: m.id, settlementDate: "2026-11-17" },
    });
    expect(eodTue).toBe(1);

    const upgradedOrderRecord = await prisma.packageOrder.findUniqueOrThrow({
      where: { id: upgOrder.id },
    });
    expect(upgradedOrderRecord.upgradeStatus).toBe("EFFECTIVE");
    expect(upgradedOrderRecord.effectiveAt?.toISOString()).toBe(
      makeSgtDate("2026-11-18", "00:01:00").toISOString()
    );
    expect(upgradedOrderRecord.upgradeProcessedAt).not.toBeNull();
  });

  it("Test 10: Withdrawal 130 pts -> 26 fee -> 104 net -> US$104, concurrent withdrawal & concurrent placement race", async () => {
    const quote = calculateWithdrawalQuote(13000, 2000, 1000000);
    expect(quote.feePointsCents).toBe(2600);
    expect(quote.netPointsCents).toBe(10400);
    expect(quote.estimatedUsdCents).toBe(10400);
    expect(formatPoints(quote.netPointsCents)).toBe("104");
    expect(formatUsd(quote.estimatedUsdCents)).toBe("US$104");

    const root = await prisma.member.findUniqueOrThrow({ where: { memberCode: "BM100001" } });
    await prisma.member.update({
      where: { id: root.id },
      data: { availablePointsCents: 15000, lockedPointsCents: 0 },
    });

    // Concurrent over-withdrawal: two 100-pt withdrawals against 150-pt balance
    const wdOutcomes = await Promise.allSettled([
      requestWithdrawal({
        memberId: root.id,
        requestedPointsCents: 10000,
        payoutDestination: "TRC20-1",
      }),
      requestWithdrawal({
        memberId: root.id,
        requestedPointsCents: 10000,
        payoutDestination: "TRC20-2",
      }),
    ]);
    expect(wdOutcomes.filter((x) => x.status === "fulfilled").length).toBe(1);
    expect(wdOutcomes.filter((x) => x.status === "rejected").length).toBe(1);

    const winnerWd = (
      wdOutcomes.find((x) => x.status === "fulfilled") as PromiseFulfilledResult<{ id: string }>
    ).value;
    await approveWithdrawal({ withdrawalId: winnerWd.id, operatorId: root.id });
    await markWithdrawalPaid({
      withdrawalId: winnerWd.id,
      operatorId: root.id,
      payoutTxRef: "TX-CONC",
    });

    // Also verify reject releases locked balance
    await prisma.member.update({
      where: { id: root.id },
      data: { availablePointsCents: 13000 },
    });
    const wd130 = await requestWithdrawal({
      memberId: root.id,
      requestedPointsCents: 13000,
      payoutDestination: "TRC20-130",
    });
    expect(wd130.feeRateBpsSnapshot).toBe(2000);
    expect(wd130.feePointsCents).toBe(2600);
    expect(wd130.netPointsCents).toBe(10400);
    expect(wd130.estimatedUsdCents).toBe(10400);
    await rejectWithdrawal({
      withdrawalId: wd130.id,
      operatorId: root.id,
      reason: "Test release",
    });
    const rootAfterReject = await prisma.member.findUniqueOrThrow({ where: { id: root.id } });
    expect(rootAfterReject.availablePointsCents).toBe(13000);
    expect(rootAfterReject.lockedPointsCents).toBe(0);

    // Concurrent placement slot grab race
    const mA = await prisma.member.create({
      data: {
        memberCode: "BM100090",
        email: "racea@test.io",
        passwordHash: pwHash,
        displayName: "Race A",
        role: "MEMBER",
        status: "PENDING_PAYMENT",
        sponsorId: root.id,
        activeSettlementDate: "2026-11-16",
      },
    });
    const mB = await prisma.member.create({
      data: {
        memberCode: "BM100091",
        email: "raceb@test.io",
        passwordHash: pwHash,
        displayName: "Race B",
        role: "MEMBER",
        status: "PENDING_PAYMENT",
        sponsorId: root.id,
        activeSettlementDate: "2026-11-16",
      },
    });
    const oA = await createPackageOrder({
      memberId: mA.id,
      orderType: "INITIAL",
      targetPackageCode: "P100",
      payImmediatelyDemo: true,
      placementParentId: root.id,
      placementLeg: "LEFT",
      asOf: makeSgtDate("2026-11-16", "12:00:00"),
    });
    const oB = await createPackageOrder({
      memberId: mB.id,
      orderType: "INITIAL",
      targetPackageCode: "P100",
      payImmediatelyDemo: true,
      placementParentId: root.id,
      placementLeg: "LEFT",
      asOf: makeSgtDate("2026-11-16", "12:00:00"),
    });
    const [rA, rB] = await Promise.all([
      confirmPackageOrder({
        orderId: oA.id,
        operatorId: root.id,
        asOf: makeSgtDate("2026-11-16", "12:00:00"),
      }),
      confirmPackageOrder({
        orderId: oB.id,
        operatorId: root.id,
        asOf: makeSgtDate("2026-11-16", "12:00:00"),
      }),
    ]);
    expect([rA, rB].filter((x) => x.ok).length).toBe(1);
    expect([rA, rB].filter((x) => !x.ok).length).toBe(1);
  });

  it("Test 11: Pre-midnight confirmed order (23:55 SGT) delayed in processing settles on Day D before EOD; post-midnight (00:05 SGT) settles on Day D+1", async () => {
    const root = await prisma.member.findUniqueOrThrow({ where: { memberCode: "BM100001" } });

    const preMember = await prisma.member.create({
      data: {
        memberCode: "BM100095",
        email: "pre@test.io",
        passwordHash: pwHash,
        displayName: "Pre Midnight",
        role: "MEMBER",
        status: "PENDING_PAYMENT",
        sponsorId: root.id,
        activeSettlementDate: "2026-11-16",
      },
    });
    const postMember = await prisma.member.create({
      data: {
        memberCode: "BM100096",
        email: "post@test.io",
        passwordHash: pwHash,
        displayName: "Post Midnight",
        role: "MEMBER",
        status: "PENDING_PAYMENT",
        sponsorId: root.id,
        activeSettlementDate: "2026-11-17",
      },
    });

    const preOrder = await createPackageOrder({
      memberId: preMember.id,
      orderType: "INITIAL",
      targetPackageCode: "P500",
      payImmediatelyDemo: true,
      placementParentId: root.id,
      placementLeg: "LEFT",
      asOf: makeSgtDate("2026-11-16", "23:55:00"),
    });
    const postOrder = await createPackageOrder({
      memberId: postMember.id,
      orderType: "INITIAL",
      targetPackageCode: "P100",
      payImmediatelyDemo: true,
      placementParentId: root.id,
      placementLeg: "RIGHT",
      asOf: makeSgtDate("2026-11-17", "00:05:00"),
    });

    // Delayed processing at 00:08:00 SGT on 2026-11-17: pre-midnight order runs with businessAt=23:55:00 SGT,
    // then 00:00 EOD, then post-midnight order runs with businessAt=00:05:00 SGT.
    await confirmPackageOrder({
      orderId: preOrder.id,
      operatorId: root.id,
      asOf: makeSgtDate("2026-11-16", "23:55:00"),
      processedAt: makeSgtDate("2026-11-17", "00:08:00"),
    });
    await confirmPackageOrder({
      orderId: postOrder.id,
      operatorId: root.id,
      asOf: makeSgtDate("2026-11-17", "00:05:00"),
      processedAt: makeSgtDate("2026-11-17", "00:08:01"),
    });

    const eod = await prisma.dailySettlement.findUniqueOrThrow({
      where: {
        memberId_settlementDate: { memberId: root.id, settlementDate: "2026-11-16" },
      },
    });
    // Day 2026-11-16 EOD saw ONLY pre-midnight 500L (post-midnight 100R did NOT enter 2026-11-16 flush!)
    expect(eod.leftBvBefore).toBe(500);
    expect(eod.rightBvBefore).toBe(0);
    expect(eod.retainedSide).toBe("LEFT");

    // On 2026-11-17, retained 500L paired with post-midnight 100R -> 1 pair (10 pts), leaving 400L, 0R!
    const rootFinal = await prisma.member.findUniqueOrThrow({ where: { id: root.id } });
    expect(rootFinal.leftBv).toBe(400);
    expect(rootFinal.rightBv).toBe(0);
    expect(rootFinal.todayPairedPointsCents).toBe(1000);
  });

  it("Test 12: Withdrawal PAYOUT_PENDING_CHECK preserves lock, duplicate PAY callback is idempotent, and FAILED upgrade retries with original orderNo", async () => {
    const root = await prisma.member.findUniqueOrThrow({ where: { memberCode: "BM100001" } });
    await prisma.member.update({
      where: { id: root.id },
      data: { availablePointsCents: 20000, lockedPointsCents: 0 },
    });

    const wd = await requestWithdrawal({
      memberId: root.id,
      requestedPointsCents: 13000,
      payoutDestination: "TRC20-CHECK",
    });
    await approveWithdrawal({ withdrawalId: wd.id, operatorId: root.id });
    const pendingCheck = await markWithdrawalPendingCheck({
      withdrawalId: wd.id,
      operatorId: root.id,
      note: "Gateway timeout - reconciling",
    });
    expect(pendingCheck.status).toBe("PAYOUT_PENDING_CHECK");
    expect(pendingCheck.payoutStatus).toBe("PENDING_CHECK");

    // Lock must remain intact during PAYOUT_PENDING_CHECK
    const duringCheck = await prisma.member.findUniqueOrThrow({ where: { id: root.id } });
    expect(duringCheck.lockedPointsCents).toBe(13000);
    expect(duringCheck.availablePointsCents).toBe(7000);

    // Finalize paid + duplicate payout callback
    await markWithdrawalPaid({ withdrawalId: wd.id, operatorId: root.id, payoutTxRef: "TX-OK" });
    await markWithdrawalPaid({ withdrawalId: wd.id, operatorId: root.id, payoutTxRef: "TX-OK" });

    const afterPaid = await prisma.member.findUniqueOrThrow({ where: { id: root.id } });
    expect(afterPaid.lockedPointsCents).toBe(0);
    expect(afterPaid.availablePointsCents).toBe(7000);

    // Upgrade failure & retry preserving original orderNo
    const { member: m } = await createAndPlaceMember({
      memberCode: "BM100099",
      sponsorId: root.id,
      placementParentId: root.id,
      placementLeg: "LEFT",
      packageCode: "P100",
      asOf: makeSgtDate("2026-11-16", "10:00:00"),
      operatorId: root.id,
    });
    const upg = await createPackageOrder({
      memberId: m.id,
      orderType: "UPGRADE",
      targetPackageCode: "P500",
      payImmediatelyDemo: true,
      asOf: makeSgtDate("2026-11-16", "17:00:00"),
    });
    await confirmPackageOrder({
      orderId: upg.id,
      operatorId: root.id,
      asOf: makeSgtDate("2026-11-16", "17:00:00"),
    });

    // Simulate a FAILED upgrade status after effective time
    await prisma.packageOrder.update({
      where: { id: upg.id },
      data: {
        upgradeStatus: "FAILED",
        upgradeFailureReason: "Simulated transient failure",
      },
    });

    const retryRes = await retryUpgradeActivation({
      orderId: upg.id,
      operatorId: root.id,
      asOf: makeSgtDate("2026-11-18", "00:05:00"),
    });
    expect(retryRes.ok).toBe(true);
    expect(retryRes.orderNo).toBe(upg.orderNo);

    const retriedOrder = await prisma.packageOrder.findUniqueOrThrow({ where: { id: upg.id } });
    expect(retriedOrder.upgradeStatus).toBe("EFFECTIVE");
    expect(retriedOrder.upgradeFailureReason).toBeNull();
  });
});
