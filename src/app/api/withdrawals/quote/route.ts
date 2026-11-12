import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiMember, jsonError } from "@/lib/api-auth";
import { calculateWithdrawalQuote, pointsCentsToUsdtMicros } from "@/lib/money";
import { formatSgtTimestamp } from "@/lib/sgt";
import { getOrCreateConfigTx } from "@/lib/settlement/engine";
import { isUsdtWithdrawalConfigured } from "@/lib/usdt/address";

export async function GET(req: Request) {
  const member = await getApiMember();
  if (!member) return jsonError("Unauthorized", 401);

  const config = await getOrCreateConfigTx(prisma);
  const serviceAvailable = isUsdtWithdrawalConfigured(config);
  const deadline = new Date(
    Date.now() + config.usdtWithdrawalProcessingHours * 3600_000
  );

  const url = new URL(req.url);
  const rawPoints = Number(url.searchParams.get("points") ?? "0");
  if (!Number.isFinite(rawPoints) || rawPoints <= 0) {
    return NextResponse.json({
      ok: true,
      quote: {
        requestedPointsCents: 0,
        feePointsCents: 0,
        netPointsCents: 0,
        estimatedUsdCents: 0,
        payoutAmountUsdtMicros: "0",
        feeRateBps: config.withdrawalFeeRateBps,
        usdRateMicros: config.withdrawalUsdRateMicros,
        isDemoRate: config.isDemoRate,
        usdtNetwork: config.usdtNetwork,
        processingHours: config.usdtWithdrawalProcessingHours,
        processingDeadlineLabel: formatSgtTimestamp(deadline),
        serviceAvailable,
      },
    });
  }

  const requestedPointsCents = Math.round(rawPoints * 100);
  const quote = calculateWithdrawalQuote(
    requestedPointsCents,
    config.withdrawalFeeRateBps,
    config.withdrawalUsdRateMicros
  );
  const payoutAmountUsdtMicros = pointsCentsToUsdtMicros(
    quote.netPointsCents,
    config.withdrawalUsdRateMicros
  );

  return NextResponse.json({
    ok: true,
    quote: {
      ...quote,
      payoutAmountUsdtMicros: payoutAmountUsdtMicros.toString(),
      feeRateBps: config.withdrawalFeeRateBps,
      usdRateMicros: config.withdrawalUsdRateMicros,
      isDemoRate: config.isDemoRate,
      usdtNetwork: config.usdtNetwork,
      processingHours: config.usdtWithdrawalProcessingHours,
      processingDeadlineLabel: formatSgtTimestamp(deadline),
      serviceAvailable,
    },
  });
}
