/**
 * Single source of truth for ROLL10 Package Configurations, Ratios, and Payment Rules.
 *
 * Rules:
 * 1. USDT: 1 U = 1 USDT.
 * 2. Register Point (RP): Fixed 50% of package amount. 1 RP = 1 U.
 * 3. Cash Point (CP): Optional 0%–50% of package amount. 1 CP = 1 U.
 * 4. 团队积分 (Team Points): Integer multiples of 100 only. (100 for P100, 500 for P500, 1000 for P1000).
 * 5. Direct Referral %: Depends on sponsor's active package: P100=25%, P500=30%, P1000=35%.
 * 6. Differential (极差): Along sponsor chain up to 35% max.
 * 7. Matching: 100 Left Points + 100 Right Points -> 10 CP.
 *    Daily matching cap: P100=100 CP/d, P500=500 CP/d, P1000=1000 CP/d.
 */

export interface PackageConfig {
  code: "P100" | "P500" | "P1000";
  tierName: "Silver" | "Gold" | "Diamond";
  nameZh: string;
  nameEn: string;
  priceU: number;
  teamPoints: number;
  directRateBps: number; // e.g. 2500 for 25%
  directRatePercent: number; // e.g. 25
  dailyCapCp: number; // e.g. 100
  sortOrder: number;
}

export const ROLL10_PACKAGES: Record<string, PackageConfig> = {
  P100: {
    code: "P100",
    tierName: "Silver",
    nameZh: "Silver (白银 100 U)",
    nameEn: "Silver 100 U",
    priceU: 100,
    teamPoints: 100,
    directRateBps: 2500,
    directRatePercent: 25,
    dailyCapCp: 100,
    sortOrder: 1,
  },
  P500: {
    code: "P500",
    tierName: "Gold",
    nameZh: "Gold (黄金 500 U)",
    nameEn: "Gold 500 U",
    priceU: 500,
    teamPoints: 500,
    directRateBps: 3000,
    directRatePercent: 30,
    dailyCapCp: 500,
    sortOrder: 2,
  },
  P1000: {
    code: "P1000",
    tierName: "Diamond",
    nameZh: "Diamond (钻石 1,000 U)",
    nameEn: "Diamond 1,000 U",
    priceU: 1000,
    teamPoints: 1000,
    directRateBps: 3500,
    directRatePercent: 35,
    dailyCapCp: 1000,
    sortOrder: 3,
  },
};

/**
 * Returns the standardized tier name: Silver, Gold, Diamond.
 */
export function getPackageTierName(code?: string | null): string {
  if (!code) return "Silver";
  const clean = code.toUpperCase();
  if (clean === "P1000" || clean === "DIAMOND") return "Diamond";
  if (clean === "P500" || clean === "GOLD") return "Gold";
  if (clean === "P100" || clean === "SILVER") return "Silver";
  return code;
}

/**
 * Returns the localized tier title: e.g. Silver (白银), Gold (黄金), Diamond (钻石).
 */
export function getPackageTierNameZh(code?: string | null): string {
  if (!code) return "Silver (白银)";
  const clean = code.toUpperCase();
  if (clean === "P1000" || clean === "DIAMOND") return "Diamond (钻石)";
  if (clean === "P500" || clean === "GOLD") return "Gold (黄金)";
  if (clean === "P100" || clean === "SILVER") return "Silver (白银)";
  return code;
}

/**
 * Returns full display label with U amount: e.g. "Diamond · 1,000 U"
 */
export function formatPackageFullLabel(code?: string | null, locale: string = "zh-CN"): string {
  const tier = getPackageTierName(code);
  const pkg =
    ROLL10_PACKAGES[code || ""] ||
    (tier === "Diamond"
      ? ROLL10_PACKAGES.P1000
      : tier === "Gold"
        ? ROLL10_PACKAGES.P500
        : ROLL10_PACKAGES.P100);
  if (locale === "zh-CN") {
    return `${tier} · ${pkg.priceU.toLocaleString()} U`;
  }
  return `${tier} (${pkg.priceU.toLocaleString()} U)`;
}

export const MAX_SPONSOR_RATE_BPS = 3500; // 35% max differential cap

/**
 * Calculates exact registration payment breakdown.
 * Formula:
 * - Total = A
 * - Fixed 50% RP: rpAmount = A * 0.5
 * - Optional CP: cpAmount in [0, A * 0.5]
 * - Remainder USDT: usdtAmount = A * 0.5 - cpAmount
 */
export function calculateRegistrationPayment(
  packageCode: string,
  requestedCpU: number
): {
  valid: boolean;
  error?: string;
  totalU: number;
  rpAmountU: number;
  cpAmountU: number;
  usdtAmountU: number;
  cpPercent: number;
  totalCents: number;
  rpCents: number;
  cpCents: number;
  usdtCents: number;
} {
  const pkg = ROLL10_PACKAGES[packageCode];
  if (!pkg) {
    return {
      valid: false,
      error: `Invalid package code ${packageCode}`,
      totalU: 0,
      rpAmountU: 0,
      cpAmountU: 0,
      usdtAmountU: 0,
      cpPercent: 0,
      totalCents: 0,
      rpCents: 0,
      cpCents: 0,
      usdtCents: 0,
    };
  }

  const totalU = pkg.priceU;
  const maxCpU = totalU * 0.5; // Max 50%
  const fixedRpU = totalU * 0.5; // Fixed 50%

  if (requestedCpU < 0) {
    return {
      valid: false,
      error: "CP amount cannot be negative",
      totalU,
      rpAmountU: fixedRpU,
      cpAmountU: 0,
      usdtAmountU: fixedRpU,
      cpPercent: 0,
      totalCents: totalU * 100,
      rpCents: fixedRpU * 100,
      cpCents: 0,
      usdtCents: fixedRpU * 100,
    };
  }

  if (requestedCpU > maxCpU) {
    return {
      valid: false,
      error: `CP amount cannot exceed 50% of package amount (${maxCpU} CP)`,
      totalU,
      rpAmountU: fixedRpU,
      cpAmountU: requestedCpU,
      usdtAmountU: 0,
      cpPercent: Math.round((requestedCpU / totalU) * 100),
      totalCents: totalU * 100,
      rpCents: fixedRpU * 100,
      cpCents: Math.round(requestedCpU * 100),
      usdtCents: 0,
    };
  }

  const cpAmountU = Math.round(requestedCpU * 100) / 100;
  const usdtAmountU = Math.round((fixedRpU - cpAmountU) * 100) / 100;
  const cpPercent = Math.round((cpAmountU / totalU) * 100);

  return {
    valid: true,
    totalU,
    rpAmountU: fixedRpU,
    cpAmountU,
    usdtAmountU,
    cpPercent,
    totalCents: totalU * 100,
    rpCents: fixedRpU * 100,
    cpCents: Math.round(cpAmountU * 100),
    usdtCents: Math.round(usdtAmountU * 100),
  };
}

/**
 * Formats CP (Cash Point) amount.
 */
export function formatCp(cpCents: number): string {
  const whole = Math.floor(cpCents / 100);
  const frac = cpCents % 100;
  const wholeStr = whole.toLocaleString("en-US");
  if (frac === 0) return `${wholeStr} CP`;
  return `${wholeStr}.${String(frac).padStart(2, "0")} CP`;
}

/**
 * Formats RP (Register Point) amount.
 */
export function formatRp(rpCents: number): string {
  const whole = Math.floor(rpCents / 100);
  const frac = rpCents % 100;
  const wholeStr = whole.toLocaleString("en-US");
  if (frac === 0) return `${wholeStr} RP`;
  return `${wholeStr}.${String(frac).padStart(2, "0")} RP`;
}

/**
 * Formats 团队积分 (Team Points). Always integer.
 */
export function formatTeamPoints(points: number): string {
  return `${Math.floor(points).toLocaleString("en-US")} 积分`;
}
