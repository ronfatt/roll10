import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/session";
import { getServerT } from "@/lib/i18n-server";
import { formatSgtTimestamp } from "@/lib/sgt";
import { getOrCreateConfigTx } from "@/lib/settlement/engine";
import { isUsdtDepositConfigured } from "@/lib/usdt/address";
import {
  UsdtOrderPaymentClient,
  type UsdtOrderView,
} from "@/components/portal/UsdtOrderPaymentClient";

export const dynamic = "force-dynamic";

export default async function MemberOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const member = await requireMember();
  const { locale, t } = await getServerT();
  const { id } = await params;

  const [order, config] = await Promise.all([
    prisma.packageOrder.findUnique({
      where: { id },
      include: {
        targetPackage: true,
        depositTransferEvents: {
          orderBy: { eventIndex: "asc" },
        },
      },
    }),
    getOrCreateConfigTx(prisma),
  ]);

  if (!order) {
    notFound();
  }
  if (order.memberId !== member.id && member.role !== "ADMIN") {
    redirect("/packages");
  }

  const serviceAvailable =
    isUsdtDepositConfigured(config) &&
    Boolean(order.usdtDepositAddress || config.usdtDepositAddress);

  const initialOrder: UsdtOrderView = {
    id: order.id,
    orderNo: order.orderNo,
    orderType: order.orderType,
    targetPackageCode: order.targetPackageCode,
    tierName:
      locale === "zh-CN"
        ? order.targetPackage.nameZh
        : order.targetPackage.nameEn,
    bvAmount: order.bvAmount,
    status: order.status,
    paymentStatus: order.paymentStatus,
    usdtNetwork: order.usdtNetwork ?? config.usdtNetwork,
    usdtContractAddress: order.usdtContractAddress ?? config.usdtContractAddress,
    usdtDepositAddress: order.usdtDepositAddress ?? config.usdtDepositAddress,
    expectedUsdtMicros: (
      order.expectedUsdtMicros ?? order.targetPackage.priceUsdtMicros
    ).toString(),
    actualUsdtMicros:
      order.actualUsdtMicros !== null ? order.actualUsdtMicros.toString() : null,
    submittedTxId: order.submittedTxId,
    proofNote: order.paymentProofNote,
    depositVerifyStatus: order.depositVerifyStatus,
    depositFailureReason: order.depositFailureReason,
    confirmationsObserved: order.depositTransferEvents[0]?.confirmations ?? 0,
    minConfirmations: config.usdtMinConfirmations,
    chainConfirmedAtLabel: order.chainConfirmedAt
      ? formatSgtTimestamp(order.chainConfirmedAt)
      : null,
    confirmedAtLabel: order.confirmedAt
      ? formatSgtTimestamp(order.confirmedAt)
      : null,
    effectiveAtLabel: order.effectiveAt
      ? formatSgtTimestamp(order.effectiveAt)
      : order.effectiveSgtDate
        ? `${order.effectiveSgtDate} SGT`
        : null,
    createdAtLabel: formatSgtTimestamp(order.createdAt),
    events: order.depositTransferEvents.map((ev) => ({
      id: ev.id,
      eventIndex: ev.eventIndex,
      fromAddress: ev.fromAddress,
      toAddress: ev.toAddress,
      contractAddress: ev.contractAddress,
      amountMicros: ev.amountMicros.toString(),
      confirmations: ev.confirmations,
      chainSuccess: ev.chainSuccess,
      blockTimestamp: ev.chainTimestamp ? formatSgtTimestamp(ev.chainTimestamp) : null,
    })),
  };

  return (
    <UsdtOrderPaymentClient
      t={t}
      locale={locale}
      serviceAvailable={serviceAvailable}
      initialOrder={initialOrder}
    />
  );
}
