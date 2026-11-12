import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { makeSgtDate } from "@/lib/sgt";
import {
  createPackageOrder,
  processDueUpgrades,
  runEodSettlement,
} from "@/lib/settlement/engine";
import {
  approveWithdrawal,
  claimWithdrawal,
  rejectWithdrawal,
  requestWithdrawal,
  submitWithdrawalPayoutTx,
} from "@/lib/settlement/withdrawals";
import { registerMockChainTx } from "@/lib/usdt/chain-verifier";
import { confirmUsdtDepositOrder, submitDepositTxId } from "@/lib/usdt/deposits";

if (!process.env.DATABASE_URL?.includes("binary_member_portal_test")) {
  throw new Error(
    `Refusing to run test suite against non-test DATABASE_URL: ${process.env.DATABASE_URL}`
  );
}

const CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const DEPOSIT_ADDR = "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE";
const PAYOUT_ADDR = "TLyqzVGLV1srkB7dToTAEqgDSfPtXRJZYH";
const MEMBER_ADDR = "TKwHrTyFeSYjScLMYrQEBzxX5Qm7MMAWaY";
const WRONG_CONTRACT = "TNyipkr7d43V5B5LphZuDGos9L9M3BeKRr";
const WRONG_ADDR = "TNm2mDZWkXkCo4P9oyai4Hc2zkRUW6SmLG";

const TX_VALID_100 = "1".repeat(64);
const TX_UNCONF = "2".repeat(64);
const TX_WRONG_CONTRACT = "3".repeat(64);
const TX_WRONG_ADDR = "4".repeat(64);
const TX_WRONG_AMT = "5".repeat(64);
const TX_MULTI_EVENT = "6".repeat(64);
const TX_TIMEOUT = "7".repeat(64);
const TX_PAYOUT_OK = "8".repeat(64);
const TX_PAYOUT_UNCONF = "9".repeat(64);
const TX_PAYOUT_WRONG_AMT = "a".repeat(64);
const TX_PAYOUT_WRONG_TO = "b".repeat(64);
const TX_UPGRADE_400 = "c".repeat(64);
const TX_SAME_AMT = "d".repeat(64);

let pwHash = "";

async function resetUsdtTestDb() {
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
      usdtNetwork: "TRON_TRC20",
      usdtContractAddress: CONTRACT,
      usdtDepositAddress: DEPOSIT_ADDR,
      usdtPayoutAddress: PAYOUT_ADDR,
      usdtMinConfirmations: 19,
      usdtWithdrawalProcessingHours: 72,
      usdtDepositsEnabled: true,
      usdtWithdrawalsEnabled: true,
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

async function seedRootAndTwoFinanceAdmins() {
  const admin1 = await prisma.member.create({
    data: {
      memberCode: "BM100001",
      email: "admin1@test.io",
      passwordHash: pwHash,
      displayName: "Finance One",
      role: "ADMIN",
      status: "ACTIVE",
      currentPackageCode: "P1000",
      dailyCapPointsCents: 100000,
      activeSettlementDate: "2026-11-16",
      activatedAt: makeSgtDate("2026-11-15", "09:00:00"),
    },
  });

  const admin2 = await prisma.member.create({
    data: {
      memberCode: "BM100002",
      email: "admin2@test.io",
      passwordHash: pwHash,
      displayName: "Finance Two",
      role: "ADMIN",
      status: "ACTIVE",
      currentPackageCode: "P1000",
      dailyCapPointsCents: 100000,
      sponsorId: admin1.id,
      placementParentId: admin1.id,
      placementLeg: "LEFT",
      activeSettlementDate: "2026-11-16",
      activatedAt: makeSgtDate("2026-11-15", "09:05:00"),
    },
  });

  return { admin1, admin2 };
}

beforeAll(async () => {
  pwHash = await bcrypt.hash("TestPass123!", 10);
});

beforeEach(async () => {
  await resetUsdtTestDb();
});

describe("Phase 1 USDT Deposit & Withdrawal Acceptance Suite", () => {
  it("completes USDT deposit happy path: snapshot -> TxID verify -> admin confirm -> BV, 25% direct bonus & pairing + timestamps", async () => {
    const { admin1, admin2 } = await seedRootAndTwoFinanceAdmins();

    // Place another active member on admin1 RIGHT so BV triggers admin1 pairing later
    const memberA = await prisma.member.create({
      data: {
        memberCode: "BM100003",
        email: "a@test.io",
        passwordHash: pwHash,
        displayName: "Member A",
        role: "MEMBER",
        status: "PENDING_PAYMENT",
        sponsorId: admin1.id,
        activeSettlementDate: "2026-11-16",
      },
    });
    const order = await createPackageOrder({
      memberId: memberA.id,
      orderType: "INITIAL",
      targetPackageCode: "P100",
      paymentMethod: "USDT",
      payImmediatelyDemo: false,
      asOf: makeSgtDate("2026-11-16", "10:00:00"),
    });

    expect(order.status).toBe("PENDING_CONFIRMATION");
    expect(order.paymentStatus).toBe("UNPAID");
    expect(order.depositVerifyStatus).toBe("AWAITING_TX");
    expect(order.expectedUsdtMicros).toBe(100_000_000n);
    expect(order.usdtNetwork).toBe("TRON_TRC20");
    expect(order.usdtDepositAddress).toBe(DEPOSIT_ADDR);

    const chainTs = makeSgtDate("2026-11-16", "10:03:00");
    await registerMockChainTx({
      network: "TRON_TRC20",
      txId: TX_VALID_100,
      txExecutedSuccess: true,
      confirmations: 21,
      chainTimestamp: chainTs,
      transfers: [
        {
          eventIndex: 0,
          contractAddress: CONTRACT,
          fromAddress: MEMBER_ADDR,
          toAddress: DEPOSIT_ADDR,
          amountMicros: 100_000_000n,
        },
      ],
    });

    const verifyRes = await submitDepositTxId({
      orderId: order.id,
      txId: TX_VALID_100,
      proofNote: "TronLink main wallet",
      actorId: memberA.id,
    });
    expect(verifyRes.ok).toBe(true);
    expect(verifyRes.depositVerifyStatus).toBe("VERIFIED_MATCH");

    // Admin gives admin1 right-leg placement for memberA and confirms at 10:15 SGT
    const adminConfirmAt = makeSgtDate("2026-11-16", "10:15:00");
    const confirmed = await confirmUsdtDepositOrder({
      orderId: order.id,
      operatorId: admin1.id,
      placementParentId: admin1.id,
      placementLeg: "RIGHT",
      asOf: adminConfirmAt,
    });
    expect(Boolean(confirmed.idempotent)).toBe(false);

    // Repeat admin confirm is idempotent
    const secondConfirm = await confirmUsdtDepositOrder({
      orderId: order.id,
      operatorId: admin1.id,
      asOf: adminConfirmAt,
    });
    expect(secondConfirm.idempotent).toBe(true);

    const updatedOrder = await prisma.packageOrder.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(updatedOrder.status).toBe("CONFIRMED");
    expect(updatedOrder.depositVerifyStatus).toBe("MATCHED_CONFIRMED");
    expect(updatedOrder.chainConfirmedAt?.getTime()).toBe(chainTs.getTime());
    expect(updatedOrder.confirmedAt?.getTime()).toBe(adminConfirmAt.getTime());

    // admin1 received 100 right BV and 25.00 USDT direct referral reward (isolated from pts wallet)
    const sponsorAfter = await prisma.member.findUniqueOrThrow({
      where: { id: admin1.id },
    });
    const rewardRow = await prisma.referralRewardLedger.findFirstOrThrow({
      where: { memberId: admin1.id, orderId: order.id },
    });
    expect(sponsorAfter.rightBv).toBe(100);
    expect(sponsorAfter.availablePointsCents).toBe(0);
    expect(rewardRow.currency).toBe("USDT");
    expect(rewardRow.amountMicros).toBe(25_000_000n);
    expect(rewardRow.status).toBe("CREDITED");

    // Duplicate TxID reuse on admin2 fails
    const otherMember = await prisma.member.create({
      data: {
        memberCode: "BM100004",
        email: "b@test.io",
        passwordHash: pwHash,
        displayName: "Member B",
        role: "MEMBER",
        status: "PENDING_PAYMENT",
        sponsorId: admin2.id,
        activeSettlementDate: "2026-11-16",
      },
    });
    const order2 = await createPackageOrder({
      memberId: otherMember.id,
      orderType: "INITIAL",
      targetPackageCode: "P100",
      paymentMethod: "USDT",
      payImmediatelyDemo: false,
    });
    await expect(
      submitDepositTxId({
        orderId: order2.id,
        txId: TX_VALID_100,
        actorId: otherMember.id,
      })
    ).rejects.toThrow(/already been used to confirm another order/i);
  });

  it("rejects/flags unconfirmed, wrong contract, wrong address, wrong amount, RPC timeout, same-amount ambiguity, and multi-event TxIDs", async () => {
    const { admin1, admin2 } = await seedRootAndTwoFinanceAdmins();

    const makePendingMember = async (code: string) => {
      const m = await prisma.member.create({
        data: {
          memberCode: code,
          email: `${code.toLowerCase()}@test.io`,
          passwordHash: pwHash,
          displayName: code,
          role: "MEMBER",
          status: "PENDING_PAYMENT",
          sponsorId: admin1.id,
          activeSettlementDate: "2026-11-16",
        },
      });
      const o = await createPackageOrder({
        memberId: m.id,
        orderType: "INITIAL",
        targetPackageCode: "P100",
        paymentMethod: "USDT",
        payImmediatelyDemo: false,
      });
      return { m, o };
    };

    const { m: m1, o: o1 } = await makePendingMember("BM100003");
    const { m: m2, o: o2 } = await makePendingMember("BM100004");

    // 1) Insufficient confirmations (2/19) -> VERIFYING & cannot admin-confirm
    await registerMockChainTx({
      network: "TRON_TRC20",
      txId: TX_UNCONF,
      confirmations: 2,
      transfers: [
        {
          eventIndex: 0,
          contractAddress: CONTRACT,
          fromAddress: MEMBER_ADDR,
          toAddress: DEPOSIT_ADDR,
          amountMicros: 100_000_000n,
        },
      ],
    });
    const resUnconf = await submitDepositTxId({
      orderId: o1.id,
      txId: TX_UNCONF,
      actorId: m1.id,
    });
    expect(resUnconf.depositVerifyStatus).toBe("VERIFYING");
    await expect(
      confirmUsdtDepositOrder({ orderId: o1.id, operatorId: admin1.id })
    ).rejects.toThrow(/Insufficient confirmations/i);

    // 2) Wrong contract -> FAILED_MISMATCH
    await registerMockChainTx({
      network: "TRON_TRC20",
      txId: TX_WRONG_CONTRACT,
      confirmations: 25,
      transfers: [
        {
          eventIndex: 0,
          contractAddress: WRONG_CONTRACT,
          fromAddress: MEMBER_ADDR,
          toAddress: DEPOSIT_ADDR,
          amountMicros: 100_000_000n,
        },
      ],
    });
    const resContract = await submitDepositTxId({
      orderId: o1.id,
      txId: TX_WRONG_CONTRACT,
      actorId: m1.id,
    });
    expect(resContract.depositVerifyStatus).toBe("MANUAL_REVIEW");
    expect(resContract.outcome).toBe("WRONG_CONTRACT");

    // 3) Wrong recipient address -> MANUAL_REVIEW (WRONG_ADDRESS)
    await registerMockChainTx({
      network: "TRON_TRC20",
      txId: TX_WRONG_ADDR,
      confirmations: 25,
      transfers: [
        {
          eventIndex: 0,
          contractAddress: CONTRACT,
          fromAddress: MEMBER_ADDR,
          toAddress: WRONG_ADDR,
          amountMicros: 100_000_000n,
        },
      ],
    });
    const resAddr = await submitDepositTxId({
      orderId: o1.id,
      txId: TX_WRONG_ADDR,
      actorId: m1.id,
    });
    expect(resAddr.depositVerifyStatus).toBe("MANUAL_REVIEW");
    expect(resAddr.outcome).toBe("WRONG_ADDRESS");

    // 4) Wrong amount (95 USDT != 100 USDT) -> MANUAL_REVIEW (WRONG_AMOUNT)
    await registerMockChainTx({
      network: "TRON_TRC20",
      txId: TX_WRONG_AMT,
      confirmations: 25,
      transfers: [
        {
          eventIndex: 0,
          contractAddress: CONTRACT,
          fromAddress: MEMBER_ADDR,
          toAddress: DEPOSIT_ADDR,
          amountMicros: 95_000_000n,
        },
      ],
    });
    const resAmt = await submitDepositTxId({
      orderId: o1.id,
      txId: TX_WRONG_AMT,
      actorId: m1.id,
    });
    expect(resAmt.depositVerifyStatus).toBe("MANUAL_REVIEW");
    expect(resAmt.outcome).toBe("WRONG_AMOUNT");

    // 5) Chain RPC timeout keeps order safe for retry
    await registerMockChainTx({
      network: "TRON_TRC20",
      txId: TX_TIMEOUT,
      simulateError: "TIMEOUT",
      transfers: [],
    });
    const resTimeout = await submitDepositTxId({
      orderId: o1.id,
      txId: TX_TIMEOUT,
      actorId: m1.id,
    });
    expect(resTimeout.depositVerifyStatus).toBe("VERIFYING");

    // 6) Two pending P100 orders (o1 and o2) -> same-amount collision flags MANUAL_REVIEW
    await registerMockChainTx({
      network: "TRON_TRC20",
      txId: TX_SAME_AMT,
      confirmations: 20,
      transfers: [
        {
          eventIndex: 0,
          contractAddress: CONTRACT,
          fromAddress: MEMBER_ADDR,
          toAddress: DEPOSIT_ADDR,
          amountMicros: 100_000_000n,
        },
      ],
    });
    const resAmbiguous = await submitDepositTxId({
      orderId: o1.id,
      txId: TX_SAME_AMT,
      actorId: m1.id,
    });
    expect(resAmbiguous.ambiguousSameAmount).toBe(true);
    expect(resAmbiguous.depositVerifyStatus).toBe("MANUAL_REVIEW");

    // 7) Single TxID containing 2 matching 100 USDT events -> MANUAL_REVIEW until admin picks eventIndex
    await registerMockChainTx({
      network: "TRON_TRC20",
      txId: TX_MULTI_EVENT,
      confirmations: 22,
      transfers: [
        {
          eventIndex: 0,
          contractAddress: CONTRACT,
          fromAddress: MEMBER_ADDR,
          toAddress: DEPOSIT_ADDR,
          amountMicros: 100_000_000n,
        },
        {
          eventIndex: 1,
          contractAddress: CONTRACT,
          fromAddress: MEMBER_ADDR,
          toAddress: DEPOSIT_ADDR,
          amountMicros: 100_000_000n,
        },
      ],
    });
    const resMulti1 = await submitDepositTxId({
      orderId: o1.id,
      txId: TX_MULTI_EVENT,
      actorId: m1.id,
    });
    expect(resMulti1.depositVerifyStatus).toBe("MANUAL_REVIEW");
    expect(resMulti1.eventsCount).toBe(2);

    // Confirm without picking eventId rejects
    await expect(
      confirmUsdtDepositOrder({ orderId: o1.id, operatorId: admin1.id })
    ).rejects.toThrow(/select the exact eventIndex/i);

    const events = await prisma.chainTransferEvent.findMany({
      where: { txId: TX_MULTI_EVENT },
      orderBy: { eventIndex: "asc" },
    });
    expect(events).toHaveLength(2);

    // Admin attributes event #0 to o1, and event #1 to o2!
    await confirmUsdtDepositOrder({
      orderId: o1.id,
      operatorId: admin1.id,
      eventId: events[0].id,
      placementParentId: admin1.id,
      placementLeg: "RIGHT",
    });

    await submitDepositTxId({
      orderId: o2.id,
      txId: TX_MULTI_EVENT,
      actorId: m2.id,
    });
    await confirmUsdtDepositOrder({
      orderId: o2.id,
      operatorId: admin1.id,
      eventId: events[1].id,
      placementParentId: admin2.id,
      placementLeg: "LEFT",
    });

    const [o1After, o2After] = await Promise.all([
      prisma.packageOrder.findUniqueOrThrow({ where: { id: o1.id } }),
      prisma.packageOrder.findUniqueOrThrow({ where: { id: o2.id } }),
    ]);
    expect(o1After.status).toBe("CONFIRMED");
    expect(o2After.status).toBe("CONFIRMED");
  });

  it("enforces USDT withdrawal snapshots, SLA deadline, strict address validation, concurrency locks, payout TxID verification & reject safety", async () => {
    const { admin1, admin2 } = await seedRootAndTwoFinanceAdmins();

    const member = await prisma.member.create({
      data: {
        memberCode: "BM100003",
        email: "w@test.io",
        passwordHash: pwHash,
        displayName: "Withdraw Tester",
        role: "MEMBER",
        status: "ACTIVE",
        currentPackageCode: "P100",
        dailyCapPointsCents: 10000,
        availablePointsCents: 20000, // 200 pts
        lockedPointsCents: 0,
        sponsorId: admin1.id,
        placementParentId: admin1.id,
        placementLeg: "RIGHT",
        activeSettlementDate: "2026-11-16",
        activatedAt: makeSgtDate("2026-11-15", "10:00:00"),
      },
    });

    // Rejects invalid TRON address when strictAddressCheck: true
    await expect(
      requestWithdrawal({
        memberId: member.id,
        requestedPointsCents: 13000,
        payoutDestination: "INVALID-TRON-ADDR",
        strictAddressCheck: true,
      })
    ).rejects.toThrow(/Invalid TRON/i);

    // 130 pts -> 26 fee -> 104 net -> 104_000_000n USDT + +72h SLA deadline + saved address
    const t0 = makeSgtDate("2026-11-16", "09:00:00");
    const w1 = await requestWithdrawal({
      memberId: member.id,
      requestedPointsCents: 13000,
      payoutDestination: MEMBER_ADDR,
      strictAddressCheck: true,
      saveAddress: true,
      addressLabel: "My TronLink",
      asOf: t0,
    });
    expect(w1.feePointsCents).toBe(2600);
    expect(w1.netPointsCents).toBe(10400);
    expect(w1.payoutAmountUsdtMicros).toBe(104_000_000n);
    expect(w1.processingDeadlineAt?.getTime()).toBe(t0.getTime() + 72 * 3600 * 1000);

    const saved = await prisma.memberSavedAddress.findMany({
      where: { memberId: member.id },
    });
    expect(saved).toHaveLength(1);
    expect(saved[0].address).toBe(MEMBER_ADDR);

    // Simultaneous 100-pt second withdrawal fails (only 70 pts left), then 50-pt succeeds and rejects back to available
    const [r1, r2] = await Promise.allSettled([
      requestWithdrawal({
        memberId: member.id,
        requestedPointsCents: 10000,
        payoutDestination: MEMBER_ADDR,
        strictAddressCheck: true,
      }),
      requestWithdrawal({
        memberId: member.id,
        requestedPointsCents: 5000,
        payoutDestination: MEMBER_ADDR,
        strictAddressCheck: true,
      }),
    ]);
    expect(r1.status).toBe("rejected");
    expect(r2.status).toBe("fulfilled");
    if (r2.status === "fulfilled") {
      await rejectWithdrawal({
        withdrawalId: r2.value.id,
        operatorId: admin1.id,
        reason: "Testing rejection release",
      });
    }

    const afterReject = await prisma.member.findUniqueOrThrow({
      where: { id: member.id },
    });
    expect(afterReject.availablePointsCents).toBe(7000);
    expect(afterReject.lockedPointsCents).toBe(13000);

    // Concurrent Claim & Takeover test
    await claimWithdrawal({
      withdrawalId: w1.id,
      operatorId: admin1.id,
    });
    await expect(
      claimWithdrawal({
        withdrawalId: w1.id,
        operatorId: admin2.id,
      })
    ).rejects.toThrow(/Already claimed/i);

    await claimWithdrawal({
      withdrawalId: w1.id,
      operatorId: admin2.id,
      forceTakeover: true,
      takeoverNote: "Shift handoff",
    });

    await approveWithdrawal({
      withdrawalId: w1.id,
      operatorId: admin2.id,
    });

    // Submit TxID with insufficient confirmations -> CHAIN_CONFIRMING (kept locked)
    await registerMockChainTx({
      network: "TRON_TRC20",
      txId: TX_PAYOUT_UNCONF,
      confirmations: 4,
      transfers: [
        {
          eventIndex: 0,
          contractAddress: CONTRACT,
          fromAddress: PAYOUT_ADDR,
          toAddress: MEMBER_ADDR,
          amountMicros: 104_000_000n,
        },
      ],
    });
    const resPayoutUnconf = await submitWithdrawalPayoutTx({
      withdrawalId: w1.id,
      operatorId: admin2.id,
      txId: TX_PAYOUT_UNCONF,
    });
    expect(resPayoutUnconf.withdrawal.status).toBe("CHAIN_CONFIRMING");

    // Reject MUST be blocked once payoutTxRef has been recorded
    await expect(
      rejectWithdrawal({
        withdrawalId: w1.id,
        operatorId: admin2.id,
        reason: "Should fail",
      })
    ).rejects.toThrow(/outbound transfer TxID has been recorded/i);

    // Wrong payout amount -> PAYOUT_PENDING_CHECK
    await registerMockChainTx({
      network: "TRON_TRC20",
      txId: TX_PAYOUT_WRONG_AMT,
      confirmations: 22,
      transfers: [
        {
          eventIndex: 0,
          contractAddress: CONTRACT,
          fromAddress: PAYOUT_ADDR,
          toAddress: MEMBER_ADDR,
          amountMicros: 90_000_000n,
        },
      ],
    });
    const resWrongAmt = await submitWithdrawalPayoutTx({
      withdrawalId: w1.id,
      operatorId: admin2.id,
      txId: TX_PAYOUT_WRONG_AMT,
    });
    expect(resWrongAmt.withdrawal.status).toBe("PAYOUT_PENDING_CHECK");

    // Wrong recipient address -> PAYOUT_PENDING_CHECK
    await registerMockChainTx({
      network: "TRON_TRC20",
      txId: TX_PAYOUT_WRONG_TO,
      confirmations: 22,
      transfers: [
        {
          eventIndex: 0,
          contractAddress: CONTRACT,
          fromAddress: PAYOUT_ADDR,
          toAddress: WRONG_ADDR,
          amountMicros: 104_000_000n,
        },
      ],
    });
    const resWrongTo = await submitWithdrawalPayoutTx({
      withdrawalId: w1.id,
      operatorId: admin2.id,
      txId: TX_PAYOUT_WRONG_TO,
    });
    expect(resWrongTo.withdrawal.status).toBe("PAYOUT_PENDING_CHECK");

    // Valid outbound payout TxID settles PAID atomically and deducts locked points
    await registerMockChainTx({
      network: "TRON_TRC20",
      txId: TX_PAYOUT_OK,
      confirmations: 22,
      transfers: [
        {
          eventIndex: 0,
          contractAddress: CONTRACT,
          fromAddress: PAYOUT_ADDR,
          toAddress: MEMBER_ADDR,
          amountMicros: 104_000_000n,
        },
      ],
    });
    const resPaid = await submitWithdrawalPayoutTx({
      withdrawalId: w1.id,
      operatorId: admin2.id,
      txId: TX_PAYOUT_OK,
    });
    expect(resPaid.withdrawal.status).toBe("PAID");

    const finalMember = await prisma.member.findUniqueOrThrow({
      where: { id: member.id },
    });
    expect(finalMember.availablePointsCents).toBe(7000);
    expect(finalMember.lockedPointsCents).toBe(0);
  });

  it("preserves D+2 00:01:00 SGT upgrade effective rule and 00:00 SGT EOD ordering on USDT upgrade orders", async () => {
    const { admin1 } = await seedRootAndTwoFinanceAdmins();

    const upgrader = await prisma.member.create({
      data: {
        memberCode: "BM100003",
        email: "up@test.io",
        passwordHash: pwHash,
        displayName: "Upgrader",
        role: "MEMBER",
        status: "ACTIVE",
        currentPackageCode: "P100",
        dailyCapPointsCents: 10000,
        leftBv: 500,
        rightBv: 300,
        sponsorId: admin1.id,
        placementParentId: admin1.id,
        placementLeg: "RIGHT",
        activeSettlementDate: "2026-11-16",
        activatedAt: makeSgtDate("2026-11-15", "09:00:00"),
      },
    });

    // Upgrade order P100 -> P500 expects 400 USDT (price difference)
    const upgOrder = await createPackageOrder({
      memberId: upgrader.id,
      orderType: "UPGRADE",
      targetPackageCode: "P500",
      paymentMethod: "USDT",
      payImmediatelyDemo: false,
      asOf: makeSgtDate("2026-11-16", "14:00:00"),
    });
    expect(upgOrder.expectedUsdtMicros).toBe(400_000_000n);

    await registerMockChainTx({
      network: "TRON_TRC20",
      txId: TX_UPGRADE_400,
      confirmations: 25,
      chainTimestamp: makeSgtDate("2026-11-16", "14:05:00"),
      transfers: [
        {
          eventIndex: 0,
          contractAddress: CONTRACT,
          fromAddress: MEMBER_ADDR,
          toAddress: DEPOSIT_ADDR,
          amountMicros: 400_000_000n,
        },
      ],
    });

    await submitDepositTxId({
      orderId: upgOrder.id,
      txId: TX_UPGRADE_400,
      actorId: upgrader.id,
    });
    await confirmUsdtDepositOrder({
      orderId: upgOrder.id,
      operatorId: admin1.id,
      asOf: makeSgtDate("2026-11-16", "14:10:00"),
    });

    const midMember = await prisma.member.findUniqueOrThrow({
      where: { id: upgrader.id },
    });
    expect(midMember.currentPackageCode).toBe("P100");
    expect(midMember.pendingUpgradePackageCode).toBe("P500");
    expect(midMember.pendingUpgradeEffectiveDate).toBe("2026-11-18");
    expect(midMember.pendingUpgradeEffectiveAt?.getTime()).toBe(
      makeSgtDate("2026-11-18", "00:01:00").getTime()
    );

    // At 2026-11-18 00:00:30 SGT -> NOT yet effective!
    const beforeMinute = await processDueUpgrades({
      asOf: makeSgtDate("2026-11-18", "00:00:30"),
      processedAt: makeSgtDate("2026-11-18", "00:00:30"),
    });
    expect(beforeMinute.upgradesActivated).toBe(0);

    // 00:00 SGT EOD runs first (flushes smaller rightBv 300, carries over leftBv 500)
    await runEodSettlement({
      targetCurrentSgtDate: "2026-11-18",
      asOf: makeSgtDate("2026-11-18", "00:00:10"),
      processedAt: makeSgtDate("2026-11-18", "00:00:10"),
      triggeredBy: "CRON",
    });

    // At 2026-11-18 00:01:00 SGT -> upgrade becomes effective!
    const atEffective = await processDueUpgrades({
      asOf: makeSgtDate("2026-11-18", "00:01:00"),
      processedAt: makeSgtDate("2026-11-18", "00:01:00"),
    });
    expect(atEffective.upgradesActivated).toBe(1);

    const finalUpgrader = await prisma.member.findUniqueOrThrow({
      where: { id: upgrader.id },
    });
    expect(finalUpgrader.currentPackageCode).toBe("P500");
    expect(finalUpgrader.dailyCapPointsCents).toBe(50000);
    expect(finalUpgrader.leftBv).toBe(500);
    expect(finalUpgrader.rightBv).toBe(0);
  });
});
