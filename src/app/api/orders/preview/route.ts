import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiMember, jsonError } from "@/lib/api-auth";
import { calculatePairingResult } from "@/lib/money";
import { formatSgtNaturalSchedule, formatSgtTimestamp, getUpgradeEffectiveScheduleSgt } from "@/lib/sgt";
import { getOrCreateConfigTx } from "@/lib/settlement/engine";

export async function GET(req: Request) {
  const member = await getApiMember();
  if (!member) return jsonError("Unauthorized", 401);

  const url = new URL(req.url);
  const targetCode = url.searchParams.get("target")?.trim().toUpperCase();
  const locale = url.searchParams.get("locale") === "zh-CN" ? "zh-CN" : "en";
  if (!targetCode) return jsonError("Missing target package code", 400);

  const [config, targetPkg, currentPkg] = await Promise.all([
    getOrCreateConfigTx(prisma),
    prisma.packageTier.findUnique({ where: { code: targetCode } }),
    member.currentPackageCode
      ? prisma.packageTier.findUnique({ where: { code: member.currentPackageCode } })
      : Promise.resolve(null),
  ]);

  if (!targetPkg || !targetPkg.isActive) {
    return jsonError("Target package not found", 404);
  }

  const now = new Date();
  const schedule = getUpgradeEffectiveScheduleSgt(
    now,
    config.upgradeEffectiveDaysOffset,
    config.upgradeEffectiveTimeSgt
  );

  const payableUsdCents =
    currentPkg && config.upgradePriceMode === "DIFFERENCE"
      ? Math.max(0, targetPkg.priceUsdCents - currentPkg.priceUsdCents)
      : targetPkg.priceUsdCents;

  const estimatedCatchup = calculatePairingResult({
    leftBv: member.leftBv,
    rightBv: member.rightBv,
    dailyCapPointsCents: targetPkg.dailyCapPointsCents,
    todayPairedPointsCents: 0,
    pairingUnitBv: config.pairingUnitBv,
    pairingRewardPointsCents: config.pairingRewardPointsCents,
  });

  return NextResponse.json({
    ok: true,
    preview: {
      currentPackageCode: member.currentPackageCode,
      targetPackageCode: targetPkg.code,
      payableUsdCents,
      upgradePriceMode: config.upgradePriceMode,
      upgradeGrantsBv: config.upgradeGrantsBv,
      confirmedAtPreviewLabel: formatSgtTimestamp(now),
      effectiveAtLabel: schedule.effectiveSgtLabel,
      naturalSchedule: formatSgtNaturalSchedule(now, schedule.effectiveAt, locale),
      estimatedCatchupPairs: estimatedCatchup.pairsCount,
      estimatedCatchupPointsCents: estimatedCatchup.pointsAwardedCents,
    },
  });
}
