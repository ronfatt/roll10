import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { getSgtDateString, addDaysToSgtDate, makeSgtDate } from "../src/lib/sgt";
import {
  confirmPackageOrder,
  createPackageOrder,
  runEodSettlement,
} from "../src/lib/settlement/engine";
import { requestWithdrawal } from "../src/lib/settlement/withdrawals";
import { registerMockChainTx } from "../src/lib/usdt/chain-verifier";

async function main() {
  console.log("Seeding Binary Member Portal...");

  const existingRoot = await prisma.member.findUnique({
    where: { memberCode: "BM100001" },
  });
  if (existingRoot) {
    console.log("Seed data already exists (BM100001 present). Skipping re-seed.");
    return;
  }

  const cfg = await prisma.systemConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
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
    },
  });

  await prisma.ruleVersionRecord.upsert({
    where: { version: cfg.ruleVersion },
    update: {},
    create: {
      version: cfg.ruleVersion,
      tieBreakerRule: cfg.tieBreakerRule,
      headcountRule: cfg.headcountRule,
      upgradePriceMode: cfg.upgradePriceMode,
      upgradeGrantsBv: cfg.upgradeGrantsBv,
      upgradeTriggersDirectCommission: cfg.upgradeTriggersDirectCommission,
      upgradeEffectiveDaysOffset: cfg.upgradeEffectiveDaysOffset,
      upgradeEffectiveTimeSgt: cfg.upgradeEffectiveTimeSgt,
      directCommissionRateBps: cfg.directCommissionRateBps,
      pairingUnitBv: cfg.pairingUnitBv,
      pairingRewardPointsCents: cfg.pairingRewardPointsCents,
      withdrawalFeeRateBps: cfg.withdrawalFeeRateBps,
      withdrawalUsdRateMicros: cfg.withdrawalUsdRateMicros,
      isDemoRate: cfg.isDemoRate,
      productionPayoutEnabled: cfg.productionPayoutEnabled,
      changeNote: "Initial seed configuration (D+2 00:01:00 SGT)",
    },
  });

  const tiers = [
    {
      code: "P100",
      nameEn: "Silver",
      nameZh: "Silver (白银)",
      priceUsdCents: 10000,
      priceUsdtMicros: BigInt(100_000_000),
      bv: 100,
      dailyCapPointsCents: 10000,
      sortOrder: 1,
    },
    {
      code: "P500",
      nameEn: "Gold",
      nameZh: "Gold (黄金)",
      priceUsdCents: 50000,
      priceUsdtMicros: BigInt(500_000_000),
      bv: 500,
      dailyCapPointsCents: 50000,
      sortOrder: 2,
    },
    {
      code: "P1000",
      nameEn: "Diamond",
      nameZh: "Diamond (钻石)",
      priceUsdCents: 100000,
      priceUsdtMicros: BigInt(1_000_000_000),
      bv: 1000,
      dailyCapPointsCents: 100000,
      sortOrder: 3,
    },
  ];

  for (const tier of tiers) {
    await prisma.packageTier.upsert({
      where: { code: tier.code },
      update: tier,
      create: tier,
    });
  }

  const passwordHash = await bcrypt.hash("Password123!", 10);
  const todaySgt = getSgtDateString(new Date());
  const yesterdaySgt = addDaysToSgtDate(todaySgt, -1);
  const yesterdayMorning = makeSgtDate(yesterdaySgt, "10:00:00");
  const todayMorning = makeSgtDate(todaySgt, "09:30:00");

  // 1) Admin Root Node (BM100001) activated yesterday
  const admin = await prisma.member.create({
    data: {
      memberCode: "BM100001",
      email: "admin@binaryportal.io",
      passwordHash,
      displayName: "Elena Vance (Admin)",
      role: "ADMIN",
      status: "PENDING_PAYMENT",
      activeSettlementDate: yesterdaySgt,
      createdAt: yesterdayMorning,
    },
  });
  const adminOrder = await createPackageOrder({
    memberId: admin.id,
    orderType: "INITIAL",
    targetPackageCode: "P1000",
    payImmediatelyDemo: true,
    asOf: yesterdayMorning,
  });
  await confirmPackageOrder({
    orderId: adminOrder.id,
    operatorId: admin.id,
    asOf: yesterdayMorning,
  });

  // 2) Alex Chen (BM100002) - Starter P100, Left of Root, activated yesterday
  const alex = await prisma.member.create({
    data: {
      memberCode: "BM100002",
      email: "alex@binaryportal.io",
      passwordHash,
      displayName: "Alex Chen",
      role: "MEMBER",
      status: "PENDING_PAYMENT",
      sponsorId: admin.id,
      activeSettlementDate: yesterdaySgt,
      createdAt: yesterdayMorning,
    },
  });
  const alexOrder = await createPackageOrder({
    memberId: alex.id,
    orderType: "INITIAL",
    targetPackageCode: "P100",
    payImmediatelyDemo: true,
    placementParentId: admin.id,
    placementLeg: "LEFT",
    asOf: yesterdayMorning,
  });
  await confirmPackageOrder({
    orderId: alexOrder.id,
    operatorId: admin.id,
    asOf: yesterdayMorning,
  });

  // 3) Sarah Tan (BM100003) - Pro P500, Right of Root, activated yesterday
  const sarah = await prisma.member.create({
    data: {
      memberCode: "BM100003",
      email: "sarah@binaryportal.io",
      passwordHash,
      displayName: "Sarah Tan",
      role: "MEMBER",
      status: "PENDING_PAYMENT",
      sponsorId: admin.id,
      activeSettlementDate: yesterdaySgt,
      createdAt: yesterdayMorning,
    },
  });
  const sarahOrder = await createPackageOrder({
    memberId: sarah.id,
    orderType: "INITIAL",
    targetPackageCode: "P500",
    payImmediatelyDemo: true,
    placementParentId: admin.id,
    placementLeg: "RIGHT",
    asOf: yesterdayMorning,
  });
  await confirmPackageOrder({
    orderId: sarahOrder.id,
    operatorId: admin.id,
    asOf: yesterdayMorning,
  });

  // Run midnight 00:00 SGT EOD settlement for yesterday
  await runEodSettlement({
    targetCurrentSgtDate: todaySgt,
    asOf: makeSgtDate(todaySgt, "00:00:05"),
    triggeredBy: "CRON",
  });

  // Today: Alex (BM100002) directly sponsors A (Marcus), B (Priya), C (Hana) + 4 more directs (7 total for pagination)
  // C (Hana, BM100009) is placed RIGHT under A (Marcus, BM100004)
  const marcus = await prisma.member.create({
    data: {
      memberCode: "BM100004",
      email: "marcus@binaryportal.io",
      passwordHash,
      displayName: "Marcus Lim",
      role: "MEMBER",
      status: "PENDING_PAYMENT",
      sponsorId: alex.id,
      activeSettlementDate: todaySgt,
      createdAt: makeSgtDate(todaySgt, "09:31:00"),
    },
  });
  const marcusOrder = await createPackageOrder({
    memberId: marcus.id,
    orderType: "INITIAL",
    targetPackageCode: "P500",
    payImmediatelyDemo: true,
    placementParentId: alex.id,
    placementLeg: "LEFT",
    asOf: todayMorning,
  });
  await confirmPackageOrder({
    orderId: marcusOrder.id,
    operatorId: admin.id,
    asOf: todayMorning,
  });

  const priya = await prisma.member.create({
    data: {
      memberCode: "BM100005",
      email: "priya@binaryportal.io",
      passwordHash,
      displayName: "Priya Nair",
      role: "MEMBER",
      status: "PENDING_PAYMENT",
      sponsorId: alex.id,
      activeSettlementDate: todaySgt,
      createdAt: makeSgtDate(todaySgt, "09:32:00"),
    },
  });
  const priyaOrder = await createPackageOrder({
    memberId: priya.id,
    orderType: "INITIAL",
    targetPackageCode: "P500",
    payImmediatelyDemo: true,
    placementParentId: alex.id,
    placementLeg: "RIGHT",
    asOf: todayMorning,
  });
  await confirmPackageOrder({
    orderId: priyaOrder.id,
    operatorId: admin.id,
    asOf: todayMorning,
  });

  const hana = await prisma.member.create({
    data: {
      memberCode: "BM100009",
      email: "hana@binaryportal.io",
      passwordHash,
      displayName: "Hana Yeo",
      role: "MEMBER",
      status: "PENDING_PAYMENT",
      sponsorId: alex.id,
      activeSettlementDate: todaySgt,
      createdAt: makeSgtDate(todaySgt, "09:33:00"),
    },
  });
  const hanaOrder = await createPackageOrder({
    memberId: hana.id,
    orderType: "INITIAL",
    targetPackageCode: "P500",
    payImmediatelyDemo: true,
    placementParentId: marcus.id,
    placementLeg: "RIGHT",
    asOf: todayMorning,
  });
  await confirmPackageOrder({
    orderId: hanaOrder.id,
    operatorId: admin.id,
    asOf: todayMorning,
  });

  const kenji = await prisma.member.create({
    data: {
      memberCode: "BM100006",
      email: "kenji@binaryportal.io",
      passwordHash,
      displayName: "Kenji Sato",
      role: "MEMBER",
      status: "PENDING_PAYMENT",
      sponsorId: alex.id,
      activeSettlementDate: todaySgt,
      createdAt: makeSgtDate(todaySgt, "09:34:00"),
    },
  });
  const kenjiOrder = await createPackageOrder({
    memberId: kenji.id,
    orderType: "INITIAL",
    targetPackageCode: "P1000",
    payImmediatelyDemo: true,
    placementParentId: marcus.id,
    placementLeg: "LEFT",
    asOf: todayMorning,
  });
  await confirmPackageOrder({
    orderId: kenjiOrder.id,
    operatorId: admin.id,
    asOf: todayMorning,
  });

  const liwei = await prisma.member.create({
    data: {
      memberCode: "BM100007",
      email: "liwei@binaryportal.io",
      passwordHash,
      displayName: "Li Wei",
      role: "MEMBER",
      status: "PENDING_PAYMENT",
      sponsorId: alex.id,
      activeSettlementDate: todaySgt,
      createdAt: makeSgtDate(todaySgt, "09:35:00"),
    },
  });
  const liweiOrder = await createPackageOrder({
    memberId: liwei.id,
    orderType: "INITIAL",
    targetPackageCode: "P1000",
    payImmediatelyDemo: true,
    placementParentId: priya.id,
    placementLeg: "RIGHT",
    asOf: todayMorning,
  });
  await confirmPackageOrder({
    orderId: liweiOrder.id,
    operatorId: admin.id,
    asOf: todayMorning,
  });

  const nadia = await prisma.member.create({
    data: {
      memberCode: "BM100011",
      email: "nadia@binaryportal.io",
      passwordHash,
      displayName: "Nadia Tan",
      role: "MEMBER",
      status: "PENDING_PAYMENT",
      sponsorId: alex.id,
      activeSettlementDate: todaySgt,
      createdAt: makeSgtDate(todaySgt, "09:37:00"),
    },
  });
  const nadiaOrder = await createPackageOrder({
    memberId: nadia.id,
    orderType: "INITIAL",
    targetPackageCode: "P100",
    payImmediatelyDemo: true,
    placementParentId: kenji.id,
    placementLeg: "LEFT",
    asOf: todayMorning,
  });
  await confirmPackageOrder({
    orderId: nadiaOrder.id,
    operatorId: admin.id,
    asOf: todayMorning,
  });

  // 2nd & 3rd Referral layers under Marcus (A) -> Daniel (L2) -> Zara (L3, placed on Hana's LEFT)
  const daniel = await prisma.member.create({
    data: {
      memberCode: "BM100010",
      email: "daniel@binaryportal.io",
      passwordHash,
      displayName: "Daniel Koh",
      role: "MEMBER",
      status: "PENDING_PAYMENT",
      sponsorId: marcus.id,
      activeSettlementDate: todaySgt,
      createdAt: makeSgtDate(todaySgt, "09:38:00"),
    },
  });
  const danielOrder = await createPackageOrder({
    memberId: daniel.id,
    orderType: "INITIAL",
    targetPackageCode: "P500",
    payImmediatelyDemo: true,
    placementParentId: priya.id,
    placementLeg: "LEFT",
    asOf: todayMorning,
  });
  await confirmPackageOrder({
    orderId: danielOrder.id,
    operatorId: admin.id,
    asOf: todayMorning,
  });

  const zara = await prisma.member.create({
    data: {
      memberCode: "BM100012",
      email: "zara@binaryportal.io",
      passwordHash,
      displayName: "Zara Ong",
      role: "MEMBER",
      status: "PENDING_PAYMENT",
      sponsorId: daniel.id,
      activeSettlementDate: todaySgt,
      createdAt: makeSgtDate(todaySgt, "09:39:00"),
    },
  });
  const zaraOrder = await createPackageOrder({
    memberId: zara.id,
    orderType: "INITIAL",
    targetPackageCode: "P100",
    payImmediatelyDemo: true,
    placementParentId: hana.id,
    placementLeg: "LEFT",
    asOf: todayMorning,
  });
  await confirmPackageOrder({
    orderId: zaraOrder.id,
    operatorId: admin.id,
    asOf: todayMorning,
  });

  // Confirmed upgrade in WAITING_EFFECTIVE state (D+2 at 00:01:00 SGT) on Sarah (BM100003)
  const sarahUpgrade = await createPackageOrder({
    memberId: sarah.id,
    orderType: "UPGRADE",
    targetPackageCode: "P1000",
    payImmediatelyDemo: true,
    asOf: todayMorning,
  });
  await confirmPackageOrder({
    orderId: sarahUpgrade.id,
    operatorId: admin.id,
    asOf: todayMorning,
  });

  // Pending member awaiting USDT deposit & Admin confirmation
  const chloe = await prisma.member.create({
    data: {
      memberCode: "BM100008",
      email: "pending@binaryportal.io",
      passwordHash,
      displayName: "Chloe Ng",
      role: "MEMBER",
      status: "PENDING_PAYMENT",
      sponsorId: alex.id,
      activeSettlementDate: todaySgt,
      createdAt: makeSgtDate(todaySgt, "09:36:00"),
    },
  });
  await createPackageOrder({
    memberId: chloe.id,
    orderType: "INITIAL",
    targetPackageCode: "P500",
    paymentMethod: "USDT",
    payImmediatelyDemo: false,
    asOf: todayMorning,
  });

  // Saved TRON TRC20 address + Sample pending USDT withdrawal (130 pts -> 26 fee -> 104 net -> 104 USDT) on Alex
  await requestWithdrawal({
    memberId: alex.id,
    requestedPointsCents: 13000,
    payoutDestination: "TKwHrTyFeSYjScLMYrQEBzxX5Qm7MMAWaY",
    strictAddressCheck: true,
    saveAddress: true,
    addressLabel: "Main TronLink (TRC20)",
    asOf: todayMorning,
  });

  // Simulated MockChainTx entries for local QA / browser verification (USDT_CHAIN_MODE="mock")
  await registerMockChainTx({
    network: cfg.usdtNetwork,
    txId: "a111111111111111111111111111111111111111111111111111111111111111",
    txExecutedSuccess: true,
    confirmations: 21,
    chainTimestamp: new Date(),
    transfers: [
      {
        eventIndex: 0,
        contractAddress: cfg.usdtContractAddress,
        fromAddress: "TKwHrTyFeSYjScLMYrQEBzxX5Qm7MMAWaY",
        toAddress: cfg.usdtDepositAddress,
        amountMicros: BigInt(500_000_000),
      },
    ],
  });
  await registerMockChainTx({
    network: cfg.usdtNetwork,
    txId: "b111111111111111111111111111111111111111111111111111111111111111",
    txExecutedSuccess: true,
    confirmations: 22,
    chainTimestamp: new Date(),
    transfers: [
      {
        eventIndex: 0,
        contractAddress: cfg.usdtContractAddress,
        fromAddress: "TKwHrTyFeSYjScLMYrQEBzxX5Qm7MMAWaY",
        toAddress: cfg.usdtDepositAddress,
        amountMicros: BigInt(100_000_000),
      },
    ],
  });
  await registerMockChainTx({
    network: cfg.usdtNetwork,
    txId: "c111111111111111111111111111111111111111111111111111111111111111",
    txExecutedSuccess: true,
    confirmations: 20,
    chainTimestamp: new Date(),
    transfers: [
      {
        eventIndex: 0,
        contractAddress: cfg.usdtContractAddress,
        fromAddress: cfg.usdtPayoutAddress,
        toAddress: "TKwHrTyFeSYjScLMYrQEBzxX5Qm7MMAWaY",
        amountMicros: BigInt(104_000_000),
      },
    ],
  });

  console.log("Seed complete!");
  console.log("Admin:  admin@binaryportal.io / Password123! (BM100001)");
  console.log("Member: alex@binaryportal.io / Password123! (BM100002)");
  console.log("Member (Waiting Upgrade): sarah@binaryportal.io / Password123! (BM100003)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
