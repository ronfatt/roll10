import { describe, expect, it } from "vitest";
import { runComprehensive50MemberSimulation } from "../../../scripts/simulate-50-members";

describe("ROLL10 50-Member Actuarial & Programmatic Settlement Test", () => {
  it("successfully passes all 10 invariant assertions across 50 members", () => {
    const result = runComprehensive50MemberSimulation();

    expect(result.success).toBe(true);
    expect(result.memberCount).toBe(50);

    // Revenue & Payout bounds
    expect(result.totalSystemRevenueU).toBe(27300);
    expect(result.totalDirectBonusU).toBe(6575);
    expect(result.totalPairingBonusU).toBe(3240);
    expect(result.totalPayoutU).toBe(9815);

    // Solvency bounds: payout ratio must be healthy (between 30% and 50%)
    expect(result.payoutRatio).toBeGreaterThan(30);
    expect(result.payoutRatio).toBeLessThan(50);

    // Platform surplus must be positive and healthy (> 50%)
    expect(result.platformReserveU).toBe(17485);
    expect(result.reserveRatio).toBeGreaterThan(50);
  });
});
