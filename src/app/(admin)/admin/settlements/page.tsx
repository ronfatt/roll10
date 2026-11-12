import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getServerLocale } from "@/lib/i18n-server";
import { formatSgtTimestamp, getSgtDateString } from "@/lib/sgt";
import { AdminSettlementsClient } from "@/components/admin/AdminSettlementsClient";

export const dynamic = "force-dynamic";

export default async function AdminSettlementsPage() {
  await requireAdmin();
  const locale = await getServerLocale();
  const currentSgtDate = getSgtDateString(new Date());

  const [raw, laggingActiveCount] = await Promise.all([
    prisma.dailySettlement.findMany({
      include: {
        member: { select: { memberCode: true, displayName: true } },
      },
      orderBy: [{ settlementDate: "desc" }, { executedAt: "desc" }],
      take: 200,
    }),
    prisma.member.count({
      where: {
        status: "ACTIVE",
        activeSettlementDate: { lt: currentSgtDate },
      },
    }),
  ]);

  const byDate = new Map<
    string,
    {
      recordsCount: number;
      totalFlushedBv: number;
      triggers: Set<string>;
      latestExecutedAt: Date;
    }
  >();

  for (const s of raw) {
    const cur = byDate.get(s.settlementDate) ?? {
      recordsCount: 0,
      totalFlushedBv: 0,
      triggers: new Set<string>(),
      latestExecutedAt: s.executedAt,
    };
    cur.recordsCount++;
    cur.totalFlushedBv += s.flushedBv;
    cur.triggers.add(s.triggeredBy);
    if (s.executedAt > cur.latestExecutedAt) cur.latestExecutedAt = s.executedAt;
    byDate.set(s.settlementDate, cur);
  }

  const jobSummaries = Array.from(byDate.entries()).map(([settlementDate, info]) => ({
    settlementDate,
    recordsCount: info.recordsCount,
    totalFlushedBv: info.totalFlushedBv,
    triggeredBySummary: Array.from(info.triggers).join(", "),
    latestExecutedLabel: formatSgtTimestamp(info.latestExecutedAt),
    status: "SETTLED",
  }));

  return (
    <AdminSettlementsClient
      locale={locale}
      currentSgtDate={currentSgtDate}
      laggingActiveCount={laggingActiveCount}
      jobSummaries={jobSummaries}
      settlements={raw.map((s) => ({
        id: s.id,
        settlementNo: s.settlementNo,
        settlementDate: s.settlementDate,
        memberCode: s.member.memberCode,
        memberName: s.member.displayName,
        leftBvBefore: s.leftBvBefore,
        rightBvBefore: s.rightBvBefore,
        leftMemberCount: s.leftMemberCount,
        rightMemberCount: s.rightMemberCount,
        retainedSide: s.retainedSide,
        flushedSide: s.flushedSide,
        flushedBv: s.flushedBv,
        leftBvAfter: s.leftBvAfter,
        rightBvAfter: s.rightBvAfter,
        decisionBasis: s.decisionBasis,
        triggeredBy: s.triggeredBy,
        ruleVersion: s.ruleVersion,
        businessAtLabel: formatSgtTimestamp(s.businessAt),
        executedAtLabel: formatSgtTimestamp(s.executedAt),
      }))}
    />
  );
}
