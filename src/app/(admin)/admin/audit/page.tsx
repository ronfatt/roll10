import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { formatSgtTimestamp } from "@/lib/sgt";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  await requireAdmin();

  const logs = await prisma.auditLog.findMany({
    include: {
      actor: { select: { memberCode: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 150,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Immutable Audit Logs
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Orders, binary placements, rule updates, EOD settlements, withdrawals, and admin balance adjustments.
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/[0.08] text-zinc-400">
              <tr>
                <th className="py-2 pr-3">Time (SGT)</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Actor</th>
                <th className="py-2 pr-3">Entity</th>
                <th className="py-2 pr-3">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2.5 pr-3 tabular-nums text-zinc-400">
                    {formatSgtTimestamp(log.createdAt)}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="rounded bg-[#CBB487]/15 px-2 py-0.5 text-[11px] font-medium text-[#D8C39A]">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-zinc-300">
                    {log.actor
                      ? `${log.actor.memberCode} (${log.actor.displayName})`
                      : log.actorRole ?? "SYSTEM"}
                  </td>
                  <td className="py-2.5 pr-3 text-zinc-400">
                    {log.entityType}
                  </td>
                  <td className="py-2.5 pr-3 text-zinc-200">{log.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
