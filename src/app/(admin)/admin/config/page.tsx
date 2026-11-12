import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getServerLocale } from "@/lib/i18n-server";
import { formatSgtTimestamp } from "@/lib/sgt";
import { getOrCreateConfigTx } from "@/lib/settlement/engine";
import { AdminConfigClient } from "@/components/admin/AdminConfigClient";

export const dynamic = "force-dynamic";

export default async function AdminConfigPage() {
  await requireAdmin();
  const locale = await getServerLocale();

  const [config, tiers, versions] = await Promise.all([
    getOrCreateConfigTx(prisma),
    prisma.packageTier.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.ruleVersionRecord.findMany({ orderBy: { version: "desc" }, take: 30 }),
  ]);

  return (
    <AdminConfigClient
      locale={locale}
      config={{
        ruleVersion: config.ruleVersion,
        tieBreakerRule: config.tieBreakerRule,
        headcountRule: config.headcountRule,
        upgradePriceMode: config.upgradePriceMode,
        upgradeGrantsBv: config.upgradeGrantsBv,
        upgradeTriggersDirectCommission: config.upgradeTriggersDirectCommission,
        upgradeEffectiveDaysOffset: config.upgradeEffectiveDaysOffset,
        upgradeEffectiveTimeSgt: config.upgradeEffectiveTimeSgt,
        directCommissionRateBps: config.directCommissionRateBps,
        pairingUnitBv: config.pairingUnitBv,
        pairingRewardPointsCents: config.pairingRewardPointsCents,
        withdrawalFeeRateBps: config.withdrawalFeeRateBps,
        withdrawalUsdRateMicros: config.withdrawalUsdRateMicros,
        isDemoRate: config.isDemoRate,
        productionPayoutEnabled: config.productionPayoutEnabled,
        usdtNetwork: config.usdtNetwork,
        usdtContractAddress: config.usdtContractAddress,
        usdtDepositAddress: config.usdtDepositAddress,
        usdtPayoutAddress: config.usdtPayoutAddress,
        usdtMinConfirmations: config.usdtMinConfirmations,
        usdtWithdrawalProcessingHours: config.usdtWithdrawalProcessingHours,
        usdtDepositsEnabled: config.usdtDepositsEnabled,
        usdtWithdrawalsEnabled: config.usdtWithdrawalsEnabled,
      }}
      tiers={tiers.map((t) => ({
        code: t.code,
        nameEn: t.nameEn,
        nameZh: t.nameZh,
        priceUsdCents: t.priceUsdCents,
        priceUsdtMicros: t.priceUsdtMicros.toString(),
        bv: t.bv,
        dailyCapPointsCents: t.dailyCapPointsCents,
      }))}
      versions={versions.map((v) => ({
        version: v.version,
        tieBreakerRule: v.tieBreakerRule,
        upgradePriceMode: v.upgradePriceMode,
        upgradeGrantsBv: v.upgradeGrantsBv,
        upgradeTriggersDirectCommission: v.upgradeTriggersDirectCommission,
        withdrawalUsdRateMicros: v.withdrawalUsdRateMicros,
        changeNote: v.changeNote,
        createdAtLabel: formatSgtTimestamp(v.createdAt),
      }))}
    />
  );
}
