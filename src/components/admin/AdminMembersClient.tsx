"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GitBranch, Search } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { formatLegLabel, formatMemberStatus } from "@/lib/i18n-labels";
import { formatBv, formatU } from "@/lib/money";

interface MemberRow {
  id: string;
  memberCode: string;
  email: string;
  displayName: string;
  role: "MEMBER" | "ADMIN";
  status: "PENDING_PAYMENT" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
  sponsorCode: string | null;
  placementParentCode: string | null;
  placementLeg: string | null;
  currentPackageCode: string | null;
  leftBv: number;
  rightBv: number;
  availablePointsCents: number;
  lockedPointsCents: number;
}

export function AdminMembersClient({
  locale = "en",
  members,
  currentAdminId,
}: {
  locale?: Locale;
  members: MemberRow[];
  currentAdminId: string;
}) {
  const isZh = locale === "zh-CN";
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const filtered = members.filter((m) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      m.memberCode.toLowerCase().includes(q) ||
      m.displayName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    );
  });

  const updateMember = async (
    id: string,
    patch: { role?: "MEMBER" | "ADMIN"; status?: MemberRow["status"] }
  ) => {
    setBusyId(id);
    setMsg(null);
    const res = await fetch(`/api/admin/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok || !data.ok) {
      setMsg(data.error || (isZh ? "更新失败" : "Update failed"));
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {isZh ? "会员名录与权限管理" : "Member Directory & Roles"}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {isZh
              ? "查看直推与双轨安置关系、BV 余额、钱包可提与冻结 U、账号状态及管理员角色权限。"
              : "Inspect sponsor vs placement relationships, BV, wallet balances, account status, and roles."}
          </p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isZh ? "搜索会员编号、昵称或邮箱..." : "Search code, name, or email..."}
            className="w-full rounded-xl border border-white/10 bg-[#141619] py-2 pl-9 pr-3 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#CBB487]/60 sm:w-64"
          />
        </div>
      </div>

      {msg && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">
          {msg}
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/[0.08] text-zinc-400">
              <tr>
                <th className="py-2 pr-3">{isZh ? "会员" : "Member"}</th>
                <th className="py-2 pr-3">{isZh ? "直推推荐人" : "Sponsor"}</th>
                <th className="py-2 pr-3">{isZh ? "双轨安置" : "Placement"}</th>
                <th className="py-2 pr-3">{isZh ? "配套" : "Pkg"}</th>
                <th className="py-2 pr-3">{isZh ? "BV (左 / 右)" : "BV (L / R)"}</th>
                <th className="py-2 pr-3">{isZh ? "钱包 U (可提 / 冻结)" : "Wallet U (Avail / Lock)"}</th>
                <th className="py-2 pr-3">{isZh ? "状态" : "Status"}</th>
                <th className="py-2 pr-3">{isZh ? "角色" : "Role"}</th>
                <th className="py-2 pr-3">{isZh ? "网络图" : "Tree"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {filtered.map((m) => (
                <tr key={m.id}>
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-white">{m.displayName}</div>
                    <div className="tabular-nums text-[11px] text-[#D8C39A]">
                      {m.memberCode} · {m.email}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums text-zinc-300">
                    {m.sponsorCode ?? "—"}
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums text-zinc-300">
                    {m.placementParentCode
                      ? `${m.placementParentCode} (${formatLegLabel(m.placementLeg, locale)})`
                      : isZh
                        ? "顶点 / 暂未安置"
                        : "Root / Unplaced"}
                  </td>
                  <td className="py-2.5 pr-3 font-medium text-zinc-200">
                    {m.currentPackageCode ?? "—"}
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums text-zinc-200">
                    {formatBv(m.leftBv)} / {formatBv(m.rightBv)}
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums text-emerald-300">
                    {formatU(m.availablePointsCents)} / {formatU(m.lockedPointsCents)} U
                  </td>
                  <td className="py-2.5 pr-3">
                    <select
                      disabled={busyId === m.id}
                      value={m.status}
                      onChange={(e) =>
                        void updateMember(m.id, { status: e.target.value as MemberRow["status"] })
                      }
                      className="rounded-lg border border-white/10 bg-[#08090B] px-2 py-1 text-[11px] text-zinc-200"
                    >
                      <option value="PENDING_PAYMENT">{formatMemberStatus("PENDING_PAYMENT", locale)}</option>
                      <option value="ACTIVE">{formatMemberStatus("ACTIVE", locale)}</option>
                      <option value="SUSPENDED">{formatMemberStatus("SUSPENDED", locale)}</option>
                      <option value="CANCELLED">{formatMemberStatus("CANCELLED", locale)}</option>
                    </select>
                  </td>
                  <td className="py-2.5 pr-3">
                    <select
                      disabled={busyId === m.id || m.id === currentAdminId}
                      value={m.role}
                      onChange={(e) =>
                        void updateMember(m.id, { role: e.target.value as "MEMBER" | "ADMIN" })
                      }
                      className="rounded-lg border border-white/10 bg-[#08090B] px-2 py-1 text-[11px] text-zinc-200 disabled:opacity-50"
                    >
                      <option value="MEMBER">{isZh ? "普通会员" : "MEMBER"}</option>
                      <option value="ADMIN">{isZh ? "管理员" : "ADMIN"}</option>
                    </select>
                  </td>
                  <td className="py-2.5 pr-3">
                    <Link
                      href={`/tree?focusId=${m.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-[#D8C39A] hover:border-[#CBB487]/40"
                    >
                      <GitBranch className="h-3 w-3" />
                      <span>{isZh ? "查看树" : "Tree"}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
