/**
 * Exact integer smallest-unit calculations for BV, U / USDT (1 U = 1 BV, cents = 0.01 U,
 * micros = 0.000001 USDT). Never uses floating-point arithmetic for ledger math.
 */

export function formatU(uCents: number): string {
  const sign = uCents < 0 ? "-" : "";
  const abs = Math.abs(uCents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const wholeStr = whole.toLocaleString("en-US");
  if (frac === 0) {
    return `${sign}${wholeStr}`;
  }
  return `${sign}${wholeStr}.${String(frac).padStart(2, "0")}`;
}

export function formatUFixed2(uCents: number): string {
  return formatU(uCents);
}

export function formatPoints(pointsCents: number): string {
  return formatU(pointsCents);
}

export function formatUsd(usdCents: number): string {
  const sign = usdCents < 0 ? "-" : "";
  const abs = Math.abs(usdCents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const wholeStr = whole.toLocaleString("en-US");
  if (frac === 0) {
    return `${sign}US$${wholeStr}`;
  }
  return `${sign}US$${wholeStr}.${String(frac).padStart(2, "0")}`;
}

export function formatUsdtMicros(
  microsInput: bigint | number | string,
  unit: string = "USDT"
): string {
  const micros =
    typeof microsInput === "bigint" ? microsInput : BigInt(String(microsInput));
  const sign = micros < 0n ? "-" : "";
  const abs = micros < 0n ? -micros : micros;
  const whole = abs / 1_000_000n;
  const frac = abs % 1_000_000n;
  const wholeStr = Number(whole).toLocaleString("en-US");
  if (frac === 0n) {
    return unit ? `${sign}${wholeStr} ${unit}` : `${sign}${wholeStr}`;
  }
  const fracTrimmed = String(frac).padStart(6, "0").replace(/0+$/, "");
  const fracPadded = fracTrimmed.length === 1 ? `${fracTrimmed}0` : fracTrimmed;
  return unit
    ? `${sign}${wholeStr}.${fracPadded} ${unit}`
    : `${sign}${wholeStr}.${fracPadded}`;
}

export function pointsCentsToUsdtMicros(
  pointsCents: number,
  usdRateMicros: number
): bigint {
  if (pointsCents <= 0 || usdRateMicros <= 0) return 0n;
  return (BigInt(pointsCents) * BigInt(usdRateMicros) + 50n) / 100n;
}

export function usdCentsToUsdtMicros(usdCents: number): bigint {
  if (usdCents <= 0) return 0n;
  return BigInt(usdCents) * 10_000n;
}

/**
 * Formats USDT micro-units cleanly without trailing ".00" for whole numbers (e.g. "150 U").
 */
export function formatUsdtFixed2(
  microsInput: bigint | number | string,
  unit: string = "U"
): string {
  return formatUsdtMicros(microsInput, unit);
}

/**
 * Computes direct referral reward in USDT micro-units (1 USDT = 1,000,000 micros).
 */
export function calculateDirectRewardUsdtMicros(
  commissionableBv: number,
  rateBps: number,
  conversionMicros: number = 1_000_000
): bigint {
  if (commissionableBv <= 0 || rateBps <= 0 || conversionMicros <= 0) return 0n;
  return (
    (BigInt(commissionableBv) * BigInt(rateBps) * BigInt(conversionMicros)) /
    10_000n
  );
}

export function formatBv(bv: number): string {
  return `${bv.toLocaleString("en-US")} BV`;
}

export function formatRateMicros(rateMicros: number): string {
  const whole = Math.floor(rateMicros / 1_000_000);
  const frac = rateMicros % 1_000_000;
  if (frac === 0) {
    return `${whole}`;
  }
  const trimmed = String(frac).padStart(6, "0").replace(/0+$/, "");
  return `${whole}.${trimmed}`;
}

export function calculateDirectCommissionCents(
  commissionableBv: number,
  rateBps: number
): number {
  if (commissionableBv <= 0 || rateBps <= 0) return 0;
  // 1 BV * 100 = 100 pointsCents at 100% rate
  return Number((BigInt(commissionableBv) * BigInt(rateBps) * 100n) / 10000n);
}

export function calculateWithdrawalQuote(
  requestedPointsCents: number,
  feeRateBps: number,
  usdRateMicros: number
): {
  requestedPointsCents: number;
  feePointsCents: number;
  netPointsCents: number;
  estimatedUsdCents: number;
} {
  if (requestedPointsCents <= 0) {
    return {
      requestedPointsCents: 0,
      feePointsCents: 0,
      netPointsCents: 0,
      estimatedUsdCents: 0,
    };
  }
  const req = BigInt(requestedPointsCents);
  const fee = (req * BigInt(feeRateBps) + 5000n) / 10000n;
  const net = req - fee;
  const usd = (net * BigInt(usdRateMicros) + 500000n) / 1_000_000n;
  return {
    requestedPointsCents,
    feePointsCents: Number(fee),
    netPointsCents: Number(net),
    estimatedUsdCents: Number(usd),
  };
}

export function calculatePairingResult(params: {
  leftBv: number;
  rightBv: number;
  dailyCapPointsCents: number;
  todayPairedPointsCents: number;
  pairingUnitBv: number;
  pairingRewardPointsCents: number;
}): {
  pairsCount: number;
  bvDeductedPerLeg: number;
  pointsAwardedCents: number;
  leftBvAfter: number;
  rightBvAfter: number;
  dailyPairedAfterCents: number;
} {
  const {
    leftBv,
    rightBv,
    dailyCapPointsCents,
    todayPairedPointsCents,
    pairingUnitBv,
    pairingRewardPointsCents,
  } = params;

  const leftUnits = Math.floor(leftBv / pairingUnitBv);
  const rightUnits = Math.floor(rightBv / pairingUnitBv);
  const remainingCapCents = Math.max(0, dailyCapPointsCents - todayPairedPointsCents);
  const capUnits = Math.floor(remainingCapCents / pairingRewardPointsCents);

  const pairsCount = Math.max(0, Math.min(leftUnits, rightUnits, capUnits));
  const bvDeductedPerLeg = pairsCount * pairingUnitBv;
  const pointsAwardedCents = pairsCount * pairingRewardPointsCents;

  return {
    pairsCount,
    bvDeductedPerLeg,
    pointsAwardedCents,
    leftBvAfter: leftBv - bvDeductedPerLeg,
    rightBvAfter: rightBv - bvDeductedPerLeg,
    dailyPairedAfterCents: todayPairedPointsCents + pointsAwardedCents,
  };
}
