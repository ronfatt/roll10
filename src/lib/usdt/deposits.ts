import type { BinaryLeg, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  confirmPackageOrderTx,
  getOrCreateConfigTx,
} from "@/lib/settlement/engine";
import type { ConfirmOrderResult } from "@/lib/settlement/types";
import {
  isValidTxIdForNetwork,
  normalizeTxId,
} from "./address";
import { inspectChainTransferTx } from "./chain-verifier";

export interface SubmitDepositTxResult {
  ok: boolean;
  idempotent?: boolean;
  outcome: string;
  depositVerifyStatus: string;
  orderStatus: string;
  message: string;
  confirmations?: number;
  minConfirmations?: number;
  ambiguousSameAmount?: boolean;
  eventsCount?: number;
}

/**
 * Submits or retries blockchain TxID verification for a member's USDT package order.
 * Records all observed TRC20 transfer events with unique (network, txId, eventIndex),
 * flags unconfirmed/mismatched/ambiguous events, and never activates packages prematurely.
 */
export async function submitDepositTxId(params: {
  orderId: string;
  txId: string;
  proofNote?: string;
  actorId: string;
  isAdmin?: boolean;
}): Promise<SubmitDepositTxResult> {
  const order = await prisma.packageOrder.findUnique({
    where: { id: params.orderId },
    include: { matchedDepositEvent: true },
  });
  if (!order) {
    throw new Error("Order not found");
  }
  if (!params.isAdmin && order.memberId !== params.actorId) {
    throw new Error("Forbidden: order belongs to another member");
  }

  if (order.status === "CONFIRMED" || order.depositVerifyStatus === "MATCHED_CONFIRMED") {
    return {
      ok: true,
      idempotent: true,
      outcome: "ALREADY_CONFIRMED",
      depositVerifyStatus: order.depositVerifyStatus,
      orderStatus: order.status,
      message: "Order payment has already been verified and confirmed.",
    };
  }
  if (order.status === "CANCELLED") {
    throw new Error("Cancelled orders cannot accept payment submissions");
  }

  const config = await getOrCreateConfigTx(prisma);
  const network = order.usdtNetwork || config.usdtNetwork;
  const contractAddress = order.usdtContractAddress || config.usdtContractAddress;
  const depositAddress = order.usdtDepositAddress || config.usdtDepositAddress;
  const expectedMicros = order.expectedUsdtMicros ?? BigInt(order.amountUsdCents) * 10_000n;
  const minConfirmations = config.usdtMinConfirmations;

  if (!network || !contractAddress || !depositAddress) {
    throw new Error("USDT deposit service is not configured");
  }

  const normTxId = normalizeTxId(params.txId);
  if (!isValidTxIdForNetwork(network, normTxId)) {
    throw new Error("Invalid TxID format for configured USDT network");
  }

  // Check existing events recorded for this (network, txId)
  const existingTxEvents = await prisma.chainTransferEvent.findMany({
    where: {
      network,
      txId: normTxId,
    },
    select: { eventIndex: true, claimedOrderId: true },
  });
  if (existingTxEvents.some((e) => e.claimedOrderId === order.id)) {
    return {
      ok: true,
      idempotent: true,
      outcome: "ALREADY_CLAIMED_BY_SELF",
      depositVerifyStatus: order.depositVerifyStatus,
      orderStatus: order.status,
      message: "This TxID is already verified for this order.",
    };
  }
  const claimedByOtherIndexes = new Set(
    existingTxEvents
      .filter((e) => e.claimedOrderId && e.claimedOrderId !== order.id)
      .map((e) => e.eventIndex)
  );

  const inspection = await inspectChainTransferTx(network, normTxId);

  if (!inspection.ok) {
    const updated = await prisma.packageOrder.update({
      where: { id: order.id },
      data: {
        submittedTxId: normTxId,
        paymentProofNote: params.proofNote?.trim() || order.paymentProofNote,
        depositVerifyStatus: "VERIFYING",
        depositFailureReason: inspection.errorMessage,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        actorRole: params.isAdmin ? "ADMIN" : "MEMBER",
        action: "DEPOSIT_TX_DEFERRED",
        entityType: "PackageOrder",
        entityId: order.id,
        summary: `Deferred deposit TxID ${normTxId} for ${order.orderNo} (${inspection.errorCode})`,
        metadata: {
          txId: normTxId,
          errorCode: inspection.errorCode,
          errorMessage: inspection.errorMessage,
        },
      },
    });
    return {
      ok: true,
      outcome: inspection.errorCode,
      depositVerifyStatus: updated.depositVerifyStatus,
      orderStatus: updated.status,
      message: inspection.errorMessage,
    };
  }

  // Evaluate all TRC20 transfer events in this transaction
  const evaluated = inspection.transfers.map((tr) => {
    let outcome = "MATCHED";
    if (!inspection.txExecutedSuccess) {
      outcome = "TX_FAILED";
    } else if (tr.contractAddress !== contractAddress) {
      outcome = "WRONG_CONTRACT";
    } else if (tr.toAddress !== depositAddress) {
      outcome = "WRONG_ADDRESS";
    } else if (tr.amountMicros !== expectedMicros) {
      outcome = "WRONG_AMOUNT";
    } else if (inspection.confirmations < minConfirmations) {
      outcome = "UNCONFIRMED";
    }
    return { tr, outcome };
  });

  const unclaimedEvaluated = evaluated.filter(
    (e) => !claimedByOtherIndexes.has(e.tr.eventIndex)
  );
  if (evaluated.length > 0 && unclaimedEvaluated.length === 0) {
    throw new Error("This TxID transfer event has already been used to confirm another order");
  }

  const matchedConfirmed = unclaimedEvaluated.filter((e) => e.outcome === "MATCHED");
  const matchedUnconfirmed = unclaimedEvaluated.filter((e) => e.outcome === "UNCONFIRMED");

  // Check if multiple open orders on same deposit address share identical expected amount
  const sameAmountCount =
    matchedConfirmed.length === 1
      ? await prisma.packageOrder.count({
          where: {
            id: { not: order.id },
            status: "PENDING_CONFIRMATION",
            usdtDepositAddress: depositAddress,
            expectedUsdtMicros: expectedMicros,
          },
        })
      : 0;

  let nextVerifyStatus:
    | "VERIFYING"
    | "VERIFIED_MATCH"
    | "MANUAL_REVIEW" = "MANUAL_REVIEW";
  let failureReason: string | null = null;
  let actualMicros: bigint | null = null;
  let chainConfirmedAt: Date | null = null;
  let nextPaymentStatus: "UNPAID" | "PAID" | undefined = undefined;
  let nextPaidAt: Date | undefined = undefined;
  let overallOutcome = "MISMATCH";

  if (!inspection.txExecutedSuccess) {
    overallOutcome = "TX_FAILED";
    nextVerifyStatus = "MANUAL_REVIEW";
    failureReason = "Transaction failed on-chain execution";
  } else if (evaluated.length === 0) {
    overallOutcome = "NO_TRANSFER_EVENTS";
    nextVerifyStatus = "MANUAL_REVIEW";
    failureReason = "No USDT transfer event found in this transaction";
  } else if (matchedConfirmed.length > 1) {
    overallOutcome = "AMBIGUOUS_MULTI_EVENT";
    nextVerifyStatus = "MANUAL_REVIEW";
    failureReason =
      "Multiple matching USDT transfers found in this TxID; admin event selection required";
  } else if (matchedUnconfirmed.length > 0 && matchedConfirmed.length === 0) {
    overallOutcome = "UNCONFIRMED";
    nextVerifyStatus = "VERIFYING";
    actualMicros = matchedUnconfirmed[0].tr.amountMicros;
    failureReason = `Awaiting confirmations (${inspection.confirmations}/${minConfirmations})`;
  } else if (matchedConfirmed.length === 1) {
    actualMicros = matchedConfirmed[0].tr.amountMicros;
    chainConfirmedAt = inspection.chainTimestamp;
    if (sameAmountCount > 0) {
      overallOutcome = "AMBIGUOUS_SAME_AMOUNT";
      nextVerifyStatus = "MANUAL_REVIEW";
      failureReason =
        "Multiple pending orders share this exact USDT amount; admin attribution check required";
    } else {
      overallOutcome = "VERIFIED_MATCH";
      nextVerifyStatus = "VERIFIED_MATCH";
      failureReason = null;
      nextPaymentStatus = "PAID";
      nextPaidAt = inspection.chainTimestamp;
    }
  } else {
    // Specific mismatch diagnosis
    const first = evaluated[0];
    overallOutcome = first.outcome;
    actualMicros =
      evaluated.find((e) => e.tr.toAddress === depositAddress)?.tr.amountMicros ??
      first.tr.amountMicros;
    nextVerifyStatus = "MANUAL_REVIEW";
    if (evaluated.some((e) => e.outcome === "WRONG_AMOUNT" && e.tr.toAddress === depositAddress)) {
      overallOutcome = "WRONG_AMOUNT";
      failureReason = "Received USDT amount does not match exact order payable amount";
    } else if (evaluated.every((e) => e.outcome === "WRONG_CONTRACT")) {
      overallOutcome = "WRONG_CONTRACT";
      failureReason = "Token contract does not match configured USDT contract";
    } else {
      overallOutcome = "WRONG_ADDRESS";
      failureReason = "Recipient address does not match company deposit address";
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const item of unclaimedEvaluated) {
      const eventOutcome =
        matchedConfirmed.length > 1 && item.outcome === "MATCHED"
          ? "AMBIGUOUS_MULTI_EVENT"
          : sameAmountCount > 0 && item.outcome === "MATCHED"
            ? "AMBIGUOUS_SAME_AMOUNT"
            : item.outcome;

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
          verifyOutcome: eventOutcome,
          rawPayload: inspection.rawPayload,
          submittedByOrderId: order.id,
        },
        create: {
          direction: "DEPOSIT",
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
          verifyOutcome: eventOutcome,
          rawPayload: inspection.rawPayload,
          submittedByOrderId: order.id,
        },
      });
    }

    await tx.packageOrder.update({
      where: { id: order.id },
      data: {
        submittedTxId: normTxId,
        paymentProofNote: params.proofNote?.trim() || order.paymentProofNote,
        actualUsdtMicros: actualMicros,
        chainConfirmedAt,
        depositVerifyStatus: nextVerifyStatus,
        depositFailureReason: failureReason,
        ...(nextPaymentStatus
          ? {
              paymentStatus: nextPaymentStatus,
              paymentRef: normTxId,
              paidAt: nextPaidAt,
            }
          : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: params.actorId,
        actorRole: params.isAdmin ? "ADMIN" : "MEMBER",
        action: "DEPOSIT_TX_VERIFIED",
        entityType: "PackageOrder",
        entityId: order.id,
        summary: `Checked TxID ${normTxId} for ${order.orderNo}: ${overallOutcome} (conf=${inspection.confirmations}/${minConfirmations})`,
        metadata: {
          txId: normTxId,
          overallOutcome,
          confirmations: inspection.confirmations,
          minConfirmations,
          sameAmountCount,
        },
      },
    });
  });

  return {
    ok: true,
    outcome: overallOutcome,
    depositVerifyStatus: nextVerifyStatus,
    orderStatus: order.status,
    message: failureReason || "On-chain USDT payment verified; awaiting admin confirmation",
    confirmations: inspection.confirmations,
    minConfirmations,
    ambiguousSameAmount: sameAmountCount > 0,
    eventsCount: evaluated.length,
  };
}

/**
 * Admin verifies attribution of a specific ChainTransferEvent to a USDT deposit order
 * and atomically invokes `confirmPackageOrderTx` (activation, placement, BV, bonuses).
 */
export async function confirmUsdtDepositOrder(params: {
  orderId: string;
  operatorId: string;
  eventId?: string;
  attributionNote?: string;
  placementParentId?: string | null;
  placementLeg?: BinaryLeg | null;
  asOf?: Date;
}): Promise<ConfirmOrderResult> {
  const adminConfirmTime = params.asOf ?? new Date();

  return prisma.$transaction(async (tx) => {
    const lockedOrders = await tx.$queryRaw<
      Array<{
        id: string;
        orderNo: string;
        status: string;
        usdtNetwork: string | null;
        usdtContractAddress: string | null;
        usdtDepositAddress: string | null;
        expectedUsdtMicros: bigint | null;
        submittedTxId: string | null;
        matchedDepositEventId: string | null;
      }>
    >`
      SELECT
        id, "orderNo", status, "usdtNetwork", "usdtContractAddress",
        "usdtDepositAddress", "expectedUsdtMicros", "submittedTxId",
        "matchedDepositEventId"
      FROM package_orders
      WHERE id = ${params.orderId}
      FOR UPDATE
    `;
    const order = lockedOrders[0];
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status === "CONFIRMED") {
      return confirmPackageOrderTx(tx, {
        orderId: order.id,
        operatorId: params.operatorId,
        asOf: adminConfirmTime,
      });
    }

    const config = await getOrCreateConfigTx(tx);
    const network = order.usdtNetwork || config.usdtNetwork;
    const contractAddress = order.usdtContractAddress || config.usdtContractAddress;
    const depositAddress = order.usdtDepositAddress || config.usdtDepositAddress;
    const expectedMicros = order.expectedUsdtMicros ?? 0n;

    // Resolve target transfer event
    let targetEventId = params.eventId || order.matchedDepositEventId;
    if (!targetEventId && order.submittedTxId) {
      const candidates = await tx.chainTransferEvent.findMany({
        where: {
          network,
          txId: order.submittedTxId,
          direction: "DEPOSIT",
          contractAddress,
          toAddress: depositAddress,
          amountMicros: expectedMicros,
          chainSuccess: true,
        },
        orderBy: { eventIndex: "asc" },
      });
      if (candidates.length > 1) {
        throw new Error(
          "Multiple matching transfer events found in this TxID; please select the exact eventIndex to attribute"
        );
      }
      targetEventId = candidates[0]?.id ?? null;
    }

    if (!targetEventId) {
      throw new Error(
        "No valid on-chain USDT transfer event found for this order; submit and verify TxID first"
      );
    }

    const lockedEvents = await tx.$queryRaw<
      Array<{
        id: string;
        txId: string;
        eventIndex: number;
        contractAddress: string;
        toAddress: string;
        amountMicros: bigint;
        confirmations: number;
        chainSuccess: boolean;
        chainTimestamp: Date | null;
        claimedOrderId: string | null;
      }>
    >`
      SELECT
        id, "txId", "eventIndex", "contractAddress", "toAddress",
        "amountMicros", confirmations, "chainSuccess", "chainTimestamp", "claimedOrderId"
      FROM chain_transfer_events
      WHERE id = ${targetEventId}
      FOR UPDATE
    `;
    const ev = lockedEvents[0];
    if (!ev) {
      throw new Error("Chain transfer event not found");
    }
    if (ev.claimedOrderId && ev.claimedOrderId !== order.id) {
      throw new Error("Selected on-chain transfer event has already confirmed another order");
    }
    if (!ev.chainSuccess) {
      throw new Error("Selected transaction failed on-chain");
    }
    if (ev.confirmations < config.usdtMinConfirmations) {
      throw new Error(
        `Insufficient confirmations (${ev.confirmations}/${config.usdtMinConfirmations})`
      );
    }
    if (ev.contractAddress !== contractAddress) {
      throw new Error("Transfer contract address mismatch");
    }
    if (ev.toAddress !== depositAddress) {
      throw new Error("Transfer recipient address mismatch");
    }
    if (BigInt(ev.amountMicros) !== expectedMicros) {
      throw new Error("Transfer amount does not match order expected USDT");
    }

    const note =
      params.attributionNote?.trim() ||
      `Attributed TxID ${ev.txId} [#${ev.eventIndex}] by admin`;

    await tx.chainTransferEvent.update({
      where: { id: ev.id },
      data: {
        claimedOrderId: order.id,
        verifyOutcome: "MATCHED",
        attributionNote: note,
        verifiedById: params.operatorId,
        verifiedAt: adminConfirmTime,
      },
    });

    const chainArrivalTime = ev.chainTimestamp ?? adminConfirmTime;
    await tx.packageOrder.update({
      where: { id: order.id },
      data: {
        matchedDepositEventId: ev.id,
        submittedTxId: ev.txId,
        actualUsdtMicros: ev.amountMicros,
        chainConfirmedAt: chainArrivalTime,
        paymentStatus: "PAID",
        paymentRef: ev.txId,
        paidAt: chainArrivalTime,
        depositVerifyStatus: "MATCHED_CONFIRMED",
        depositFailureReason: null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: params.operatorId,
        actorRole: "ADMIN",
        action: "DEPOSIT_ATTRIBUTED",
        entityType: "PackageOrder",
        entityId: order.id,
        summary: `Attributed USDT deposit event ${ev.txId}#${ev.eventIndex} to ${order.orderNo}`,
        metadata: {
          eventId: ev.id,
          txId: ev.txId,
          eventIndex: ev.eventIndex,
          amountMicros: String(ev.amountMicros),
          chainConfirmedAt: chainArrivalTime.toISOString(),
          attributionNote: note,
        },
        createdAt: adminConfirmTime,
      },
    });

    const res = await confirmPackageOrderTx(tx, {
      orderId: order.id,
      operatorId: params.operatorId,
      placementParentId: params.placementParentId,
      placementLeg: params.placementLeg,
      asOf: adminConfirmTime,
    });

    if (!res.ok) {
      // Throw inside transaction so deposit claim & order status roll back atomically for clean retry!
      throw new Error(res.reason || "Order settlement failed");
    }

    return res;
  });
}
