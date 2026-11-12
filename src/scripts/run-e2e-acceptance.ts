import "dotenv/config";
import bcrypt from "bcryptjs";
import { TestClock } from "../lib/test-clock";
import { formatPoints, formatUsd } from "../lib/money";
import { prisma } from "../lib/db";

if (!process.env.DATABASE_URL?.includes("binary_member_portal_test")) {
  throw new Error(
    `Refusing to run E2E acceptance truncation against non-test DATABASE_URL: ${process.env.DATABASE_URL}`
  );
}
import {
  confirmPackageOrder,
  createPackageOrder,
  processDueUpgrades,
  runEodSettlement,
} from "../lib/settlement/engine";
import {
  approveWithdrawal,
  markWithdrawalPaid,
  markWithdrawalPendingCheck,
  rejectWithdrawal,
  requestWithdrawal,
} from "../lib/settlement/withdrawals";

interface AcceptanceRow {
  scenario: string;
  expected: string;
  actual: string;
  refNo: string;
  status: "PASS" | "FAIL";
}

async function main() {
  const clock = new TestClock("2026-11-16", "09:00:00");
  const pwHash = await bcrypt.hash("Test1234!", 8);
  const rows: AcceptanceRow[] = [];

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      audit_logs, wallet_ledgers, referral_reward_ledgers, bv_ledgers, binary_pairing_settlements,
      daily_settlements, withdrawal_requests, package_orders, members,
      package_tiers, rule_version_records, system_configs
    RESTART IDENTITY CASCADE
  `);

  await prisma.systemConfig.create({
    data: { id: 1, directRewardCurrency: "POINTS" },
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
      changeNote: "E2E acceptance baseline",
    },
  });
  await prisma.packageTier.createMany({
    data: [
      { code: "P100", nameEn: "Starter 100", nameZh: "入门 100", priceUsdCents: 10000, bv: 100, dailyCapPointsCents: 10000, sortOrder: 1 },
      { code: "P500", nameEn: "Pro 500", nameZh: "进阶 500", priceUsdCents: 50000, bv: 500, dailyCapPointsCents: 50000, sortOrder: 2 },
      { code: "P1000", nameEn: "Elite 1000", nameZh: "尊享 1000", priceUsdCents: 100000, bv: 1000, dailyCapPointsCents: 100000, sortOrder: 3 },
    ],
  });

  const root = await prisma.member.create({
    data: {
      memberCode: "BM100001",
      email: "root@e2e.io",
      passwordHash: pwHash,
      displayName: "Root",
      role: "ADMIN",
      status: "ACTIVE",
      currentPackageCode: "P1000",
      dailyCapPointsCents: 100000,
      activeSettlementDate: clock.sgtDate(),
      activatedAt: clock.now(),
    },
  });

  // Scenario A: Referral registration + 500 BV order + duplicate callback
  const aSponsor = await prisma.member.create({
    data: {
      memberCode: "BM100002",
      email: "sponsor@e2e.io",
      passwordHash: pwHash,
      displayName: "Sponsor A",
      role: "MEMBER",
      status: "PENDING_PAYMENT",
      sponsorId: root.id,
      activeSettlementDate: clock.sgtDate(),
    },
  });
  const oS = await createPackageOrder({
    memberId: aSponsor.id,
    orderType: "INITIAL",
    targetPackageCode: "P100",
    payImmediatelyDemo: true,
    placementParentId: root.id,
    placementLeg: "LEFT",
    asOf: clock.now(),
  });
  await confirmPackageOrder({ orderId: oS.id, operatorId: root.id, asOf: clock.now() });

  clock.advanceSeconds(300);
  const aDownline = await prisma.member.create({
    data: {
      memberCode: "BM100003",
      email: "downline@e2e.io",
      passwordHash: pwHash,
      displayName: "Downline A",
      role: "MEMBER",
      status: "PENDING_PAYMENT",
      sponsorId: aSponsor.id,
      activeSettlementDate: clock.sgtDate(),
    },
  });
  const oA = await createPackageOrder({
    memberId: aDownline.id,
    orderType: "INITIAL",
    targetPackageCode: "P500",
    payImmediatelyDemo: true,
    placementParentId: aSponsor.id,
    placementLeg: "LEFT",
    asOf: clock.now(),
  });
  await confirmPackageOrder({ orderId: oA.id, operatorId: root.id, asOf: clock.now() });
  await confirmPackageOrder({ orderId: oA.id, operatorId: root.id, asOf: clock.now() });

  const sAfterA = await prisma.member.findUniqueOrThrow({ where: { id: aSponsor.id } });
  rows.push({
    scenario: "A. Direct 500 BV + Duplicate Callback",
    expected: "Sponsor +125 Pts once, Left +500 BV, Paired=0",
    actual: `Avail ${formatPoints(sAfterA.availablePointsCents)} Pts, Left ${sAfterA.leftBv} BV, Paired ${formatPoints(sAfterA.todayPairedPointsCents)}`,
    refNo: oA.orderNo,
    status: sAfterA.availablePointsCents === 12500 && sAfterA.leftBv === 500 && sAfterA.todayPairedPointsCents === 0 ? "PASS" : "FAIL",
  });

  // Scenario B: Cap hit (100 tier, 1500L / 1500R -> 100 pts paired, 500/500 remain)
  const capMember = await prisma.member.create({
    data: {
      memberCode: "BM100004",
      email: "cap@e2e.io",
      passwordHash: pwHash,
      displayName: "Cap Member",
      role: "MEMBER",
      status: "PENDING_PAYMENT",
      sponsorId: root.id,
      activeSettlementDate: clock.sgtDate(),
    },
  });
  const oCap = await createPackageOrder({
    memberId: capMember.id,
    orderType: "INITIAL",
    targetPackageCode: "P100",
    payImmediatelyDemo: true,
    placementParentId: root.id,
    placementLeg: "RIGHT",
    asOf: clock.now(),
  });
  await confirmPackageOrder({ orderId: oCap.id, operatorId: root.id, asOf: clock.now() });

  // Place 500L + 1000L and 500R + 1000R under capMember
  const helperCodes = [
    { code: "BM100005", parent: capMember.id, leg: "LEFT" as const, pkg: "P500" as const },
    { code: "BM100006", parent: capMember.id, leg: "RIGHT" as const, pkg: "P500" as const },
  ];
  const childrenIds: string[] = [];
  for (const h of helperCodes) {
    const m = await prisma.member.create({
      data: {
        memberCode: h.code,
        email: `${h.code}@e2e.io`,
        passwordHash: pwHash,
        displayName: h.code,
        role: "MEMBER",
        status: "PENDING_PAYMENT",
        sponsorId: root.id,
        activeSettlementDate: clock.sgtDate(),
      },
    });
    const ord = await createPackageOrder({
      memberId: m.id,
      orderType: "INITIAL",
      targetPackageCode: h.pkg,
      payImmediatelyDemo: true,
      placementParentId: h.parent,
      placementLeg: h.leg,
      asOf: clock.now(),
    });
    await confirmPackageOrder({ orderId: ord.id, operatorId: root.id, asOf: clock.now() });
    childrenIds.push(m.id);
  }
  for (const [idx, pId] of childrenIds.entries()) {
    const code = idx === 0 ? "BM100007" : "BM100008";
    const leg = idx === 0 ? ("LEFT" as const) : ("RIGHT" as const);
    const m = await prisma.member.create({
      data: {
        memberCode: code,
        email: `${code}@e2e.io`,
        passwordHash: pwHash,
        displayName: code,
        role: "MEMBER",
        status: "PENDING_PAYMENT",
        sponsorId: root.id,
        activeSettlementDate: clock.sgtDate(),
      },
    });
    const ord = await createPackageOrder({
      memberId: m.id,
      orderType: "INITIAL",
      targetPackageCode: "P1000",
      payImmediatelyDemo: true,
      placementParentId: pId,
      placementLeg: leg,
      asOf: clock.now(),
    });
    await confirmPackageOrder({ orderId: ord.id, operatorId: root.id, asOf: clock.now() });
  }
  const capAfter = await prisma.member.findUniqueOrThrow({ where: { id: capMember.id } });
  const capPairing = await prisma.binaryPairingSettlement.findFirstOrThrow({
    where: { memberId: capMember.id },
    orderBy: { createdAt: "desc" },
  });
  rows.push({
    scenario: "B. P100 1500/1500 BV Cap",
    expected: "10 pairs (100 Pts), Left=500, Right=500",
    actual: `Paired ${formatPoints(capAfter.todayPairedPointsCents)} Pts, Left ${capAfter.leftBv}, Right ${capAfter.rightBv}`,
    refNo: capPairing.settlementNo,
    status: capAfter.todayPairedPointsCents === 10000 && capAfter.leftBv === 500 && capAfter.rightBv === 500 ? "PASS" : "FAIL",
  });

  // Scenario D: Mon 17:00 SGT Upgrade P100->P500 -> Wed 00:01:00 SGT effective (delayed task)
  clock.setSgt("2026-11-16", "17:00:00");
  const upgOrd = await createPackageOrder({
    memberId: capMember.id,
    orderType: "UPGRADE",
    targetPackageCode: "P500",
    payImmediatelyDemo: true,
    asOf: clock.now(),
  });
  await confirmPackageOrder({ orderId: upgOrd.id, operatorId: root.id, asOf: clock.now() });

  // Advance to Wed 2026-11-18 00:00:30 SGT (before 00:01:00!) -> run EOD first for Tue
  clock.setSgt("2026-11-18", "00:00:30");
  await runEodSettlement({ targetCurrentSgtDate: "2026-11-18", asOf: clock.now() });
  const before0001 = await prisma.member.findUniqueOrThrow({ where: { id: capMember.id } });

  // Advance to Wed 00:05:00 SGT (delayed upgrade cron) -> processDueUpgrades activates P500
  clock.setSgt("2026-11-18", "00:05:00");
  await processDueUpgrades({ asOf: clock.now(), triggeredBy: "CRON" });
  const after0001 = await prisma.member.findUniqueOrThrow({ where: { id: capMember.id } });
  const eodRec = await prisma.dailySettlement.findFirstOrThrow({
    where: { memberId: capMember.id, settlementDate: "2026-11-17" },
  });
  // Idempotent EOD re-run
  await runEodSettlement({ targetCurrentSgtDate: "2026-11-18", asOf: clock.now() });

  rows.push({
    scenario: "C & D. EOD Carryover + Mon 17:00 -> Wed 00:01 Upgrade",
    expected: "00:00:30 still P100; EOD once; 00:01+ switches to P500",
    actual: `00:00:30=${before0001.currentPackageCode}, EOD=${eodRec.retainedSide} (${eodRec.decisionBasis}), 00:05=${after0001.currentPackageCode}`,
    refNo: `${eodRec.settlementNo} / ${upgOrd.orderNo}`,
    status: before0001.currentPackageCode === "P100" && after0001.currentPackageCode === "P500" ? "PASS" : "FAIL",
  });

  // Scenario E: Withdrawal 130 Pts -> 26 fee -> 104 net -> US$104 + Pending Check + Paid + Duplicate callback
  await prisma.member.update({
    where: { id: aSponsor.id },
    data: { availablePointsCents: 20000 },
  });
  const wd130 = await requestWithdrawal({
    memberId: aSponsor.id,
    requestedPointsCents: 13000,
    payoutDestination: "TRC20-E2E-130",
    asOf: clock.now(),
  });
  await approveWithdrawal({ withdrawalId: wd130.id, operatorId: root.id, asOf: clock.now() });
  await markWithdrawalPendingCheck({
    withdrawalId: wd130.id,
    operatorId: root.id,
    note: "Gateway uncertain",
    asOf: clock.now(),
  });
  const lockedDuringCheck = await prisma.member.findUniqueOrThrow({ where: { id: aSponsor.id } });
  await markWithdrawalPaid({
    withdrawalId: wd130.id,
    operatorId: root.id,
    payoutTxRef: "E2E-TX-104",
    asOf: clock.now(),
  });
  // Duplicate payout callback
  await markWithdrawalPaid({
    withdrawalId: wd130.id,
    operatorId: root.id,
    payoutTxRef: "E2E-TX-104",
    asOf: clock.now(),
  });
  const afterPay = await prisma.member.findUniqueOrThrow({ where: { id: aSponsor.id } });

  // Also verify rejection release
  const wdReject = await requestWithdrawal({
    memberId: aSponsor.id,
    requestedPointsCents: 2000,
    payoutDestination: "TRC20-E2E-REJ",
    asOf: clock.now(),
  });
  await rejectWithdrawal({
    withdrawalId: wdReject.id,
    operatorId: root.id,
    reason: "Invalid wallet",
    asOf: clock.now(),
  });
  const afterReject = await prisma.member.findUniqueOrThrow({ where: { id: aSponsor.id } });

  rows.push({
    scenario: "E. Withdrawal 130 Pts + Pending Check + Duplicate Pay + Reject",
    expected: "Fee 26, Net 104 (US$104), Lock 130->0, Reject releases 20",
    actual: `Net ${formatPoints(wd130.netPointsCents)} (${formatUsd(wd130.estimatedUsdCents)}), CheckLock=${formatPoints(lockedDuringCheck.lockedPointsCents)}, AfterPayAvail=${formatPoints(afterPay.availablePointsCents)}, AfterRejAvail=${formatPoints(afterReject.availablePointsCents)}`,
    refNo: `${wd130.withdrawalNo} / ${wdReject.withdrawalNo}`,
    status:
      wd130.feePointsCents === 2600 &&
      wd130.netPointsCents === 10400 &&
      lockedDuringCheck.lockedPointsCents === 13000 &&
      afterPay.availablePointsCents === 7000 &&
      afterPay.lockedPointsCents === 0 &&
      afterReject.availablePointsCents === 7000
        ? "PASS"
        : "FAIL",
  });

  console.table(rows);
  if (rows.some((r) => r.status === "FAIL")) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
