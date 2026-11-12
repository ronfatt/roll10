import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getServerLocale } from "@/lib/i18n-server";
import { formatSgtTimestamp } from "@/lib/sgt";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  await requireAdmin();
  const locale = await getServerLocale();
  const isZh = locale === "zh-CN";

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
          {isZh ? "不可篡改审计日志" : "Immutable Audit Logs"}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {isZh
            ? "记录全平台订单确认、双轨安置、规则版本更新、午夜日结、提现出款及后台调账操作。"
            : "Orders, binary placements, rule updates, EOD settlements, withdrawals, and admin balance adjustments."}
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/[0.08] text-zinc-400">
              <tr>
                <th className="py-2 pr-3">{isZh ? "时间 (SGT)" : "Time (SGT)"}</th>
                <th className="py-2 pr-3">{isZh ? "操作类型" : "Action"}</th>
                <th className="py-2 pr-3">{isZh ? "操作人" : "Actor"}</th>
                <th className="py-2 pr-3">{isZh ? "目标实体" : "Entity"}</th>
                <th className="py-2 pr-3">{isZh ? "变更摘要" : "Summary"}</th>
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
