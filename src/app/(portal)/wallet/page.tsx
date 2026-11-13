import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/session";
import { getServerT } from "@/lib/i18n-server";
import { formatSgtTimestamp } from "@/lib/sgt";
import { getOrCreateConfigTx } from "@/lib/settlement/engine";
import { isUsdtWithdrawalConfigured } from "@/lib/usdt/address";
import {
  calculateDirectRewardUsdtMicros,
  pointsCentsToUsdtMicros,
} from "@/lib/money";
import { WalletClient } from "@/components/portal/WalletClient";

export const dynamic = "force-dynamic";

const DEFAULT_FALLBACK_CONFIG = {
  id: 1,
  ruleVersion: 1,
  tieBreakerRule: "KEEP_LEFT" as const,
  headcountRule: "ACTIVE_PAID_ALL_DEPTHS" as const,
  upgradePriceMode: "DIFFERENCE" as const,
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
  usdtContractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  usdtDepositAddress: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
  usdtPayoutAddress: "TLyqzVGLV1srkB7dToTAEqgDSfPtXRJZYH",
  usdtMinConfirmations: 19,
  usdtWithdrawalProcessingHours: 72,
  usdtDepositsEnabled: true,
  usdtWithdrawalsEnabled: true,
  directRewardCurrency: "USDT" as const,
  directUsdtConversionMicros: 1000000,
  directUsdtWithdrawalsEnabled: false,
  updatedAt: new Date("2026-01-01"),
};

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; filter?: string }>;
}) {
  const member = await requireMember();
  const { locale, t } = await getServerT();
  const params = await searchParams;
  const initialMode = params.mode === "withdraw" ? "withdraw" : "overview";
  const initialFilter =
    params.filter === "DIRECT_USDT" ||
    params.filter === "DIRECT" ||
    params.filter === "PAIRING" ||
    params.filter === "WITHDRAW"
      ? params.filter
      : "ALL";

  let config: any = DEFAULT_FALLBACK_CONFIG;
  let withdrawals: any[] = [];
  let savedAddresses: any[] = [];
  let ledgers: any[] = [];
  let usdtRewards: any[] = [];
  let pendingSponsorOrders: any[] = [];

  try {
    const res = await Promise.all([
      getOrCreateConfigTx(prisma),
      prisma.withdrawalRequest.findMany({
        where: { memberId: member.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.memberSavedAddress.findMany({
        where: { memberId: member.id },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        take: 20,
      }),
      prisma.walletLedger.findMany({
        where: { memberId: member.id },
        include: {
          order: {
            include: {
              member: { select: { memberCode: true, displayName: true } },
            },
          },
          pairingSettlement: true,
          withdrawal: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.referralRewardLedger.findMany({
        where: { memberId: member.id, currency: "USDT" },
        include: {
          sourceMember: { select: { memberCode: true, displayName: true } },
          order: { select: { orderNo: true, targetPackageCode: true, confirmedAt: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.packageOrder.findMany({
        where: {
          status: "PENDING_CONFIRMATION",
          commissionableBv: { gt: 0 },
          member: { sponsorId: member.id },
        },
        include: {
          member: { select: { memberCode: true, displayName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);
    config = res[0];
    withdrawals = res[1];
    savedAddresses = res[2];
    ledgers = res[3];
    usdtRewards = res[4];
    pendingSponsorOrders = res[5];
  } catch (err) {
    console.warn("[WalletPage] DB lookup failed, using safe fallback defaults:", err);
  }

  let earnedDirectUsdtMicros = 0n;
  for (const row of usdtRewards) {
    if (row.status === "CREDITED" || row.status === "REVERSED") {
      earnedDirectUsdtMicros += row.amountMicros;
    }
  }

  const directUsdtItems = [
    ...usdtRewards.map((r) => ({
      id: r.id,
      rewardNo: r.rewardNo,
      orderNo: r.order.orderNo,
      packageCode: r.order.targetPackageCode,
      sourceMember: `${r.sourceMember.displayName} (${r.sourceMember.memberCode})`,
      baseBv: r.baseBv,
      rateBps: r.rateBps,
      amountMicros: r.amountMicros.toString(),
      status: r.status,
      timeLabel: formatSgtTimestamp(r.creditedAt ?? r.createdAt),
    })),
    ...pendingSponsorOrders.map((o) => ({
      id: `pending-${o.id}`,
      rewardNo: "PENDING",
      orderNo: o.orderNo,
      packageCode: o.targetPackageCode,
      sourceMember: `${o.member.displayName} (${o.member.memberCode})`,
      baseBv: o.commissionableBv,
      rateBps: config.directCommissionRateBps,
      amountMicros: calculateDirectRewardUsdtMicros(
        o.commissionableBv,
        config.directCommissionRateBps,
        config.directUsdtConversionMicros
      ).toString(),
      status: "PENDING",
      timeLabel: formatSgtTimestamp(o.createdAt),
    })),
  ];

  const serviceAvailable = isUsdtWithdrawalConfigured(config);

  return (
    <WalletClient
      t={t}
      locale={locale}
      initialMode={initialMode}
      initialFilter={initialFilter}
      memberStatus={member.status}
      availablePointsCents={member.availablePointsCents}
      lockedPointsCents={member.lockedPointsCents}
      cpBalanceCents={(member as any).cpBalanceCents || 0}
      rpBalanceCents={(member as any).rpBalanceCents || 0}
      feeRateBps={config.withdrawalFeeRateBps}
      usdRateMicros={config.withdrawalUsdRateMicros}
      isDemoRate={config.isDemoRate}
      usdtNetwork={config.usdtNetwork}
      processingHours={config.usdtWithdrawalProcessingHours}
      serviceAvailable={serviceAvailable}
      directUsdtEarnedMicros={(earnedDirectUsdtMicros > 0n ? earnedDirectUsdtMicros : 0n).toString()}
      directUsdtWithdrawalsEnabled={config.directUsdtWithdrawalsEnabled}
      directUsdtItems={directUsdtItems}
      savedAddresses={savedAddresses.map((sa) => ({
        id: sa.id,
        label: sa.label,
        network: sa.network,
        address: sa.address,
        isDefault: sa.isDefault,
      }))}
      withdrawals={withdrawals.map((w) => ({
        id: w.id,
        withdrawalNo: w.withdrawalNo,
        requestedPointsCents: w.requestedPointsCents,
        feePointsCents: w.feePointsCents,
        netPointsCents: w.netPointsCents,
        estimatedUsdCents: w.estimatedUsdCents,
        payoutAmountUsdtMicros: (
          w.payoutAmountUsdtMicros ??
          pointsCentsToUsdtMicros(w.netPointsCents, config.withdrawalUsdRateMicros)
        ).toString(),
        payoutNetwork: w.usdtNetwork ?? config.usdtNetwork,
        payoutDestination: w.payoutDestination,
        status: w.status,
        approvalStatus: w.approvalStatus,
        payoutStatus: w.payoutStatus,
        payoutCheckNote: w.payoutCheckNote,
        rejectionReason: w.rejectionReason,
        payoutTxRef: w.payoutTxRef,
        processingDeadlineLabel: w.processingDeadlineAt
          ? formatSgtTimestamp(w.processingDeadlineAt)
          : null,
        createdAtLabel: formatSgtTimestamp(w.createdAt),
      }))}
      ledgers={ledgers.map((l) => ({
        id: l.id,
        ledgerNo: l.ledgerNo,
        entryType: l.entryType,
        deltaAvailableCents: l.deltaAvailableCents,
        deltaLockedCents: l.deltaLockedCents,
        availableAfterCents: l.availableAfterCents,
        note: l.note,
        refNo:
          l.order?.orderNo ??
          l.pairingSettlement?.settlementNo ??
          l.withdrawal?.withdrawalNo ??
          null,
        createdAtLabel: formatSgtTimestamp(l.createdAt),
        sourceDetail: l.order
          ? {
              kind: "DIRECT_ORDER" as const,
              orderNo: l.order.orderNo,
              sourceMember: `${l.order.member.displayName} (${l.order.member.memberCode})`,
              packageCode: l.order.targetPackageCode,
              commissionableBv: l.order.commissionableBv,
              confirmedAtLabel: l.order.confirmedAt
                ? formatSgtTimestamp(l.order.confirmedAt)
                : formatSgtTimestamp(l.createdAt),
            }
          : l.pairingSettlement
            ? {
                kind: "BINARY_PAIRING" as const,
                settlementNo: l.pairingSettlement.settlementNo,
                settlementDate: l.pairingSettlement.settlementDate,
                triggerType: l.pairingSettlement.triggerType,
                pairsCount: l.pairingSettlement.pairsCount,
                bvDeductedPerLeg: l.pairingSettlement.bvDeductedPerLeg,
                leftBvBefore: l.pairingSettlement.leftBvBefore,
                rightBvBefore: l.pairingSettlement.rightBvBefore,
                leftBvAfter: l.pairingSettlement.leftBvAfter,
                rightBvAfter: l.pairingSettlement.rightBvAfter,
                dailyCapPointsCents: l.pairingSettlement.dailyCapPointsCents,
                dailyPairedAfterCents: l.pairingSettlement.dailyPairedAfterCents,
              }
            : l.withdrawal
              ? {
                  kind: "WITHDRAWAL" as const,
                  withdrawalNo: l.withdrawal.withdrawalNo,
                  status: l.withdrawal.status,
                  requestedPointsCents: l.withdrawal.requestedPointsCents,
                  feePointsCents: l.withdrawal.feePointsCents,
                  netPointsCents: l.withdrawal.netPointsCents,
                  estimatedUsdCents: l.withdrawal.estimatedUsdCents,
                }
              : null,
      }))}
    />
  );
}
