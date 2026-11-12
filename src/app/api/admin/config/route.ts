import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiAdmin, jsonError } from "@/lib/api-auth";
import { serializeBigInt } from "@/lib/json-bigint";
import { getOrCreateConfigTx } from "@/lib/settlement/engine";
import { isValidUsdtAddressForNetwork } from "@/lib/usdt/address";

const schema = z.object({
  tieBreakerRule: z.enum(["KEEP_LEFT", "KEEP_RIGHT"]),
  upgradePriceMode: z.enum(["DIFFERENCE", "FULL"]),
  upgradeGrantsBv: z.boolean(),
  upgradeTriggersDirectCommission: z.boolean(),
  withdrawalUsdRateMicros: z.number().int().min(10000).max(100000000),
  isDemoRate: z.boolean(),
  productionPayoutEnabled: z.boolean(),
  usdtNetwork: z.string().max(40).optional(),
  usdtContractAddress: z.string().max(120).optional(),
  usdtDepositAddress: z.string().max(120).optional(),
  usdtPayoutAddress: z.string().max(120).optional(),
  usdtMinConfirmations: z.number().int().min(1).max(200).optional(),
  usdtWithdrawalProcessingHours: z.number().int().min(1).max(720).optional(),
  usdtDepositsEnabled: z.boolean().optional(),
  usdtWithdrawalsEnabled: z.boolean().optional(),
  tierUsdtPrices: z.record(z.string(), z.number().positive()).optional(),
  changeNote: z.string().max(200).optional(),
});

export async function PATCH(req: Request) {
  try {
    const admin = await getApiAdmin();
    if (!admin) return jsonError("Forbidden", 403);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid config input", 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const current = await getOrCreateConfigTx(tx);
      const nextVersion = current.ruleVersion + 1;
      const { changeNote, tierUsdtPrices, ...fields } = parsed.data;

      const network = (fields.usdtNetwork ?? current.usdtNetwork).trim();
      const contract = (fields.usdtContractAddress ?? current.usdtContractAddress).trim();
      const depAddr = (fields.usdtDepositAddress ?? current.usdtDepositAddress).trim();
      const payAddr = (fields.usdtPayoutAddress ?? current.usdtPayoutAddress).trim();

      if (network && contract && !isValidUsdtAddressForNetwork(network, contract)) {
        throw new Error(`Invalid USDT contract address for ${network}`);
      }
      if (network && depAddr && !isValidUsdtAddressForNetwork(network, depAddr)) {
        throw new Error(`Invalid company deposit address for ${network}`);
      }
      if (network && payAddr && !isValidUsdtAddressForNetwork(network, payAddr)) {
        throw new Error(`Invalid company payout address for ${network}`);
      }

      const cfg = await tx.systemConfig.update({
        where: { id: 1 },
        data: {
          ...fields,
          usdtNetwork: network,
          usdtContractAddress: contract,
          usdtDepositAddress: depAddr,
          usdtPayoutAddress: payAddr,
          ruleVersion: nextVersion,
        },
      });

      if (tierUsdtPrices) {
        for (const [code, wholeUsdt] of Object.entries(tierUsdtPrices)) {
          const micros = BigInt(Math.round(wholeUsdt * 1_000_000));
          await tx.packageTier.updateMany({
            where: { code },
            data: { priceUsdtMicros: micros },
          });
        }
      }

      await tx.ruleVersionRecord.create({
        data: {
          version: cfg.ruleVersion,
          tieBreakerRule: cfg.tieBreakerRule,
          headcountRule: cfg.headcountRule,
          upgradePriceMode: cfg.upgradePriceMode,
          upgradeGrantsBv: cfg.upgradeGrantsBv,
          upgradeTriggersDirectCommission: cfg.upgradeTriggersDirectCommission,
          upgradeEffectiveDaysOffset: cfg.upgradeEffectiveDaysOffset,
          upgradeEffectiveTimeSgt: cfg.upgradeEffectiveTimeSgt,
          directCommissionRateBps: cfg.directCommissionRateBps,
          pairingUnitBv: cfg.pairingUnitBv,
          pairingRewardPointsCents: cfg.pairingRewardPointsCents,
          withdrawalFeeRateBps: cfg.withdrawalFeeRateBps,
          withdrawalUsdRateMicros: cfg.withdrawalUsdRateMicros,
          isDemoRate: cfg.isDemoRate,
          productionPayoutEnabled: cfg.productionPayoutEnabled,
          usdtNetwork: cfg.usdtNetwork,
          usdtContractAddress: cfg.usdtContractAddress,
          usdtDepositAddress: cfg.usdtDepositAddress,
          usdtPayoutAddress: cfg.usdtPayoutAddress,
          usdtMinConfirmations: cfg.usdtMinConfirmations,
          usdtWithdrawalProcessingHours: cfg.usdtWithdrawalProcessingHours,
          usdtDepositsEnabled: cfg.usdtDepositsEnabled,
          usdtWithdrawalsEnabled: cfg.usdtWithdrawalsEnabled,
          changedById: admin.id,
          changeNote: changeNote?.trim() || "Admin rule & USDT configuration update",
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorRole: "ADMIN",
          action: "CONFIG_UPDATE",
          entityType: "SystemConfig",
          entityId: "1",
          summary: `Updated rules & USDT config to v${cfg.ruleVersion} (${cfg.usdtNetwork}, minConf=${cfg.usdtMinConfirmations}, sla=${cfg.usdtWithdrawalProcessingHours}h)`,
          metadata: {
            ruleVersion: cfg.ruleVersion,
            ...fields,
            usdtNetwork: cfg.usdtNetwork,
            usdtDepositAddress: cfg.usdtDepositAddress,
            usdtPayoutAddress: cfg.usdtPayoutAddress,
          },
        },
      });
      return cfg;
    });

    return NextResponse.json({ ok: true, config: serializeBigInt(updated) });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Config update failed", 400);
  }
}
