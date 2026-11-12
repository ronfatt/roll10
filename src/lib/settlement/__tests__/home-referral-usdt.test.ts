import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getNextSgtRolloverAt, makeSgtDate } from "@/lib/sgt";
import { getDictionary } from "@/lib/i18n";
import {
  formatBv,
  formatU,
  formatUsdtMicros,
} from "@/lib/money";
import { loadPortalHomeData } from "@/lib/portal-home";
import {
  computeMidnightCountdownState,
  formatMemberCountText,
} from "@/lib/rollover-clock";
import {
  confirmPackageOrder,
  createPackageOrder,
  reverseDirectReferralReward,
  runEodSettlement,
} from "@/lib/settlement/engine";

if (!process.env.DATABASE_URL?.includes("binary_member_portal_test")) {
  throw new Error(
    `Refusing to run test suite against non-test DATABASE_URL: ${process.env.DATABASE_URL}`
  );
}

let pwHash = "";

async function resetDb() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      audit_logs,
      wallet_ledgers,
      referral_reward_ledgers,
      bv_ledgers,
      binary_pairing_settlements,
      daily_settlements,
      chain_transfer_events,
      mock_chain_txs,
      member_saved_addresses,
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
      directRewardCurrency: "USDT",
      directUsdtConversionMicros: 1_000_000,
    },
  });

  await prisma.packageTier.createMany({
    data: [
      {
        code: "P100",
        nameEn: "Starter 100",
        nameZh: "入门配套 100",
        priceUsdCents: 10000,
        priceUsdtMicros: 100_000_000n,
        bv: 100,
        dailyCapPointsCents: 10000,
        sortOrder: 1,
      },
      {
        code: "P500",
        nameEn: "Pro 500",
        nameZh: "进阶配套 500",
        priceUsdCents: 50000,
        priceUsdtMicros: 500_000_000n,
        bv: 500,
        dailyCapPointsCents: 50000,
        sortOrder: 2,
      },
      {
        code: "P1000",
        nameEn: "Elite 1000",
        nameZh: "尊享配套 1000",
        priceUsdCents: 100000,
        priceUsdtMicros: 1_000_000_000n,
        bv: 1000,
        dailyCapPointsCents: 100000,
        sortOrder: 3,
      },
    ],
  });
}

beforeAll(async () => {
  pwHash = await bcrypt.hash("TestPass123!", 8);
});

beforeEach(async () => {
  await resetDb();
});

describe("Home Redesign, Direct Referral USDT & Midnight Countdown Suite", () => {
  it("V.1 validates showcase metrics: 200 pts, 40/1,000 pts matching, 6 directs, 150.00 U, L 4,300 BV / 10 members, R 0 BV / 1 member", async () => {
    const asOf = makeSgtDate("2026-11-16", "15:00:00");

    const root = await prisma.member.create({
      data: {
        memberCode: "BM100001",
        email: "root@showcase.io",
        passwordHash: pwHash,
        displayName: "Root",
        role: "ADMIN",
        status: "ACTIVE",
        currentPackageCode: "P1000",
        dailyCapPointsCents: 100000,
        activeSettlementDate: "2026-11-16",
        activatedAt: asOf,
      },
    });

    const target = await prisma.member.create({
      data: {
        memberCode: "BM100002",
        email: "showcase@test.io",
        passwordHash: pwHash,
        displayName: "Showcase Leader",
        role: "MEMBER",
        status: "ACTIVE",
        sponsorId: root.id,
        placementParentId: root.id,
        placementLeg: "LEFT",
        currentPackageCode: "P1000",
        dailyCapPointsCents: 100000,
        leftBv: 4300,
        rightBv: 0,
        todayPairedPointsCents: 4000,
        availablePointsCents: 20000,
        activeSettlementDate: "2026-11-16",
        activatedAt: asOf,
      },
    });

    // Place 10 active members under LEFT subtree and 1 active member under RIGHT subtree
    let leftCursor = target.id;
    for (let i = 1; i <= 10; i++) {
      const m = await prisma.member.create({
        data: {
          memberCode: `BM2000${String(i).padStart(2, "0")}`,
          email: `l${i}@test.io`,
          passwordHash: pwHash,
          displayName: `Left Node ${i}`,
          role: "MEMBER",
          status: "ACTIVE",
          // First 6 are directly sponsored by `target`, next 4 are downline-sponsored (do not inflate directReferralCount!)
          sponsorId: i <= 6 ? target.id : leftCursor,
          placementParentId: leftCursor,
          placementLeg: "LEFT",
          currentPackageCode: "P100",
          dailyCapPointsCents: 10000,
          activeSettlementDate: "2026-11-16",
          activatedAt: asOf,
        },
      });
      if (i === 1) leftCursor = m.id;
      else leftCursor = m.id;
    }

    await prisma.member.create({
      data: {
        memberCode: "BM300001",
        email: "r1@test.io",
        passwordHash: pwHash,
        displayName: "Right Node 1",
        role: "MEMBER",
        status: "ACTIVE",
        sponsorId: root.id,
        placementParentId: target.id,
        placementLeg: "RIGHT",
        currentPackageCode: "P100",
        dailyCapPointsCents: 10000,
        activeSettlementDate: "2026-11-16",
        activatedAt: asOf,
      },
    });

    // 6 directs generated total 150.00 U (e.g., 6 * 100 BV * 25% = 150.00 U)
    const src = await prisma.member.findUniqueOrThrow({ where: { memberCode: "BM200001" } });
    const srcOrd = await prisma.packageOrder.create({
      data: {
        orderNo: "ORD-SHOWCASE-150U",
        memberId: src.id,
        orderType: "INITIAL",
        targetPackageCode: "P100",
        amountUsdCents: 60000,
        bvAmount: 600,
        commissionableBv: 600,
        paymentStatus: "PAID",
        status: "CONFIRMED",
      },
    });
    await prisma.referralRewardLedger.create({
      data: {
        rewardNo: "RR-SHOWCASE-01",
        eventKey: `direct_usdt:${srcOrd.id}:${target.id}`,
        memberId: target.id,
        sourceMemberId: src.id,
        orderId: srcOrd.id,
        currency: "USDT",
        baseBv: 600,
        rateBps: 2500,
        conversionMicros: 1_000_000,
        amountMicros: 150_000_000n,
        status: "CREDITED",
        creditedAt: asOf,
      },
    });

    const homeEn = await loadPortalHomeData(target.id, "en", asOf);
    expect(homeEn).not.toBeNull();
    expect(formatU(homeEn!.member.availablePointsCents)).toBe("200");
    expect(formatU(homeEn!.member.todayPairedCents)).toBe("40");
    expect(formatU(homeEn!.member.dailyCapPointsCents)).toBe("1,000");
    expect(homeEn!.member.directReferralCount).toBe(6);
    expect(formatUsdtMicros(homeEn!.member.directReferralUsdtMicros, "U")).toBe("150 U");
    expect(formatBv(homeEn!.member.leftBv)).toBe("4,300 BV");
    expect(formatBv(homeEn!.member.rightBv)).toBe("0 BV");
    expect(homeEn!.member.leftCount).toBe(10);
    expect(homeEn!.member.rightCount).toBe(1);
    expect(formatMemberCountText(homeEn!.member.leftCount, "en")).toBe("10 members");
    expect(formatMemberCountText(homeEn!.member.rightCount, "en")).toBe("1 member");
    expect(formatMemberCountText(homeEn!.member.rightCount, "zh-CN")).toBe("1 人");
    expect(homeEn!.eodPreview.retainedSide).toBe("LEFT");
    expect(homeEn!.eodPreview.carryoverBv).toBe(4300);
    expect(homeEn!.eodPreview.flushedBv).toBe(0);
  });

  it("V.2 & V.3 enforces direct-only referral count, pending exclusion, reversal accounting, idempotency, and dual-currency coexistence", async () => {
    const t0 = makeSgtDate("2026-11-16", "10:00:00");
    const root = await prisma.member.create({
      data: {
        memberCode: "BM100001",
        email: "root@t.io",
        passwordHash: pwHash,
        displayName: "Root",
        role: "ADMIN",
        status: "ACTIVE",
        currentPackageCode: "P1000",
        dailyCapPointsCents: 100000,
        activeSettlementDate: "2026-11-16",
        activatedAt: t0,
      },
    });

    const sponsor = await prisma.member.create({
      data: {
        memberCode: "BM100002",
        email: "sponsor@t.io",
        passwordHash: pwHash,
        displayName: "Sponsor",
        role: "MEMBER",
        status: "ACTIVE",
        sponsorId: root.id,
        placementParentId: root.id,
        placementLeg: "LEFT",
        currentPackageCode: "P100",
        dailyCapPointsCents: 10000,
        availablePointsCents: 5000, // Historical 50.00 pts
        activeSettlementDate: "2026-11-16",
        activatedAt: t0,
      },
    });

    // Legacy pts direct commission row preserved in wallet_ledgers
    await prisma.walletLedger.create({
      data: {
        ledgerNo: "WL-LEGACY-01",
        eventKey: "legacy_direct_01",
        memberId: sponsor.id,
        entryType: "DIRECT_COMMISSION",
        deltaAvailableCents: 5000,
        deltaLockedCents: 0,
        availableAfterCents: 5000,
        lockedAfterCents: 0,
        note: "Historical PTS direct reward",
      },
    });

    // Sponsor directly refers A (active P100) and B (pending P500), and A refers C (active P100)
    const memberA = await prisma.member.create({
      data: {
        memberCode: "BM100003",
        email: "a@t.io",
        passwordHash: pwHash,
        displayName: "Member A",
        role: "MEMBER",
        status: "PENDING_PAYMENT",
        sponsorId: sponsor.id,
        activeSettlementDate: "2026-11-16",
      },
    });
    const ordA = await createPackageOrder({
      memberId: memberA.id,
      orderType: "INITIAL",
      targetPackageCode: "P100",
      payImmediatelyDemo: true,
      placementParentId: sponsor.id,
      placementLeg: "LEFT",
      asOf: t0,
    });
    await confirmPackageOrder({ orderId: ordA.id, operatorId: root.id, asOf: t0 });

    const memberB = await prisma.member.create({
      data: {
        memberCode: "BM100004",
        email: "b@t.io",
        passwordHash: pwHash,
        displayName: "Member B",
        role: "MEMBER",
        status: "PENDING_PAYMENT",
        sponsorId: sponsor.id,
        activeSettlementDate: "2026-11-16",
      },
    });
    const ordB = await createPackageOrder({
      memberId: memberB.id,
      orderType: "INITIAL",
      targetPackageCode: "P500",
      payImmediatelyDemo: false,
      placementParentId: sponsor.id,
      placementLeg: "RIGHT",
      asOf: t0,
    });

    const memberC = await prisma.member.create({
      data: {
        memberCode: "BM100005",
        email: "c@t.io",
        passwordHash: pwHash,
        displayName: "Member C (Grandchild)",
        role: "MEMBER",
        status: "PENDING_PAYMENT",
        sponsorId: memberA.id,
        activeSettlementDate: "2026-11-16",
      },
    });
    const ordC = await createPackageOrder({
      memberId: memberC.id,
      orderType: "INITIAL",
      targetPackageCode: "P100",
      payImmediatelyDemo: true,
      placementParentId: memberA.id,
      placementLeg: "LEFT",
      asOf: t0,
    });
    await confirmPackageOrder({ orderId: ordC.id, operatorId: root.id, asOf: t0 });

    // Before B confirms:
    // - Direct referral count = 2 (A & B, excludes grandchild C!)
    // - Earned USDT = 25.00 U (from A only; B is unconfirmed -> pending USDT = 125.00 U)
    // - Historical pts stays 50.00 pts; USDT does not consume pairing cap (0 paired)
    const homeBeforeB = await loadPortalHomeData(sponsor.id, "en", t0);
    expect(homeBeforeB!.member.directReferralCount).toBe(2);
    expect(homeBeforeB!.member.directReferralActiveCount).toBe(1);
    expect(homeBeforeB!.member.directReferralPendingCount).toBe(1);
    expect(homeBeforeB!.member.directReferralUsdtMicros).toBe("25000000");
    expect(homeBeforeB!.member.directReferralPendingUsdtMicros).toBe("125000000");
    expect(homeBeforeB!.member.directCommissionCents).toBe(5000);
    expect(homeBeforeB!.member.availablePointsCents).toBe(5000);
    expect(homeBeforeB!.member.todayPairedCents).toBe(0);

    // Confirm B + duplicate callback -> adds 125.00 U ONCE (total 150.00 U) + B's 500 BV triggers pairing cap cleanly
    await confirmPackageOrder({
      orderId: ordB.id,
      operatorId: root.id,
      markPaidDemo: true,
      asOf: makeSgtDate("2026-11-16", "11:00:00"),
    });
    await confirmPackageOrder({
      orderId: ordB.id,
      operatorId: root.id,
      asOf: makeSgtDate("2026-11-16", "11:00:00"),
    });

    const homeAfterB = await loadPortalHomeData(sponsor.id, "en", t0);
    expect(homeAfterB!.member.directReferralUsdtMicros).toBe("150000000");
    expect(homeAfterB!.member.directReferralPendingUsdtMicros).toBe("0");

    // Reversal deducts credited USDT safely & idempotently
    await reverseDirectReferralReward({
      orderId: ordB.id,
      reason: "Chargeback reversal test",
      operatorId: root.id,
      asOf: makeSgtDate("2026-11-16", "12:00:00"),
    });
    const homeAfterRev = await loadPortalHomeData(sponsor.id, "en", t0);
    expect(homeAfterRev!.member.directReferralUsdtMicros).toBe("25000000");
  });

  it("V.4 runs midnight countdown through <15m amber/normal states, 00:00:00 settling wait, EOD completion, and next-day rollover", async () => {
    const preRolloverFlush = makeSgtDate("2026-11-16", "23:59:10");
    const { nextRolloverAt } = getNextSgtRolloverAt(preRolloverFlush);
    expect(nextRolloverAt.getTime()).toBe(makeSgtDate("2026-11-17", "00:00:00").getTime());

    // < 15m with flushedBv > 0 -> warm amber
    const urgentState = computeMidnightCountdownState({
      serverNowIso: preRolloverFlush.toISOString(),
      nextRolloverAtIso: nextRolloverAt.toISOString(),
      elapsedClientMs: 0,
      flushedBv: 300,
    });
    expect(urgentState.hhmmss).toBe("00:00:50");
    expect(urgentState.isUrgentAmber).toBe(true);
    expect(urgentState.isSettling).toBe(false);

    // < 15m with flushedBv === 0 -> stays regular gold (no amber alert)
    const zeroFlushState = computeMidnightCountdownState({
      serverNowIso: preRolloverFlush.toISOString(),
      nextRolloverAtIso: nextRolloverAt.toISOString(),
      elapsedClientMs: 0,
      flushedBv: 0,
    });
    expect(zeroFlushState.isUrgentAmber).toBe(false);

    // Crossing 00:00:00 -> enters settling state
    const atZeroState = computeMidnightCountdownState({
      serverNowIso: preRolloverFlush.toISOString(),
      nextRolloverAtIso: nextRolloverAt.toISOString(),
      elapsedClientMs: 55 * 1000,
      flushedBv: 300,
    });
    expect(atZeroState.hhmmss).toBe("00:00:00");
    expect(atZeroState.isSettling).toBe(true);

    // Execute actual EOD settlement and verify next cycle server payload
    const m = await prisma.member.create({
      data: {
        memberCode: "BM100001",
        email: "eod@t.io",
        passwordHash: pwHash,
        displayName: "EOD Member",
        role: "ADMIN",
        status: "ACTIVE",
        currentPackageCode: "P100",
        dailyCapPointsCents: 10000,
        leftBv: 500,
        rightBv: 300,
        activeSettlementDate: "2026-11-16",
        activatedAt: makeSgtDate("2026-11-15", "09:00:00"),
      },
    });
    await runEodSettlement({
      targetCurrentSgtDate: "2026-11-17",
      asOf: makeSgtDate("2026-11-17", "00:00:05"),
      processedAt: makeSgtDate("2026-11-17", "00:00:05"),
      triggeredBy: "CRON",
    });

    const postEodHome = await loadPortalHomeData(
      m.id,
      "en",
      makeSgtDate("2026-11-17", "00:00:05")
    );
    expect(postEodHome!.latestEod?.settlementDate).toBe("2026-11-16");
    expect(postEodHome!.latestEod?.retainedSide).toBe("LEFT");
    expect(postEodHome!.latestEod?.flushedBv).toBe(300);
    expect(postEodHome!.nextRolloverAtIso).toBe(
      makeSgtDate("2026-11-18", "00:00:00").toISOString()
    );
  });

  it("V.5 verifies 500 BV direct -> 125 U, 100+100 BV pairing -> 10 U, BV-only EOD rollover, and unified i18n units", async () => {
    const t0 = makeSgtDate("2026-11-16", "09:00:00");
    const admin = await prisma.member.create({
      data: {
        memberCode: "BM100001",
        email: "admin-u@t.io",
        passwordHash: pwHash,
        displayName: "Admin U",
        role: "ADMIN",
        status: "ACTIVE",
        currentPackageCode: "P1000",
        dailyCapPointsCents: 100000,
        activeSettlementDate: "2026-11-16",
        activatedAt: t0,
      },
    });

    const p500Buyer = await prisma.member.create({
      data: {
        memberCode: "BM100002",
        email: "p500-u@t.io",
        passwordHash: pwHash,
        displayName: "Buyer P500",
        role: "MEMBER",
        status: "PENDING_PAYMENT",
        sponsorId: admin.id,
        activeSettlementDate: "2026-11-16",
      },
    });
    const ord500 = await createPackageOrder({
      memberId: p500Buyer.id,
      orderType: "INITIAL",
      targetPackageCode: "P500",
      placementParentId: admin.id,
      placementLeg: "LEFT",
      asOf: t0,
    });
    await confirmPackageOrder({
      orderId: ord500.id,
      operatorId: admin.id,
      placementParentId: admin.id,
      placementLeg: "LEFT",
      markPaidDemo: true,
      asOf: makeSgtDate("2026-11-16", "09:05:00"),
    });

    const directLedger500 = await prisma.referralRewardLedger.findFirstOrThrow({
      where: { orderId: ord500.id, memberId: admin.id },
    });
    expect(directLedger500.baseBv).toBe(500);
    expect(directLedger500.amountMicros).toBe(125_000_000n);
    expect(formatUsdtMicros(directLedger500.amountMicros, "U")).toBe("125 U");

    // 500 BV on Left + 0 BV on Right so far -> 0 paired, wallet = 0 U
    let adminState = await prisma.member.findUniqueOrThrow({ where: { id: admin.id } });
    expect(adminState.leftBv).toBe(500);
    expect(adminState.rightBv).toBe(0);
    expect(adminState.todayPairedPointsCents).toBe(0);

    // Place a 100 BV (P100) buyer on Right -> pairs 100 BV L + 100 BV R = 10 U, leaving 400 BV L / 0 BV R
    const p100Buyer = await prisma.member.create({
      data: {
        memberCode: "BM100003",
        email: "p100-u@t.io",
        passwordHash: pwHash,
        displayName: "Buyer P100",
        role: "MEMBER",
        status: "PENDING_PAYMENT",
        sponsorId: p500Buyer.id,
        activeSettlementDate: "2026-11-16",
      },
    });
    const ord100 = await createPackageOrder({
      memberId: p100Buyer.id,
      orderType: "INITIAL",
      targetPackageCode: "P100",
      placementParentId: admin.id,
      placementLeg: "RIGHT",
      asOf: makeSgtDate("2026-11-16", "09:10:00"),
    });
    await confirmPackageOrder({
      orderId: ord100.id,
      operatorId: admin.id,
      placementParentId: admin.id,
      placementLeg: "RIGHT",
      markPaidDemo: true,
      asOf: makeSgtDate("2026-11-16", "09:15:00"),
    });

    adminState = await prisma.member.findUniqueOrThrow({ where: { id: admin.id } });
    expect(adminState.leftBv).toBe(400);
    expect(adminState.rightBv).toBe(0);
    expect(adminState.todayPairedPointsCents).toBe(1000);
    expect(adminState.availablePointsCents).toBe(1000);
    expect(formatU(adminState.availablePointsCents)).toBe("10");

    // Midnight 00:00 SGT rollover affects team BV & daily pairing counter only; U wallet & referral U unchanged
    await runEodSettlement({
      targetCurrentSgtDate: "2026-11-17",
      asOf: makeSgtDate("2026-11-17", "00:00:05"),
      processedAt: makeSgtDate("2026-11-17", "00:00:05"),
      triggeredBy: "CRON",
    });

    const afterEod = await prisma.member.findUniqueOrThrow({ where: { id: admin.id } });
    expect(afterEod.leftBv).toBe(400);
    expect(afterEod.rightBv).toBe(0);
    expect(afterEod.availablePointsCents).toBe(1000);
    const directSumAfter = await prisma.referralRewardLedger.aggregate({
      where: { memberId: admin.id, status: "CREDITED" },
      _sum: { amountMicros: true },
    });
    expect(directSumAfter._sum.amountMicros).toBe(125_000_000n);

    // Check EN & zh-CN dictionary value strings (no pts / Points / 积分 / US$)
    function collectLeafStrings(obj: unknown): string[] {
      if (typeof obj === "string") return [obj];
      if (obj && typeof obj === "object") {
        return Object.values(obj).flatMap((v) => collectLeafStrings(v));
      }
      return [];
    }
    for (const loc of ["en", "zh-CN"] as const) {
      const leafJoined = collectLeafStrings(getDictionary(loc)).join(" | ");
      expect(leafJoined).not.toMatch(/\bpts\b|Points|积分|US\$/);
    }
  });
});
