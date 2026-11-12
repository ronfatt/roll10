import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getServerLocale } from "@/lib/i18n-server";
import { formatSgtTimestamp } from "@/lib/sgt";
import { pointsCentsToUsdtMicros } from "@/lib/money";
import { getOrCreateConfigTx } from "@/lib/settlement/engine";
import { AdminWithdrawalsClient } from "@/components/admin/AdminWithdrawalsClient";

export const dynamic = "force-dynamic";

export default async function AdminWithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const admin = await requireAdmin();
  const locale = await getServerLocale();
  const params = await searchParams;
  const sortMode = params.sort === "newest" ? "newest" : "deadline";
  const nowMs = Date.now();

  const [config, raw] = await Promise.all([
    getOrCreateConfigTx(prisma),
    prisma.withdrawalRequest.findMany({
      include: {
        member: {
          select: {
            memberCode: true,
            displayName: true,
            lockedPointsCents: true,
          },
        },
        claimedBy: {
          select: {
            id: true,
            memberCode: true,
            displayName: true,
          },
        },
        matchedPayoutEvent: true,
        payoutTransferEvents: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy:
        sortMode === "newest"
          ? [{ createdAt: "desc" }]
          : [{ processingDeadlineAt: "asc" }, { createdAt: "asc" }],
      take: 80,
    }),
  ]);

  return (
    <AdminWithdrawalsClient
      locale={locale}
      currentAdminId={admin.id}
      sortMode={sortMode}
      productionPayoutEnabled={config.productionPayoutEnabled}
      usdtPayoutAddress={config.usdtPayoutAddress}
      withdrawals={raw.map((w) => {
        const deadlineMs = w.processingDeadlineAt
          ? w.processingDeadlineAt.getTime()
          : null;
        const isTerminal = w.status === "PAID" || w.status === "REJECTED";
        const isOverdue = !isTerminal && deadlineMs !== null && deadlineMs < nowMs;
        const isNearDeadline =
          !isTerminal &&
          !isOverdue &&
          deadlineMs !== null &&
          deadlineMs - nowMs <= 12 * 3600 * 1000;

        return {
          id: w.id,
          withdrawalNo: w.withdrawalNo,
          memberCode: w.member.memberCode,
          memberName: w.member.displayName,
          memberLockedPointsCents: w.member.lockedPointsCents,
          requestedPointsCents: w.requestedPointsCents,
          feeRateBpsSnapshot: w.feeRateBpsSnapshot,
          feePointsCents: w.feePointsCents,
          netPointsCents: w.netPointsCents,
          usdRateMicros: w.usdRateMicros,
          estimatedUsdCents: w.estimatedUsdCents,
          payoutAmountUsdtMicros: (
            w.payoutAmountUsdtMicros ??
            pointsCentsToUsdtMicros(w.netPointsCents, config.withdrawalUsdRateMicros)
          ).toString(),
          payoutNetwork: w.usdtNetwork ?? config.usdtNetwork,
          isDemoRate: w.isDemoRate,
          payoutDestination: w.payoutDestination,
          status: w.status,
          approvalStatus: w.approvalStatus,
          payoutStatus: w.payoutStatus,
          payoutCheckNote: w.payoutCheckNote,
          payoutTxRef: w.payoutTxRef,
          confirmationsObserved:
            w.matchedPayoutEvent?.confirmations ??
            w.payoutTransferEvents[0]?.confirmations ??
            0,
          rejectionReason: w.rejectionReason,
          claimedById: w.claimedById,
          claimedByLabel: w.claimedBy
            ? `${w.claimedBy.displayName} (${w.claimedBy.memberCode})`
            : null,
          processingDeadlineLabel: w.processingDeadlineAt
            ? formatSgtTimestamp(w.processingDeadlineAt)
            : null,
          isOverdue,
          isNearDeadline,
          createdAtLabel: formatSgtTimestamp(w.createdAt),
        };
      })}
    />
  );
}
