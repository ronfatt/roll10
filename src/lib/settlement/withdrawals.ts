import { prisma } from "@/lib/db";
import { calculateWithdrawalQuote, pointsCentsToUsdtMicros } from "@/lib/money";
import { getSgtDateString } from "@/lib/sgt";
import {
  isUsdtWithdrawalConfigured,
  isValidTxIdForNetwork,
  isValidUsdtAddressForNetwork,
  normalizeTxId,
} from "@/lib/usdt/address";
import { inspectChainTransferTx } from "@/lib/usdt/chain-verifier";
import type { Prisma } from "@prisma/client";
import { getOrCreateConfigTx } from "./engine";
import type { LockedMemberRow } from "./types";

type Tx = Prisma.TransactionClient;

function makeWdNo(prefix: string, sgtDate: string): string {
  const compact = sgtDate.replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${compact}-${rand}`;
}

export async function requestWithdrawal(params: {
  memberId: string;
  requestedPointsCents: number;
  payoutDestination: string;
  saveAddress?: boolean;
  addressLabel?: string;
  strictAddressCheck?: boolean;
  asOf?: Date;
}) {
  const asOf = params.asOf ?? new Date();
  const sgtDate = getSgtDateString(asOf);
  const cleanDest = params.payoutDestination.trim();

  if (!Number.isInteger(params.requestedPointsCents) || params.requestedPointsCents <= 0) {
    throw new Error("Requested withdrawal amount (U) must be positive");
  }
  if (!cleanDest) {
    throw new Error("Payout destination is required");
  }

  return prisma.$transaction(async (tx) => {
    const config = await getOrCreateConfigTx(tx);
    if (params.strictAddressCheck) {
      if (!isUsdtWithdrawalConfigured(config)) {
        throw new Error("USDT withdrawal service is temporarily unavailable");
      }
      if (!isValidUsdtAddressForNetwork(config.usdtNetwork, cleanDest)) {
        throw new Error(
          `Invalid ${config.usdtNetwork} USDT address format`
        );
      }
    }

    const locked = await tx.$queryRaw<LockedMemberRow[]>`
      SELECT
        id, "memberCode", email, "displayName", role, status,
        "availablePointsCents", "lockedPointsCents"
      FROM members
      WHERE id = ${params.memberId}
      FOR UPDATE
    `;
    const member = locked[0];
    if (!member) throw new Error("Member not found");
    if (member.status !== "ACTIVE") {
      throw new Error("Only ACTIVE members can request withdrawals");
    }
    if (member.availablePointsCents < params.requestedPointsCents) {
      throw new Error("Insufficient available withdrawable U balance");
    }

    const quote = calculateWithdrawalQuote(
      params.requestedPointsCents,
      config.withdrawalFeeRateBps,
      config.withdrawalUsdRateMicros
    );
    const payoutAmountUsdtMicros = pointsCentsToUsdtMicros(
      quote.netPointsCents,
      config.withdrawalUsdRateMicros
    );
    const processingDeadlineAt = new Date(
      asOf.getTime() + config.usdtWithdrawalProcessingHours * 3600_000
    );

    const newAvailable = member.availablePointsCents - quote.requestedPointsCents;
    const newLocked = member.lockedPointsCents + quote.requestedPointsCents;

    await tx.member.update({
      where: { id: member.id },
      data: {
        availablePointsCents: newAvailable,
        lockedPointsCents: newLocked,
      },
    });

    if (params.saveAddress && config.usdtNetwork) {
      await tx.memberSavedAddress.upsert({
        where: {
          memberId_network_address: {
            memberId: member.id,
            network: config.usdtNetwork,
            address: cleanDest,
          },
        },
        update: {
          label: params.addressLabel?.trim() || "USDT Address",
        },
        create: {
          memberId: member.id,
          network: config.usdtNetwork,
          address: cleanDest,
          label: params.addressLabel?.trim() || "USDT Address",
        },
      });
    }

    const withdrawal = await tx.withdrawalRequest.create({
      data: {
        withdrawalNo: makeWdNo("WD", sgtDate),
        memberId: member.id,
        requestedPointsCents: quote.requestedPointsCents,
        feeRateBpsSnapshot: config.withdrawalFeeRateBps,
        feePointsCents: quote.feePointsCents,
        netPointsCents: quote.netPointsCents,
        usdRateMicros: config.withdrawalUsdRateMicros,
        isDemoRate: config.isDemoRate,
        estimatedUsdCents: quote.estimatedUsdCents,
        payoutDestination: cleanDest,
        usdtNetwork: config.usdtNetwork,
        usdtContractAddress: config.usdtContractAddress,
        companyPayoutAddress: config.usdtPayoutAddress,
        payoutAmountUsdtMicros,
        processingDeadlineAt,
        status: "PENDING_APPROVAL",
        approvalStatus: "PENDING",
        payoutStatus: "UNPAID",
        createdAt: asOf,
      },
    });

    await tx.walletLedger.create({
      data: {
        ledgerNo: makeWdNo("WL", sgtDate),
        eventKey: `wd_lock:${withdrawal.id}`,
        memberId: member.id,
        entryType: "WITHDRAWAL_LOCK",
        deltaAvailableCents: -quote.requestedPointsCents,
        deltaLockedCents: quote.requestedPointsCents,
        availableAfterCents: newAvailable,
        lockedAfterCents: newLocked,
        withdrawalId: withdrawal.id,
        note: `Locked for withdrawal ${withdrawal.withdrawalNo} (20% fee = ${quote.feePointsCents / 100} U, payout = ${Number(payoutAmountUsdtMicros) / 1_000_000} USDT)`,
        createdAt: asOf,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: member.id,
        actorRole: member.role,
        action: "WITHDRAWAL_REQUEST",
        entityType: "WithdrawalRequest",
        entityId: withdrawal.id,
        summary: `${member.memberCode} requested withdrawal ${withdrawal.withdrawalNo}: ${quote.requestedPointsCents / 100} U -> ${Number(payoutAmountUsdtMicros) / 1_000_000} USDT`,
        metadata: {
          requestedPointsCents: quote.requestedPointsCents,
          feePointsCents: quote.feePointsCents,
          netPointsCents: quote.netPointsCents,
          payoutAmountUsdtMicros: payoutAmountUsdtMicros.toString(),
          usdtNetwork: config.usdtNetwork,
          processingDeadlineAt: processingDeadlineAt.toISOString(),
        },
        createdAt: asOf,
      },
    });

    return withdrawal;
  });
}

export async function approveWithdrawal(params: {
  withdrawalId: string;
  operatorId: string;
  asOf?: Date;
}) {
  const asOf = params.asOf ?? new Date();

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{ id: string; withdrawalNo: string; status: string; memberId: string }>
    >`
      SELECT id, "withdrawalNo", status, "memberId"
      FROM withdrawal_requests
      WHERE id = ${params.withdrawalId}
      FOR UPDATE
    `;
    const wd = rows[0];
    if (!wd) throw new Error("Withdrawal request not found");
    if (wd.status !== "PENDING_APPROVAL") {
      throw new Error(`Cannot approve withdrawal in status ${wd.status}`);
    }

    const updated = await tx.withdrawalRequest.update({
      where: { id: wd.id },
      data: {
        status: "APPROVED",
        approvalStatus: "APPROVED",
        approvedAt: asOf,
        approvedById: params.operatorId,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: params.operatorId,
        actorRole: "ADMIN",
        action: "WITHDRAWAL_APPROVE",
        entityType: "WithdrawalRequest",
        entityId: wd.id,
        summary: `Approved withdrawal ${wd.withdrawalNo}`,
        createdAt: asOf,
      },
    });

    return updated;
  });
}

/**
 * Transitions an APPROVED withdrawal to PAYOUT_PENDING_CHECK ("待核对 / 付款结果不明"),
 * keeping points strictly LOCKED until final payout verification.
 */
export async function markWithdrawalPendingCheck(params: {
  withdrawalId: string;
  operatorId: string;
  note?: string;
  payoutTxRef?: string;
  asOf?: Date;
}) {
  const asOf = params.asOf ?? new Date();

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{ id: string; withdrawalNo: string; status: string }>
    >`
      SELECT id, "withdrawalNo", status
      FROM withdrawal_requests
      WHERE id = ${params.withdrawalId}
      FOR UPDATE
    `;
    const wd = rows[0];
    if (!wd) throw new Error("Withdrawal request not found");
    if (wd.status !== "APPROVED" && wd.status !== "PAYOUT_PENDING_CHECK" && wd.status !== "CHAIN_CONFIRMING") {
      throw new Error(`Cannot mark pending check from status ${wd.status}`);
    }

    const checkNote =
      params.note?.trim() || "Payout gateway outcome uncertain; points remain locked pending verification";

    const updated = await tx.withdrawalRequest.update({
      where: { id: wd.id },
      data: {
        status: "PAYOUT_PENDING_CHECK",
        payoutStatus: "PENDING_CHECK",
        payoutCheckNote: checkNote,
        payoutTxRef: params.payoutTxRef?.trim() || undefined,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: params.operatorId,
        actorRole: "ADMIN",
        action: "WITHDRAWAL_PENDING_CHECK",
        entityType: "WithdrawalRequest",
        entityId: wd.id,
        summary: `Marked withdrawal ${wd.withdrawalNo} PAYOUT_PENDING_CHECK (locked points retained): ${checkNote}`,
        createdAt: asOf,
      },
    });

    return updated;
  });
}

/**
 * Completes payout deduction from lockedPointsCents.
 * Idempotent: duplicate payout callbacks when already PAID return cleanly without double deduction.
 */
export async function markWithdrawalPaid(params: {
  withdrawalId: string;
  operatorId: string;
  payoutTxRef?: string;
  asOf?: Date;
}) {
  return prisma.$transaction((tx) => markWithdrawalPaidTx(tx, params));
}

export async function markWithdrawalPaidTx(
  tx: Tx,
  params: {
    withdrawalId: string;
    operatorId: string;
    payoutTxRef?: string;
    chainConfirmedAt?: Date;
    matchedPayoutEventId?: string;
    asOf?: Date;
  }
) {
  const asOf = params.asOf ?? new Date();
  const sgtDate = getSgtDateString(asOf);

    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        withdrawalNo: string;
        status: string;
        memberId: string;
        requestedPointsCents: number;
        estimatedUsdCents: number;
      }>
    >`
      SELECT id, "withdrawalNo", status, "memberId", "requestedPointsCents", "estimatedUsdCents"
      FROM withdrawal_requests
      WHERE id = ${params.withdrawalId}
      FOR UPDATE
    `;
    const wd = rows[0];
    if (!wd) throw new Error("Withdrawal request not found");

    // Idempotent handling for duplicate payout callbacks!
    if (wd.status === "PAID") {
      const existing = await tx.withdrawalRequest.findUniqueOrThrow({ where: { id: wd.id } });
      return existing;
    }

    if (
      wd.status !== "APPROVED" &&
      wd.status !== "PAYOUT_PENDING_CHECK" &&
      wd.status !== "CHAIN_CONFIRMING"
    ) {
      throw new Error(
        `Cannot mark paid in status ${wd.status}; must be APPROVED, CHAIN_CONFIRMING, or PAYOUT_PENDING_CHECK`
      );
    }

    const lockedMembers = await tx.$queryRaw<
      Array<{ id: string; availablePointsCents: number; lockedPointsCents: number }>
    >`
      SELECT id, "availablePointsCents", "lockedPointsCents"
      FROM members
      WHERE id = ${wd.memberId}
      FOR UPDATE
    `;
    const member = lockedMembers[0];
    if (!member) throw new Error("Member not found");

    const paidEventKey = `wd_paid:${wd.id}`;
    const existingPaidLedger = await tx.walletLedger.findUnique({
      where: { eventKey: paidEventKey },
    });
    if (existingPaidLedger) {
      return tx.withdrawalRequest.findUniqueOrThrow({ where: { id: wd.id } });
    }

    if (member.lockedPointsCents < wd.requestedPointsCents) {
      throw new Error("Locked points balance insufficient for payout deduction");
    }

    const newLocked = member.lockedPointsCents - wd.requestedPointsCents;
    await tx.member.update({
      where: { id: member.id },
      data: { lockedPointsCents: newLocked },
    });

    const txRef = params.payoutTxRef?.trim() || `PAYOUT-${Date.now()}`;
    const updated = await tx.withdrawalRequest.update({
      where: { id: wd.id },
      data: {
        status: "PAID",
        payoutStatus: "PAID",
        paidAt: asOf,
        paidById: params.operatorId,
        payoutTxRef: txRef,
        chainConfirmedAt: params.chainConfirmedAt ?? undefined,
        matchedPayoutEventId: params.matchedPayoutEventId ?? undefined,
        payoutCheckNote: null,
        payoutFailureReason: null,
      },
    });

    await tx.walletLedger.create({
      data: {
        ledgerNo: makeWdNo("WL", sgtDate),
        eventKey: paidEventKey,
        memberId: member.id,
        entryType: "WITHDRAWAL_PAID",
        deltaAvailableCents: 0,
        deltaLockedCents: -wd.requestedPointsCents,
        availableAfterCents: member.availablePointsCents,
        lockedAfterCents: newLocked,
        withdrawalId: wd.id,
        operatorId: params.operatorId,
        note: `Payout settled for ${wd.withdrawalNo} (Ref: ${txRef})`,
        createdAt: asOf,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: params.operatorId,
        actorRole: "ADMIN",
        action: "WITHDRAWAL_PAY",
        entityType: "WithdrawalRequest",
        entityId: wd.id,
        summary: `Marked withdrawal ${wd.withdrawalNo} PAID (${txRef})`,
        metadata: { payoutTxRef: txRef, estimatedUsdCents: wd.estimatedUsdCents },
        createdAt: asOf,
      },
    });

    return updated;
}

export async function rejectWithdrawal(params: {
  withdrawalId: string;
  operatorId: string;
  reason: string;
  asOf?: Date;
}) {
  const asOf = params.asOf ?? new Date();
  const sgtDate = getSgtDateString(asOf);
  if (!params.reason.trim()) {
    throw new Error("Rejection reason is required");
  }

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        withdrawalNo: string;
        status: string;
        memberId: string;
        requestedPointsCents: number;
        payoutTxRef: string | null;
      }>
    >`
      SELECT id, "withdrawalNo", status, "memberId", "requestedPointsCents", "payoutTxRef"
      FROM withdrawal_requests
      WHERE id = ${params.withdrawalId}
      FOR UPDATE
    `;
    const wd = rows[0];
    if (!wd) throw new Error("Withdrawal request not found");
    if (wd.payoutTxRef || wd.status === "CHAIN_CONFIRMING") {
      throw new Error(
        "Cannot reject withdrawal after an outbound transfer TxID has been recorded; verify transaction status first"
      );
    }
    if (
      wd.status !== "PENDING_APPROVAL" &&
      wd.status !== "APPROVED" &&
      wd.status !== "PAYOUT_PENDING_CHECK"
    ) {
      throw new Error(`Cannot reject withdrawal in status ${wd.status}`);
    }

    const lockedMembers = await tx.$queryRaw<
      Array<{ id: string; availablePointsCents: number; lockedPointsCents: number }>
    >`
      SELECT id, "availablePointsCents", "lockedPointsCents"
      FROM members
      WHERE id = ${wd.memberId}
      FOR UPDATE
    `;
    const member = lockedMembers[0];
    if (!member) throw new Error("Member not found");

    const newLocked = member.lockedPointsCents - wd.requestedPointsCents;
    const newAvailable = member.availablePointsCents + wd.requestedPointsCents;
    if (newLocked < 0) {
      throw new Error("Invalid locked balance during withdrawal rejection");
    }

    await tx.member.update({
      where: { id: member.id },
      data: {
        availablePointsCents: newAvailable,
        lockedPointsCents: newLocked,
      },
    });

    const updated = await tx.withdrawalRequest.update({
      where: { id: wd.id },
      data: {
        status: "REJECTED",
        approvalStatus: "REJECTED",
        payoutStatus: "CANCELLED",
        rejectedAt: asOf,
        rejectedById: params.operatorId,
        rejectionReason: params.reason.trim(),
      },
    });

    await tx.walletLedger.create({
      data: {
        ledgerNo: makeWdNo("WL", sgtDate),
        eventKey: `wd_release:${wd.id}`,
        memberId: member.id,
        entryType: "WITHDRAWAL_RELEASE",
        deltaAvailableCents: wd.requestedPointsCents,
        deltaLockedCents: -wd.requestedPointsCents,
        availableAfterCents: newAvailable,
        lockedAfterCents: newLocked,
        withdrawalId: wd.id,
        operatorId: params.operatorId,
        note: `Released locked points on rejection of ${wd.withdrawalNo}: ${params.reason.trim()}`,
        createdAt: asOf,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: params.operatorId,
        actorRole: "ADMIN",
        action: "WITHDRAWAL_REJECT",
        entityType: "WithdrawalRequest",
        entityId: wd.id,
        summary: `Rejected withdrawal ${wd.withdrawalNo}: ${params.reason.trim()}`,
        metadata: { reason: params.reason.trim() },
        createdAt: asOf,
      },
    });

    return updated;
  });
}

/**
 * Finance operator claims a withdrawal before initiating external wallet transfer.
 * Concurrency-safe via row-level FOR UPDATE lock; only one operator can hold claim.
 */
export async function claimWithdrawal(params: {
  withdrawalId: string;
  operatorId: string;
  forceTakeover?: boolean;
  takeoverNote?: string;
  asOf?: Date;
}) {
  const asOf = params.asOf ?? new Date();

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        withdrawalNo: string;
        status: string;
        claimedById: string | null;
        payoutTxRef: string | null;
      }>
    >`
      SELECT id, "withdrawalNo", status, "claimedById", "payoutTxRef"
      FROM withdrawal_requests
      WHERE id = ${params.withdrawalId}
      FOR UPDATE
    `;
    const wd = rows[0];
    if (!wd) throw new Error("Withdrawal request not found");
    if (wd.status === "PAID" || wd.status === "REJECTED") {
      throw new Error(`Cannot claim withdrawal in status ${wd.status}`);
    }

    if (wd.claimedById && wd.claimedById !== params.operatorId) {
      if (!params.forceTakeover) {
        const holder = await tx.member.findUnique({
          where: { id: wd.claimedById },
          select: { memberCode: true, displayName: true },
        });
        throw new Error(
          `Already claimed by ${holder ? `${holder.displayName} (${holder.memberCode})` : wd.claimedById}`
        );
      }
      if (!params.takeoverNote?.trim()) {
        throw new Error(
          "Please record verification note confirming whether an external transfer was already sent before taking over"
        );
      }
    }

    const updated = await tx.withdrawalRequest.update({
      where: { id: wd.id },
      data: {
        claimedById: params.operatorId,
        claimedAt: asOf,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: params.operatorId,
        actorRole: "ADMIN",
        action: params.forceTakeover ? "WITHDRAWAL_TAKEOVER" : "WITHDRAWAL_CLAIM",
        entityType: "WithdrawalRequest",
        entityId: wd.id,
        summary: `${params.forceTakeover ? "Took over" : "Claimed"} withdrawal ${wd.withdrawalNo}`,
        metadata: {
          payoutTxRef: wd.payoutTxRef,
          takeoverNote: params.takeoverNote ?? null,
        },
        createdAt: asOf,
      },
    });

    return updated;
  });
}

/**
 * Finance operator submits or retries verification of an outbound USDT payout TxID.
 * Checks network, contract, company payout address, recipient address, exact net USDT, and confirmations.
 * Enforces unique payout event claim (`claimedWithdrawalId`) so one transfer settles at most one withdrawal.
 */
export async function submitWithdrawalPayoutTx(params: {
  withdrawalId: string;
  operatorId: string;
  txId: string;
  asOf?: Date;
}) {
  const asOf = params.asOf ?? new Date();

  const existingWd = await prisma.withdrawalRequest.findUnique({
    where: { id: params.withdrawalId },
  });
  if (!existingWd) throw new Error("Withdrawal request not found");

  const config = await getOrCreateConfigTx(prisma);
  const network = existingWd.usdtNetwork || config.usdtNetwork;
  const contractAddress = existingWd.usdtContractAddress || config.usdtContractAddress;
  const companyPayoutAddress = existingWd.companyPayoutAddress || config.usdtPayoutAddress;
  const expectedMicros =
    existingWd.payoutAmountUsdtMicros > 0n
      ? existingWd.payoutAmountUsdtMicros
      : pointsCentsToUsdtMicros(existingWd.netPointsCents, existingWd.usdRateMicros);
  const minConfirmations = config.usdtMinConfirmations;

  if (!network || !contractAddress || !companyPayoutAddress) {
    throw new Error("USDT withdrawal configuration incomplete");
  }

  const normTxId = normalizeTxId(params.txId);
  if (!isValidTxIdForNetwork(network, normTxId)) {
    throw new Error(`Invalid ${network} TxID format`);
  }

  if (existingWd.status === "PAID") {
    if (existingWd.payoutTxRef === normTxId) {
      return {
        ok: true,
        idempotent: true,
        outcome: "ALREADY_PAID",
        withdrawal: existingWd,
      };
    }
    throw new Error("Withdrawal has already been marked PAID with a different TxID");
  }
  if (
    existingWd.status !== "APPROVED" &&
    existingWd.status !== "CHAIN_CONFIRMING" &&
    existingWd.status !== "PAYOUT_PENDING_CHECK"
  ) {
    throw new Error(`Cannot record payout TxID in status ${existingWd.status}`);
  }
  if (existingWd.claimedById && existingWd.claimedById !== params.operatorId) {
    throw new Error("Withdrawal is claimed by another finance operator; take over first");
  }

  // Prevent reusing an already-claimed payout transfer event across withdrawals
  const claimedElsewhere = await prisma.chainTransferEvent.findFirst({
    where: {
      network,
      txId: normTxId,
      claimedWithdrawalId: { not: null },
    },
    select: { claimedWithdrawalId: true },
  });
  if (claimedElsewhere && claimedElsewhere.claimedWithdrawalId !== existingWd.id) {
    throw new Error("This payout TxID event has already settled another withdrawal");
  }

  // Record TxID first inside transaction (+ auto-claim if unclaimed) so finance always sees it
  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string; claimedById: string | null }>>`
      SELECT id, "claimedById" FROM withdrawal_requests WHERE id = ${existingWd.id} FOR UPDATE
    `;
    const row = locked[0];
    if (!row) throw new Error("Withdrawal not found");
    if (row.claimedById && row.claimedById !== params.operatorId) {
      throw new Error("Withdrawal is claimed by another operator");
    }
    await tx.withdrawalRequest.update({
      where: { id: existingWd.id },
      data: {
        payoutTxRef: normTxId,
        claimedById: row.claimedById ?? params.operatorId,
        claimedAt: row.claimedById ? undefined : asOf,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: params.operatorId,
        actorRole: "ADMIN",
        action: "WITHDRAWAL_PAYOUT_TX_RECORDED",
        entityType: "WithdrawalRequest",
        entityId: existingWd.id,
        summary: `Recorded outbound TxID ${normTxId} on ${existingWd.withdrawalNo}`,
        metadata: { txId: normTxId },
        createdAt: asOf,
      },
    });
  });

  const inspection = await inspectChainTransferTx(network, normTxId);
  if (!inspection.ok) {
    const updated = await prisma.withdrawalRequest.update({
      where: { id: existingWd.id },
      data: {
        status: "PAYOUT_PENDING_CHECK",
        payoutStatus: "PENDING_CHECK",
        payoutCheckNote: `TxID recorded; chain query failed: ${inspection.errorMessage}`,
        payoutFailureReason: inspection.errorMessage,
      },
    });
    return {
      ok: true,
      outcome: inspection.errorCode,
      withdrawal: updated,
      message: inspection.errorMessage,
    };
  }

  const evaluated = inspection.transfers.map((tr) => {
    let outcome = "MATCHED";
    if (!inspection.txExecutedSuccess) outcome = "TX_FAILED";
    else if (tr.contractAddress !== contractAddress) outcome = "WRONG_CONTRACT";
    else if (tr.fromAddress !== companyPayoutAddress) outcome = "WRONG_FROM_ADDRESS";
    else if (tr.toAddress !== existingWd.payoutDestination) outcome = "WRONG_TO_ADDRESS";
    else if (tr.amountMicros !== expectedMicros) outcome = "WRONG_AMOUNT";
    else if (inspection.confirmations < minConfirmations) outcome = "UNCONFIRMED";
    return { tr, outcome };
  });

  const matched = evaluated.filter((e) => e.outcome === "MATCHED");
  const unconfirmed = evaluated.filter((e) => e.outcome === "UNCONFIRMED");

  if (matched.length === 1) {
    const targetItem = matched[0];
    const settled = await prisma.$transaction(async (tx) => {
      const ev = await tx.chainTransferEvent.upsert({
        where: {
          network_txId_eventIndex: {
            network,
            txId: normTxId,
            eventIndex: targetItem.tr.eventIndex,
          },
        },
        update: {
          confirmations: inspection.confirmations,
          minConfirmations,
          chainSuccess: inspection.txExecutedSuccess,
          chainTimestamp: inspection.chainTimestamp,
          verifyOutcome: "MATCHED",
          rawPayload: inspection.rawPayload,
          submittedByWithdrawalId: existingWd.id,
        },
        create: {
          direction: "PAYOUT",
          network,
          txId: normTxId,
          eventIndex: targetItem.tr.eventIndex,
          contractAddress: targetItem.tr.contractAddress,
          fromAddress: targetItem.tr.fromAddress,
          toAddress: targetItem.tr.toAddress,
          amountMicros: targetItem.tr.amountMicros,
          confirmations: inspection.confirmations,
          minConfirmations,
          chainSuccess: inspection.txExecutedSuccess,
          chainTimestamp: inspection.chainTimestamp,
          verifyOutcome: "MATCHED",
          rawPayload: inspection.rawPayload,
          submittedByWithdrawalId: existingWd.id,
        },
      });

      const lockedEvents = await tx.$queryRaw<
        Array<{ id: string; claimedWithdrawalId: string | null }>
      >`
        SELECT id, "claimedWithdrawalId" FROM chain_transfer_events WHERE id = ${ev.id} FOR UPDATE
      `;
      const lockedEv = lockedEvents[0];
      if (lockedEv.claimedWithdrawalId && lockedEv.claimedWithdrawalId !== existingWd.id) {
        throw new Error("Payout transfer event has already settled another withdrawal");
      }

      await tx.chainTransferEvent.update({
        where: { id: ev.id },
        data: {
          claimedWithdrawalId: existingWd.id,
          verifiedById: params.operatorId,
          verifiedAt: asOf,
          attributionNote: `Settled ${existingWd.withdrawalNo}`,
        },
      });

      return markWithdrawalPaidTx(tx, {
        withdrawalId: existingWd.id,
        operatorId: params.operatorId,
        payoutTxRef: normTxId,
        chainConfirmedAt: inspection.chainTimestamp,
        matchedPayoutEventId: ev.id,
        asOf,
      });
    });

    return {
      ok: true,
      outcome: "PAID",
      withdrawal: settled,
      message: "On-chain payout verified and settled.",
    };
  }

  // Upsert observed transfer events and keep points locked in CHAIN_CONFIRMING or PAYOUT_PENDING_CHECK
  await prisma.$transaction(async (tx) => {
    for (const item of evaluated) {
      await tx.chainTransferEvent.upsert({
        where: {
          network_txId_eventIndex: {
            network,
            txId: normTxId,
            eventIndex: item.tr.eventIndex,
          },
        },
        update: {
          confirmations: inspection.confirmations,
          minConfirmations,
          chainSuccess: inspection.txExecutedSuccess,
          chainTimestamp: inspection.chainTimestamp,
          verifyOutcome: item.outcome,
          rawPayload: inspection.rawPayload,
          submittedByWithdrawalId: existingWd.id,
        },
        create: {
          direction: "PAYOUT",
          network,
          txId: normTxId,
          eventIndex: item.tr.eventIndex,
          contractAddress: item.tr.contractAddress,
          fromAddress: item.tr.fromAddress,
          toAddress: item.tr.toAddress,
          amountMicros: item.tr.amountMicros,
          confirmations: inspection.confirmations,
          minConfirmations,
          chainSuccess: inspection.txExecutedSuccess,
          chainTimestamp: inspection.chainTimestamp,
          verifyOutcome: item.outcome,
          rawPayload: inspection.rawPayload,
          submittedByWithdrawalId: existingWd.id,
        },
      });
    }
  });

  if (unconfirmed.length > 0) {
    const note = `Chain confirmation in progress (${inspection.confirmations}/${minConfirmations})`;
    const updated = await prisma.withdrawalRequest.update({
      where: { id: existingWd.id },
      data: {
        status: "CHAIN_CONFIRMING",
        payoutStatus: "PENDING_CHECK",
        payoutCheckNote: note,
        payoutFailureReason: null,
      },
    });
    return {
      ok: true,
      outcome: "CHAIN_CONFIRMING",
      withdrawal: updated,
      message: note,
    };
  }

  const mismatchReason = !inspection.txExecutedSuccess
    ? "Outbound transaction failed on-chain"
    : matched.length > 1
      ? "Multiple matching transfer events found in TxID; manual check required"
      : evaluated.some((e) => e.outcome === "WRONG_CONTRACT")
        ? "Contract address mismatch on outbound transfer"
        : evaluated.some((e) => e.outcome === "WRONG_FROM_ADDRESS")
          ? "Sender address does not match configured company payout address"
          : evaluated.some((e) => e.outcome === "WRONG_TO_ADDRESS")
            ? "Recipient address does not match withdrawal destination"
            : evaluated.some((e) => e.outcome === "WRONG_AMOUNT")
              ? "Transferred USDT amount does not match exact net payout"
              : "No valid USDT transfer found in TxID";

  const updated = await prisma.withdrawalRequest.update({
    where: { id: existingWd.id },
    data: {
      status: "PAYOUT_PENDING_CHECK",
      payoutStatus: "PENDING_CHECK",
      payoutCheckNote: mismatchReason,
      payoutFailureReason: mismatchReason,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: params.operatorId,
      actorRole: "ADMIN",
      action: "WITHDRAWAL_PAYOUT_MISMATCH",
      entityType: "WithdrawalRequest",
      entityId: existingWd.id,
      summary: `Payout verification held ${existingWd.withdrawalNo} in PAYOUT_PENDING_CHECK: ${mismatchReason}`,
      metadata: { txId: normTxId, reason: mismatchReason },
      createdAt: asOf,
    },
  });

  return {
    ok: true,
    outcome: "PAYOUT_PENDING_CHECK",
    withdrawal: updated,
    message: mismatchReason,
  };
}
