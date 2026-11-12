import { headers } from "next/headers";
import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/session";
import { getServerT } from "@/lib/i18n-server";
import {
  calculateDirectRewardUsdtMicros,
  formatU,
  formatUsdtMicros,
} from "@/lib/money";
import { getOrCreateConfigTx } from "@/lib/settlement/engine";
import { formatSgtTimestamp } from "@/lib/sgt";
import { CopyButton } from "@/components/CopyButton";

export const dynamic = "force-dynamic";

export default async function ReferralsPage() {
  const member = await requireMember();
  const { locale, t } = await getServerT();

  const headerList = await headers();
  const host = headerList.get("host") || "localhost:3000";
  const proto =
    host.includes("localhost") || host.startsWith("127.") ? "http" : "https";
  const referralLink = `${proto}://${host}/register?ref=${member.memberCode}`;

  const [config, directs, legacyPtsAgg, usdtEarnedAgg, usdtPendingAgg, pendingOrders] =
    await Promise.all([
      getOrCreateConfigTx(prisma),
      prisma.member.findMany({
        where: { sponsorId: member.id },
        include: {
          placementParent: { select: { memberCode: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.walletLedger.aggregate({
        where: { memberId: member.id, entryType: "DIRECT_COMMISSION" },
        _sum: { deltaAvailableCents: true },
      }),
      prisma.referralRewardLedger.aggregate({
        where: {
          memberId: member.id,
          currency: "USDT",
          status: { in: ["CREDITED", "REVERSED"] },
        },
        _sum: { amountMicros: true },
      }),
      prisma.referralRewardLedger.aggregate({
        where: {
          memberId: member.id,
          currency: "USDT",
          status: "PENDING",
        },
        _sum: { amountMicros: true },
      }),
      prisma.packageOrder.findMany({
        where: {
          status: "PENDING_CONFIRMATION",
          commissionableBv: { gt: 0 },
          member: { sponsorId: member.id },
        },
        select: { commissionableBv: true },
      }),
    ]);

  const registeredCount = directs.length;
  const activatedCount = directs.filter((d) => d.status === "ACTIVE").length;
  const pendingCount = directs.filter((d) => d.status === "PENDING_PAYMENT").length;

  const earnedUsdtMicros = usdtEarnedAgg._sum.amountMicros ?? 0n;
  let pendingUsdtMicros = usdtPendingAgg._sum.amountMicros ?? 0n;
  for (const ord of pendingOrders) {
    pendingUsdtMicros += calculateDirectRewardUsdtMicros(
      ord.commissionableBv,
      config.directCommissionRateBps,
      config.directUsdtConversionMicros
    );
  }
  const historicalPtsCents = legacyPtsAgg._sum.deltaAvailableCents ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#F2F0EB]">
          {t.referrals.title}
        </h1>
        <p className="mt-1 text-xs text-[#9DA4B0]">{t.referrals.subtitle}</p>
      </div>

      {/* Invite Link & Direct Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#6E512D]/45 bg-[#14171C] p-4 sm:p-5 lg:col-span-2">
          <div className="text-xs font-medium text-[#9DA4B0]">{t.referrals.inviteLink}</div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="font-mono-sgt flex-1 truncate rounded-xl border border-white/10 bg-[#08090B] px-3 py-2 text-xs text-[#E7C98E]">
              {referralLink}
            </code>
            <CopyButton
              value={referralLink}
              label={t.common.copy}
              copiedLabel={t.common.copied}
            />
          </div>
          <div className="mt-2.5 text-xs text-[#9DA4B0]">
            {t.referrals.memberCode}:{" "}
            <span className="font-mono-sgt font-semibold text-[#F2F0EB]">
              {member.memberCode}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-[#6E512D]/45 bg-[#14171C] p-4 sm:p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-[#9DA4B0]">{t.referrals.totalDirects}</div>
              <div className="mt-1.5 flex items-center gap-2 tabular-nums text-2xl font-bold text-[#F2F0EB]">
                <Users className="h-5 w-5 text-[#C9A66B]" />
                <span>{registeredCount}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-[#9DA4B0]">
                <span>
                  {t.referrals.registeredCountLabel}: {registeredCount}
                </span>
                <span className="text-emerald-300">
                  {t.referrals.activatedCountLabel}: {activatedCount}
                </span>
                {pendingCount > 0 && (
                  <span className="text-amber-300">
                    {t.referrals.pendingCountLabel}: {pendingCount}
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs text-[#9DA4B0]">{t.referrals.totalCommission}</div>
              <div className="mt-1.5 tabular-nums text-2xl font-bold text-[#E7C98E]">
                {formatUsdtMicros(earnedUsdtMicros > 0n ? earnedUsdtMicros : 0n, "U")}
              </div>
              <div className="mt-1 text-[10px] text-[#9DA4B0]">{t.overview.usdtUnitNote}</div>
            </div>
          </div>

          {(pendingUsdtMicros > 0n || historicalPtsCents > 0) && (
            <div className="border-t border-white/[0.08] pt-2.5 space-y-1 text-[11px]">
              {pendingUsdtMicros > 0n && (
                <div className="flex items-center justify-between text-amber-300">
                  <span>{t.referrals.pendingRewardsLabel}</span>
                  <span className="tabular-nums font-semibold">
                    {formatUsdtMicros(pendingUsdtMicros, "USDT")}
                  </span>
                </div>
              )}
              {historicalPtsCents > 0 && (
                <div className="flex items-center justify-between text-[#9DA4B0]">
                  <span>{t.referrals.legacyPointsLabel}</span>
                  <span className="tabular-nums font-semibold text-[#F2F0EB]">
                    {formatU(historicalPtsCents)} {t.common.points}
                  </span>
                </div>
              )}
            </div>
          )}

          <Link
            href="/wallet?filter=DIRECT_USDT"
            className="inline-flex min-h-[36px] items-center gap-1 text-xs font-semibold text-[#E7C98E] hover:underline"
          >
            <span>
              {locale === "zh-CN" ? "查看直推奖励 U 流水" : "View Direct U Ledger"}
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Direct Referrals List (Mobile Cards + Desktop Table) */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#14171C] p-4 sm:p-5">
        {directs.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#9DA4B0]">{t.common.noData}</p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-2.5 sm:hidden">
              {directs.map((d) => (
                <div
                  key={d.id}
                  className="rounded-xl border border-white/[0.07] bg-[#08090B] p-3.5 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-[#F2F0EB]">
                        {d.displayName}
                      </div>
                      <div className="font-mono-sgt text-[11px] text-[#E7C98E]">
                        {d.memberCode}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        d.status === "ACTIVE"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-amber-500/15 text-amber-300"
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#9DA4B0]">
                    <span>Plan: {d.currentPackageCode ?? "Pending"}</span>
                    <span>
                      {d.placementParent
                        ? `${d.placementParent.memberCode} · ${d.placementLeg}`
                        : "Unplaced"}
                    </span>
                  </div>
                  <div className="font-mono-sgt text-[10px] text-[#9DA4B0]">
                    {formatSgtTimestamp(d.createdAt)}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/[0.08] text-[#9DA4B0]">
                  <tr>
                    <th className="py-2 pr-3">Member</th>
                    <th className="py-2 pr-3">Package</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Binary Placement (Separate)</th>
                    <th className="py-2 pr-3">Joined (SGT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {directs.map((d) => (
                    <tr key={d.id}>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-[#F2F0EB]">{d.displayName}</div>
                        <div className="font-mono-sgt text-[11px] text-[#E7C98E]">
                          {d.memberCode}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 font-medium text-[#D6D3CC]">
                        {d.currentPackageCode ?? "—"}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            d.status === "ACTIVE"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-amber-500/15 text-amber-300"
                          }`}
                        >
                          {d.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-[#D6D3CC]">
                        {d.placementParent
                          ? `${d.placementParent.memberCode} · ${d.placementLeg}`
                          : "Unplaced"}
                      </td>
                      <td className="py-2.5 pr-3 font-mono-sgt text-[#9DA4B0]">
                        {formatSgtTimestamp(d.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
