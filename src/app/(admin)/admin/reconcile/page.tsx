import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { AdminReconcileClient } from "@/components/admin/AdminReconcileClient";

export const dynamic = "force-dynamic";

export default async function AdminReconcilePage() {
  await requireAdmin();

  const [members, walletSums, bvSums] = await Promise.all([
    prisma.member.findMany({ orderBy: { memberCode: "asc" }, take: 100 }),
    prisma.walletLedger.groupBy({
      by: ["memberId"],
      _sum: { deltaAvailableCents: true, deltaLockedCents: true },
    }),
    prisma.bvLedger.groupBy({
      by: ["memberId", "leg"],
      _sum: { deltaBv: true },
    }),
  ]);

  const walletMap = new Map<string, { avail: number; locked: number }>();
  for (const w of walletSums) {
    walletMap.set(w.memberId, {
      avail: w._sum.deltaAvailableCents ?? 0,
      locked: w._sum.deltaLockedCents ?? 0,
    });
  }

  const bvMap = new Map<string, { left: number; right: number }>();
  for (const b of bvSums) {
    const cur = bvMap.get(b.memberId) ?? { left: 0, right: 0 };
    if (b.leg === "LEFT") cur.left = b._sum.deltaBv ?? 0;
    if (b.leg === "RIGHT") cur.right = b._sum.deltaBv ?? 0;
    bvMap.set(b.memberId, cur);
  }

  const rows = members.map((m) => {
    const wSum = walletMap.get(m.id) ?? { avail: 0, locked: 0 };
    const bSum = bvMap.get(m.id) ?? { left: 0, right: 0 };
    const isBalanced =
      m.availablePointsCents === wSum.avail &&
      m.lockedPointsCents === wSum.locked &&
      m.leftBv === bSum.left &&
      m.rightBv === bSum.right;

    return {
      memberId: m.id,
      memberCode: m.memberCode,
      displayName: m.displayName,
      availBalanceCents: m.availablePointsCents,
      availLedgerSumCents: wSum.avail,
      lockedBalanceCents: m.lockedPointsCents,
      lockedLedgerSumCents: wSum.locked,
      leftBvBalance: m.leftBv,
      leftBvLedgerSum: bSum.left,
      rightBvBalance: m.rightBv,
      rightBvLedgerSum: bSum.right,
      isBalanced,
    };
  });

  return <AdminReconcileClient rows={rows} />;
}
