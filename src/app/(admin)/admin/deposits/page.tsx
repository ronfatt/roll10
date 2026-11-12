import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { formatSgtTimestamp } from "@/lib/sgt";
import { getOrCreateConfigTx } from "@/lib/settlement/engine";
import { AdminDepositsClient } from "@/components/admin/AdminDepositsClient";

export const dynamic = "force-dynamic";

export default async function AdminDepositsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const q = params.q?.trim() || "";
  const statusFilter = params.status?.trim() || "ALL";

  const where: Record<string, unknown> = {};
  if (statusFilter === "CONFIRMED") {
    where.status = "CONFIRMED";
  } else if (
    statusFilter === "AWAITING_TX" ||
    statusFilter === "VERIFYING" ||
    statusFilter === "VERIFIED_MATCH" ||
    statusFilter === "MANUAL_REVIEW" ||
    statusFilter === "REJECTED"
  ) {
    where.depositVerifyStatus = statusFilter;
  }

  if (q) {
    where.OR = [
      { orderNo: { contains: q, mode: "insensitive" } },
      { submittedTxId: { contains: q, mode: "insensitive" } },
      { member: { memberCode: { contains: q, mode: "insensitive" } } },
      { member: { displayName: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [config, rawOrders, activeMembers] = await Promise.all([
    getOrCreateConfigTx(prisma),
    prisma.packageOrder.findMany({
      where,
      include: {
        member: {
          select: {
            id: true,
            memberCode: true,
            displayName: true,
            status: true,
            sponsorId: true,
            sponsor: { select: { memberCode: true, displayName: true } },
            placementParent: { select: { memberCode: true, displayName: true } },
            placementLeg: true,
          },
        },
        targetPackage: true,
        matchedDepositEvent: true,
        depositTransferEvents: {
          orderBy: { eventIndex: "asc" },
        },
        walletLedgers: {
          include: { member: { select: { memberCode: true, displayName: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 80,
    }),
    prisma.member.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, memberCode: true, displayName: true },
      orderBy: { memberCode: "asc" },
      take: 200,
    }),
  ]);

  const orderIds = rawOrders.map((o) => o.id);
  const rawPairings =
    orderIds.length > 0
      ? await prisma.binaryPairingSettlement.findMany({
          where: { triggerOrderId: { in: orderIds } },
          include: { member: { select: { memberCode: true, displayName: true } } },
          orderBy: { createdAt: "asc" },
        })
      : [];
  const pairingsByOrder = new Map<typeof rawPairings[number]["triggerOrderId"], typeof rawPairings>();
  for (const p of rawPairings) {
    const arr = pairingsByOrder.get(p.triggerOrderId) ?? [];
    arr.push(p);
    pairingsByOrder.set(p.triggerOrderId, arr);
  }

  const orders = rawOrders.map((o) => {
    const orderPairings = pairingsByOrder.get(o.id) ?? [];
    return {
      id: o.id,
      orderNo: o.orderNo,
      orderType: o.orderType,
      status: o.status,
      paymentStatus: o.paymentStatus,
      depositVerifyStatus: o.depositVerifyStatus,
      depositFailureReason: o.depositFailureReason,
      attributionNote: o.matchedDepositEvent?.attributionNote ?? null,
      targetPackageCode: o.targetPackageCode,
      bvAmount: o.bvAmount,
      commissionableBv: o.commissionableBv,
      usdtNetwork: o.usdtNetwork ?? config.usdtNetwork,
      usdtContractAddress: o.usdtContractAddress ?? config.usdtContractAddress,
      usdtDepositAddress: o.usdtDepositAddress ?? config.usdtDepositAddress,
      expectedUsdtMicros: (
        o.expectedUsdtMicros ?? o.targetPackage.priceUsdtMicros
      ).toString(),
      actualUsdtMicros: o.actualUsdtMicros ? o.actualUsdtMicros.toString() : null,
      submittedTxId: o.submittedTxId,
      proofNote: o.paymentProofNote,
      confirmationsObserved:
        o.matchedDepositEvent?.confirmations ??
        o.depositTransferEvents[0]?.confirmations ??
        0,
      matchedDepositEventId: o.matchedDepositEventId,
      chainConfirmedAtLabel: o.chainConfirmedAt
        ? formatSgtTimestamp(o.chainConfirmedAt)
        : null,
      confirmedAtLabel: o.confirmedAt ? formatSgtTimestamp(o.confirmedAt) : null,
      effectiveAtLabel: o.effectiveAt ? formatSgtTimestamp(o.effectiveAt) : null,
      createdAtLabel: formatSgtTimestamp(o.createdAt),
      member: {
        id: o.member.id,
        memberCode: o.member.memberCode,
        displayName: o.member.displayName,
        status: o.member.status,
        sponsorCode: o.member.sponsor?.memberCode ?? null,
        sponsorName: o.member.sponsor?.displayName ?? null,
        placementParentCode: o.member.placementParent?.memberCode ?? null,
        placementLeg: o.member.placementLeg,
      },
      events: o.depositTransferEvents.map((ev) => ({
        id: ev.id,
        txId: ev.txId,
        eventIndex: ev.eventIndex,
        fromAddress: ev.fromAddress,
        toAddress: ev.toAddress,
        contractAddress: ev.contractAddress,
        amountMicros: ev.amountMicros.toString(),
        confirmations: ev.confirmations,
        chainSuccess: ev.chainSuccess,
        claimedOrderId: ev.claimedOrderId,
        blockTimestampLabel: ev.chainTimestamp
          ? formatSgtTimestamp(ev.chainTimestamp)
          : null,
      })),
      walletLedgers: o.walletLedgers.map((l) => ({
        id: l.id,
        ledgerNo: l.ledgerNo,
        entryType: l.entryType,
        memberCode: l.member.memberCode,
        deltaAvailableCents: l.deltaAvailableCents,
        note: l.note,
      })),
      pairingSettlements: orderPairings.map((p) => ({
        id: p.id,
        settlementNo: p.settlementNo,
        memberCode: p.member.memberCode,
        pairsCount: p.pairsCount,
        pointsAwardedCents: p.pointsAwardedCents,
      })),
    };
  });

  return (
    <AdminDepositsClient
      initialQuery={q}
      initialStatus={statusFilter}
      minConfirmations={config.usdtMinConfirmations}
      orders={orders}
      activeMembers={activeMembers}
    />
  );
}
