import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getServerLocale } from "@/lib/i18n-server";
import { formatSgtTimestamp, getSgtDateString } from "@/lib/sgt";
import { AdminOrdersClient } from "@/components/admin/AdminOrdersClient";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  await requireAdmin();
  const locale = await getServerLocale();

  const [rawOrders, rawParents] = await Promise.all([
    prisma.packageOrder.findMany({
      include: {
        member: {
          include: { sponsor: { select: { memberCode: true } } },
        },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.member.findMany({
      where: { status: "ACTIVE" },
      include: {
        placedChildren: { select: { placementLeg: true } },
      },
      orderBy: { memberCode: "asc" },
    }),
  ]);

  const orders = rawOrders.map((o) => ({
    id: o.id,
    orderNo: o.orderNo,
    orderType: o.orderType,
    memberId: o.memberId,
    memberCode: o.member.memberCode,
    memberName: o.member.displayName,
    sponsorCode: o.member.sponsor?.memberCode ?? null,
    targetPackageCode: o.targetPackageCode,
    previousPackageCode: o.previousPackageCode,
    amountUsdCents: o.amountUsdCents,
    bvAmount: o.bvAmount,
    paymentStatus: o.paymentStatus,
    status: o.status,
    upgradeStatus: o.upgradeStatus,
    failureReason: o.failureReason,
    requestedPlacementParentId: o.requestedPlacementParentId,
    requestedPlacementLeg: o.requestedPlacementLeg,
    confirmedAtLabel: o.confirmedAt ? formatSgtTimestamp(o.confirmedAt) : null,
    effectiveAtLabel: o.effectiveAt
      ? formatSgtTimestamp(o.effectiveAt)
      : o.effectiveSgtDate
        ? `${o.effectiveSgtDate} SGT`
        : null,
    ruleVersion: o.ruleVersion,
    createdAtLabel: formatSgtTimestamp(o.createdAt),
    createdSgtDate: getSgtDateString(o.createdAt),
  }));

  const activeParents = rawParents.map((p) => ({
    id: p.id,
    memberCode: p.memberCode,
    displayName: p.displayName,
    leftOccupied: p.placedChildren.some((c) => c.placementLeg === "LEFT"),
    rightOccupied: p.placedChildren.some((c) => c.placementLeg === "RIGHT"),
  }));

  return <AdminOrdersClient locale={locale} orders={orders} activeParents={activeParents} />;
}
