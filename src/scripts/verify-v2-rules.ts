import { ROLL10_PACKAGES, calculateRegistrationPayment } from "../lib/packages";
import { calculatePairingResult } from "../lib/money";
import { decideEodCarryover } from "../lib/settlement/engine";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

console.log("=== ROLL10 V2 Business Rules Actuarial Verification ===");

// 1. Packages & Rates
console.log("\n1. Package Tiers & Rates:");
assert(ROLL10_PACKAGES.P100.priceU === 100, "P100 is 100 U");
assert(ROLL10_PACKAGES.P100.teamPoints === 100, "P100 is 100 team points");
assert(ROLL10_PACKAGES.P100.directRatePercent === 25, "P100 sponsor direct rate is 25%");
assert(ROLL10_PACKAGES.P100.dailyCapCp === 100, "P100 daily matching cap is 100 CP");

assert(ROLL10_PACKAGES.P500.priceU === 500, "P500 is 500 U");
assert(ROLL10_PACKAGES.P500.teamPoints === 500, "P500 is 500 team points");
assert(ROLL10_PACKAGES.P500.directRatePercent === 30, "P500 sponsor direct rate is 30%");
assert(ROLL10_PACKAGES.P500.dailyCapCp === 500, "P500 daily matching cap is 500 CP");

assert(ROLL10_PACKAGES.P1000.priceU === 1000, "P1000 is 1,000 U");
assert(ROLL10_PACKAGES.P1000.teamPoints === 1000, "P1000 is 1,000 team points");
assert(ROLL10_PACKAGES.P1000.directRatePercent === 35, "P1000 sponsor direct rate is 35%");
assert(ROLL10_PACKAGES.P1000.dailyCapCp === 1000, "P1000 daily matching cap is 1,000 CP");

// 2. Registration Payment Formula: Fixed 50% RP + 0-50% CP + remainder USDT
console.log("\n2. Registration Payment Formula (1,000 U Package):");

// Case A: 0% CP -> 500 RP + 0 CP + 500 USDT
const payA = calculateRegistrationPayment("P1000", 0);
assert(payA.valid === true, "0% CP is valid");
assert(payA.rpAmountU === 500, "RP is 500 RP (50%)");
assert(payA.cpAmountU === 0, "CP is 0 CP");
assert(payA.usdtAmountU === 500, "USDT is 500 USDT (50%)");
assert(payA.rpAmountU + payA.cpAmountU + payA.usdtAmountU === 1000, "Total equals 1,000 U");

// Case B: 20% CP -> 500 RP + 200 CP + 300 USDT
const payB = calculateRegistrationPayment("P1000", 200);
assert(payB.valid === true, "20% CP is valid");
assert(payB.rpAmountU === 500, "RP is 500 RP (50%)");
assert(payB.cpAmountU === 200, "CP is 200 CP (20%)");
assert(payB.usdtAmountU === 300, "USDT is 300 USDT (30%)");
assert(payB.rpAmountU + payB.cpAmountU + payB.usdtAmountU === 1000, "Total equals 1,000 U");

// Case C: 50% CP -> 500 RP + 500 CP + 0 USDT (100% paid by RP+CP, no USDT needed!)
const payC = calculateRegistrationPayment("P1000", 500);
assert(payC.valid === true, "50% CP is valid");
assert(payC.rpAmountU === 500, "RP is 500 RP (50%)");
assert(payC.cpAmountU === 500, "CP is 500 CP (50%)");
assert(payC.usdtAmountU === 0, "USDT is 0 USDT");
assert(payC.rpAmountU + payC.cpAmountU + payC.usdtAmountU === 1000, "Total equals 1,000 U");

// Case D: 501 CP -> Invalid (exceeds 50% limit)
const payD = calculateRegistrationPayment("P1000", 501);
assert(payD.valid === false, "501 CP is correctly rejected as exceeding 50% limit");

// Case E: -10 CP -> Invalid (negative)
const payE = calculateRegistrationPayment("P1000", -10);
assert(payE.valid === false, "-10 CP is correctly rejected as negative");

// 3. Differential Rewards (极差奖励) Chain Traversal
console.log("\n3. Differential Reward Chains (1,000 U package):");

function simulateDifferential(sponsorTiers: Array<"P100" | "P500" | "P1000">, packageAmountU: number) {
  let allocatedRateBps = 0;
  const allocations: Array<{ tier: string; role: "DIRECT" | "DIFF"; rateBps: number; cp: number }> = [];

  for (let i = 0; i < sponsorTiers.length; i++) {
    if (allocatedRateBps >= 3500) break;
    const tier = sponsorTiers[i];
    const rateBps = ROLL10_PACKAGES[tier].directRateBps;

    if (i === 0) {
      // Direct sponsor
      const cp = (packageAmountU * rateBps) / 10000;
      allocations.push({ tier, role: "DIRECT", rateBps, cp });
      allocatedRateBps = rateBps;
    } else {
      // Ancestor differential
      if (rateBps > allocatedRateBps) {
        const diffRateBps = rateBps - allocatedRateBps;
        const cp = (packageAmountU * diffRateBps) / 10000;
        allocations.push({ tier, role: "DIFF", rateBps: diffRateBps, cp });
        allocatedRateBps = rateBps;
      }
    }
  }

  const totalCp = allocations.reduce((sum, a) => sum + a.cp, 0);
  return { allocations, totalCp, allocatedRateBps };
}

// Case 1: P100 -> P500 -> P1000
const c1 = simulateDifferential(["P100", "P500", "P1000"], 1000);
assert(c1.allocations[0].cp === 250, "P100 direct gets 250 CP (25%)");
assert(c1.allocations[1].cp === 50, "P500 diff gets 50 CP (30% - 25% = 5%)");
assert(c1.allocations[2].cp === 50, "P1000 diff gets 50 CP (35% - 30% = 5%)");
assert(c1.totalCp === 350, "Total payout is 350 CP (35%)");

// Case 2: P100 -> P1000
const c2 = simulateDifferential(["P100", "P1000"], 1000);
assert(c2.allocations[0].cp === 250, "P100 direct gets 250 CP (25%)");
assert(c2.allocations[1].cp === 100, "P1000 diff gets 100 CP (35% - 25% = 10%)");
assert(c2.totalCp === 350, "Total payout is 350 CP (35%)");

// Case 3: P500 -> P1000
const c3 = simulateDifferential(["P500", "P1000"], 1000);
assert(c3.allocations[0].cp === 300, "P500 direct gets 300 CP (30%)");
assert(c3.allocations[1].cp === 50, "P1000 diff gets 50 CP (35% - 30% = 5%)");
assert(c3.totalCp === 350, "Total payout is 350 CP (35%)");

// Case 4: P100 -> P100 -> P1000
const c4 = simulateDifferential(["P100", "P100", "P1000"], 1000);
assert(c4.allocations.length === 2, "Middle P100 gets 0 CP because same rate (25% not > 25%)");
assert(c4.allocations[0].cp === 250, "First P100 direct gets 250 CP");
assert(c4.allocations[1].cp === 100, "Third P1000 diff gets 100 CP (35% - 25% = 10%)");
assert(c4.totalCp === 350, "Total payout is 350 CP (35%)");

// Case 5: P1000 -> P1000
const c5 = simulateDifferential(["P1000", "P1000"], 1000);
assert(c5.allocations.length === 1, "First P1000 hits 35% cap; upper P1000 gets 0 CP");
assert(c5.allocations[0].cp === 350, "P1000 direct gets 350 CP (35%)");
assert(c5.totalCp === 350, "Total payout is 350 CP (35%)");

// 4. Binary Pairing with Daily Cap & Deduction Precision
console.log("\n4. Dual-Turbo Binary Pairing & Daily Cap:");
// Test: Left 600, Right 400 with remaining cap of 10 CP (1000 cents)
// 100 Left + 100 Right -> 10 CP
const pairResult = calculatePairingResult({
  leftBv: 600,
  rightBv: 400,
  dailyCapPointsCents: 10000,
  todayPairedPointsCents: 9000, // Remaining cap = 1000 cents = 10 CP (1 pair)
  pairingUnitBv: 100,
  pairingRewardPointsCents: 1000,
});
assert(pairResult.pairsCount === 1, "Matches exactly 1 pair due to remaining cap 10 CP");
assert(pairResult.pointsAwardedCents === 1000, "Awards 10 CP (1000 cents)");
assert(pairResult.bvDeductedPerLeg === 100, "Deducts ONLY 100 points per leg for the paid pair");
assert(pairResult.leftBvAfter === 500, "Remaining Left is 500 points (600 - 100)");
assert(pairResult.rightBvAfter === 300, "Remaining Right is 300 points (400 - 100)");

// 5. Daily EOD Rollover (Singapore Time 00:00 SGT)
console.log("\n5. Daily Rollover Retention:");
const eod = decideEodCarryover(500, 300, 10, 5, "KEEP_LEFT");
assert(eod.leftBvAfter === 500, "Left leg 500 points 100% retained past midnight");
assert(eod.rightBvAfter === 300, "Right leg 300 points 100% retained past midnight");
assert(eod.flushedBv === 0, "Zero points flushed or cleared at midnight");
assert(eod.decisionBasis === "ROLLOVER_FULL_POINTS_RETAINED", "Decision basis is full points retained");

console.log("\n========================================================");
console.log(">>> ALL ACTUARIAL & SYSTEM RULES VERIFIED 100% PASS <<<");
console.log("========================================================");
