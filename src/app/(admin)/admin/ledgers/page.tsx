import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { formatSgtTimestamp, getSgtDateString } from "@/lib/sgt";
import { AdminLedgersClient } from "@/components/admin/AdminLedgersClient";

export const dynamic = "force-dynamic";

export default async function AdminLedgersPage() {
  await requireAdmin();

  const [walletLedgers, bvLedgers] = await Promise.all([
    prisma.walletLedger.findMany({
      include: {
        member: { select: { memberCode: true, displayName: true } },
        order: { select: { orderNo: true } },
        pairingSettlement: { select: { settlementNo: true } },
        withdrawal: { select: { withdrawalNo: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.bvLedger.findMany({
      include: {
        member: { select: { memberCode: true, displayName: true } },
        order: { select: { orderNo: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  return (
    <AdminLedgersClient
      walletRows={walletLedgers.map((w) => ({
        id: w.id,
        ledgerNo: w.ledgerNo,
        memberCode: w.member.memberCode,
        memberName: w.member.displayName,
        entryType: w.entryType,
        deltaAvailableCents: w.deltaAvailableCents,
        orderId: w.orderId,
        orderNo: w.order?.orderNo ?? null,
        settlementNo: w.pairingSettlement?.settlementNo ?? null,
        withdrawalNo: w.withdrawal?.withdrawalNo ?? null,
        note: w.note,
        sgtDate: getSgtDateString(w.createdAt),
        createdAtLabel: formatSgtTimestamp(w.createdAt),
      }))}
      bvRows={bvLedgers.map((b) => ({
        id: b.id,
        memberCode: b.member.memberCode,
        memberName: b.member.displayName,
        leg: b.leg,
        entryType: b.entryType,
        deltaBv: b.deltaBv,
        balanceAfterBv: b.balanceAfterBv,
        settlementDate: b.settlementDate,
        orderId: b.orderId,
        orderNo: b.order?.orderNo ?? null,
        note: b.note,
        createdAtLabel: formatSgtTimestamp(b.createdAt),
      }))}
    />
  );
}
