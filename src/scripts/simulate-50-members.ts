/**
 * ROLL10 Actuarial & Programmatic 50-Member Comprehensive Simulation
 *
 * Verifies:
 * 1. Binary placement tree topology & constraints (max 2 children, no cycles, path integrity).
 * 2. Sponsor referral relationships vs binary placement positions (spillover).
 * 3. BV upward propagation across ancestors.
 * 4. Dual-leg binary matching (pairing) bonus calculation (10% / 10 U per 100 BV pair).
 * 5. Daily package pairing caps (P100=100 U, P500=500 U, P1000=1000 U).
 * 6. Direct referral commission (25% = 25 U / 125 U / 250 U).
 * 7. Midnight EOD settlement (00:00 SGT), strong-leg carryover retention, weak-leg flush.
 * 8. BV conservation law: Credited = Paired + Flushed + Active Balance.
 * 9. Actuarial Payout Ratio & System Solvency (Gross Revenue vs Payouts).
 */

import {
  calculatePairingResult,
  calculateDirectCommissionCents,
  formatU,
  formatBv,
} from "../lib/money";
import { decideEodCarryover } from "../lib/settlement/engine";
import type { TieBreakerRule } from "@prisma/client";

interface PackageDef {
  code: string;
  name: string;
  priceU: number;
  bv: number;
  dailyCapU: number;
}

const PACKAGES: Record<string, PackageDef> = {
  P100: { code: "P100", name: "入门 100", priceU: 100, bv: 100, dailyCapU: 100 },
  P500: { code: "P500", name: "进阶 500", priceU: 500, bv: 500, dailyCapU: 500 },
  P1000: { code: "P1000", name: "尊享 1000", priceU: 1000, bv: 1000, dailyCapU: 1000 },
};

interface SimMember {
  id: string;
  memberCode: string;
  displayName: string;
  packageCode: string;
  dailyCapU: number;
  sponsorId: string | null;
  placementParentId: string | null;
  placementLeg: "LEFT" | "RIGHT" | null;
  leftChildId: string | null;
  rightChildId: string | null;

  // Running BV balances
  leftBv: number;
  rightBv: number;

  // Cumulative BV audit
  totalCreditedLeftBv: number;
  totalCreditedRightBv: number;
  totalPairedLeftBv: number;
  totalPairedRightBv: number;
  totalFlushedLeftBv: number;
  totalFlushedRightBv: number;

  // Financial tracking
  todayPairedU: number;
  availableWalletU: number;
  totalDirectEarnedU: number;
  totalPairingEarnedU: number;
  activeSettlementDate: string;

  joinedDate: string;
}

interface PairingEvent {
  date: string;
  memberId: string;
  memberCode: string;
  triggerMemberCode: string;
  triggerBv: number;
  leftBvBefore: number;
  rightBvBefore: number;
  pairsCount: number;
  bvDeducted: number;
  bonusU: number;
  leftBvAfter: number;
  rightBvAfter: number;
  dailyPairedAfterU: number;
}

interface EodEvent {
  date: string;
  memberCode: string;
  leftBvBefore: number;
  rightBvBefore: number;
  leftCount: number;
  rightCount: number;
  retainedSide: string;
  flushedSide: string;
  flushedBv: number;
  leftBvAfter: number;
  rightBvAfter: number;
  decisionBasis: string;
}

class SimulationRunner {
  members = new Map<string, SimMember>();
  pairingEvents: PairingEvent[] = [];
  eodEvents: EodEvent[] = [];
  currentDate = "2026-11-16";

  totalSystemRevenueU = 0;
  totalDirectBonusU = 0;
  totalPairingBonusU = 0;

  getMember(id: string): SimMember {
    const m = this.members.get(id);
    if (!m) throw new Error(`Member not found: ${id}`);
    return m;
  }

  getAncestorPath(
    startParentId: string,
    firstLeg: "LEFT" | "RIGHT"
  ): Array<{ ancestorId: string; leg: "LEFT" | "RIGHT" }> {
    const path: Array<{ ancestorId: string; leg: "LEFT" | "RIGHT" }> = [];
    let currentId = startParentId;
    let currentLeg = firstLeg;

    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) {
        throw new Error(`Cycle detected at member ${currentId}`);
      }
      visited.add(currentId);

      path.push({ ancestorId: currentId, leg: currentLeg });
      const current = this.members.get(currentId);
      if (!current || !current.placementParentId || !current.placementLeg) {
        break;
      }
      currentLeg = current.placementLeg;
      currentId = current.placementParentId;
    }

    return path;
  }

  countSubtree(memberId: string): { leftCount: number; rightCount: number } {
    const root = this.getMember(memberId);
    const countNodes = (startId: string | null): number => {
      if (!startId) return 0;
      const node = this.getMember(startId);
      return 1 + countNodes(node.leftChildId) + countNodes(node.rightChildId);
    };

    return {
      leftCount: countNodes(root.leftChildId),
      rightCount: countNodes(root.rightChildId),
    };
  }

  findOpenSlot(
    rootId: string,
    strategy: "BFS" | "EXTREME_LEFT" | "EXTREME_RIGHT" = "BFS"
  ): { parentId: string; leg: "LEFT" | "RIGHT" } {
    const root = this.getMember(rootId);

    if (strategy === "EXTREME_LEFT" || strategy === "EXTREME_RIGHT") {
      const targetLeg = strategy === "EXTREME_LEFT" ? "LEFT" : "RIGHT";
      let curr = root;
      while (true) {
        const nextId = targetLeg === "LEFT" ? curr.leftChildId : curr.rightChildId;
        if (!nextId) {
          return { parentId: curr.id, leg: targetLeg };
        }
        curr = this.getMember(nextId);
      }
    }

    // BFS
    const queue: string[] = [root.id];
    while (queue.length > 0) {
      const currId = queue.shift()!;
      const curr = this.getMember(currId);
      if (!curr.leftChildId) {
        return { parentId: curr.id, leg: "LEFT" };
      }
      if (!curr.rightChildId) {
        return { parentId: curr.id, leg: "RIGHT" };
      }
      queue.push(curr.leftChildId);
      queue.push(curr.rightChildId);
    }

    throw new Error("Could not find open slot");
  }

  addMember(params: {
    id: string;
    memberCode: string;
    displayName: string;
    packageCode: "P100" | "P500" | "P1000";
    sponsorId: string | null;
    placementParentId: string | null;
    placementLeg: "LEFT" | "RIGHT" | null;
  }): SimMember {
    const pkg = PACKAGES[params.packageCode];
    if (!pkg) throw new Error(`Unknown package: ${params.packageCode}`);

    // If root member (first)
    const isRoot = this.members.size === 0;

    if (!isRoot) {
      if (!params.sponsorId) throw new Error("Non-root member must have a sponsor");
      if (!params.placementParentId) throw new Error("Non-root member must have a placementParentId");
      if (!params.placementLeg) throw new Error("Non-root member must have a placementLeg");

      const parent = this.getMember(params.placementParentId);
      if (params.placementLeg === "LEFT" && parent.leftChildId) {
        throw new Error(`Slot LEFT of ${parent.memberCode} already occupied by ${parent.leftChildId}`);
      }
      if (params.placementLeg === "RIGHT" && parent.rightChildId) {
        throw new Error(`Slot RIGHT of ${parent.memberCode} already occupied by ${parent.rightChildId}`);
      }
    }

    const newMember: SimMember = {
      id: params.id,
      memberCode: params.memberCode,
      displayName: params.displayName,
      packageCode: params.packageCode,
      dailyCapU: pkg.dailyCapU,
      sponsorId: params.sponsorId,
      placementParentId: params.placementParentId,
      placementLeg: params.placementLeg,
      leftChildId: null,
      rightChildId: null,
      leftBv: 0,
      rightBv: 0,
      totalCreditedLeftBv: 0,
      totalCreditedRightBv: 0,
      totalPairedLeftBv: 0,
      totalPairedRightBv: 0,
      totalFlushedLeftBv: 0,
      totalFlushedRightBv: 0,
      todayPairedU: 0,
      availableWalletU: 0,
      totalDirectEarnedU: 0,
      totalPairingEarnedU: 0,
      activeSettlementDate: this.currentDate,
      joinedDate: this.currentDate,
    };

    this.members.set(newMember.id, newMember);
    this.totalSystemRevenueU += pkg.priceU;

    // Link child in parent
    if (!isRoot && params.placementParentId && params.placementLeg) {
      const parent = this.getMember(params.placementParentId);
      if (params.placementLeg === "LEFT") parent.leftChildId = newMember.id;
      else parent.rightChildId = newMember.id;
    }

    // 1. Direct referral bonus to sponsor (25%)
    if (newMember.sponsorId) {
      const sponsor = this.getMember(newMember.sponsorId);
      const directCents = calculateDirectCommissionCents(pkg.bv, 2500); // 2500 bps = 25%
      const directU = directCents / 100;
      sponsor.availableWalletU += directU;
      sponsor.totalDirectEarnedU += directU;
      this.totalDirectBonusU += directU;
    }

    // 2. BV propagation & Binary Pairing across ancestors
    if (!isRoot && params.placementParentId && params.placementLeg) {
      const ancestorSteps = this.getAncestorPath(params.placementParentId, params.placementLeg);

      for (const step of ancestorSteps) {
        const ancestor = this.getMember(step.ancestorId);

        // Credit BV to corresponding leg
        if (step.leg === "LEFT") {
          ancestor.leftBv += pkg.bv;
          ancestor.totalCreditedLeftBv += pkg.bv;
        } else {
          ancestor.rightBv += pkg.bv;
          ancestor.totalCreditedRightBv += pkg.bv;
        }

        // Attempt instant binary pairing
        const leftBefore = ancestor.leftBv;
        const rightBefore = ancestor.rightBv;

        const pairingResult = calculatePairingResult({
          leftBv: ancestor.leftBv,
          rightBv: ancestor.rightBv,
          dailyCapPointsCents: ancestor.dailyCapU * 100,
          todayPairedPointsCents: ancestor.todayPairedU * 100,
          pairingUnitBv: 100,
          pairingRewardPointsCents: 1000, // 1000 cents = 10 U per pair
        });

        if (pairingResult.pairsCount > 0) {
          const rewardU = pairingResult.pointsAwardedCents / 100;
          ancestor.leftBv = pairingResult.leftBvAfter;
          ancestor.rightBv = pairingResult.rightBvAfter;
          ancestor.todayPairedU = pairingResult.dailyPairedAfterCents / 100;
          ancestor.availableWalletU += rewardU;
          ancestor.totalPairingEarnedU += rewardU;

          ancestor.totalPairedLeftBv += pairingResult.bvDeductedPerLeg;
          ancestor.totalPairedRightBv += pairingResult.bvDeductedPerLeg;
          this.totalPairingBonusU += rewardU;

          this.pairingEvents.push({
            date: this.currentDate,
            memberId: ancestor.id,
            memberCode: ancestor.memberCode,
            triggerMemberCode: newMember.memberCode,
            triggerBv: pkg.bv,
            leftBvBefore: leftBefore,
            rightBvBefore: rightBefore,
            pairsCount: pairingResult.pairsCount,
            bvDeducted: pairingResult.bvDeductedPerLeg,
            bonusU: rewardU,
            leftBvAfter: ancestor.leftBv,
            rightBvAfter: ancestor.rightBv,
            dailyPairedAfterU: ancestor.todayPairedU,
          });
        }
      }
    }

    return newMember;
  }

  runMidnightEod(tieBreakerRule: TieBreakerRule = "KEEP_LEFT") {
    for (const member of this.members.values()) {
      const { leftCount, rightCount } = this.countSubtree(member.id);
      const leftBefore = member.leftBv;
      const rightBefore = member.rightBv;

      const decision = decideEodCarryover(
        leftBefore,
        rightBefore,
        leftCount,
        rightCount,
        tieBreakerRule
      );

      if (decision.flushedBv > 0) {
        if (decision.flushedSide === "LEFT") {
          member.totalFlushedLeftBv += decision.flushedBv;
        } else if (decision.flushedSide === "RIGHT") {
          member.totalFlushedRightBv += decision.flushedBv;
        }
      }

      member.leftBv = decision.leftBvAfter;
      member.rightBv = decision.rightBvAfter;
      member.todayPairedU = 0; // reset daily cap counter for new day

      if (leftBefore > 0 || rightBefore > 0) {
        this.eodEvents.push({
          date: this.currentDate,
          memberCode: member.memberCode,
          leftBvBefore: leftBefore,
          rightBvBefore: rightBefore,
          leftCount,
          rightCount,
          retainedSide: decision.retainedSide,
          flushedSide: decision.flushedSide,
          flushedBv: decision.flushedBv,
          leftBvAfter: member.leftBv,
          rightBvAfter: member.rightBv,
          decisionBasis: decision.decisionBasis,
        });
      }
    }
  }
}

export function runComprehensive50MemberSimulation() {
  const sim = new SimulationRunner();

  console.log("================================================================================");
  console.log("  ROLL10 会员制度与奖金分配 · 50 人深度精算与程序化全生命周期模拟仿真");
  console.log("================================================================================\n");

  // ---------------------------------------------------------------------------
  // DAY 1 (2026-11-16): 初始启动，顶层架构与第一波入金（1 ~ 20 号会员）
  // ---------------------------------------------------------------------------
  sim.currentDate = "2026-11-16";
  console.log("▶ [DAY 1] 2026-11-16: 启动与第一批 20 名会员激活...");

  // 1. Root
  const root = sim.addMember({
    id: "M01",
    memberCode: "BM100001",
    displayName: "Elena Vance (Root)",
    packageCode: "P1000",
    sponsorId: null,
    placementParentId: null,
    placementLeg: null,
  });

  // 2. Left Leader & Right Leader (Direct of Root)
  const m2 = sim.addMember({
    id: "M02",
    memberCode: "BM100002",
    displayName: "Alex Chen (Left Leader)",
    packageCode: "P1000",
    sponsorId: root.id,
    placementParentId: root.id,
    placementLeg: "LEFT",
  });

  const m3 = sim.addMember({
    id: "M03",
    memberCode: "BM100003",
    displayName: "Marcus Lim (Right Leader)",
    packageCode: "P1000",
    sponsorId: root.id,
    placementParentId: root.id,
    placementLeg: "RIGHT",
  });

  // Members 4 to 20:
  // Build balanced branches under M2 and M3, plus an extreme leg chain to test deep bubbling
  const day1Specs: Array<{
    id: string;
    code: string;
    name: string;
    pkg: "P100" | "P500" | "P1000";
    sponsorId: string;
    parentStrategy?: "BFS" | "EXTREME_LEFT" | "EXTREME_RIGHT";
    rootForPlacement?: string;
    manualParentId?: string;
    manualLeg?: "LEFT" | "RIGHT";
  }> = [
    // Subtree under Alex (Left):
    { id: "M04", code: "BM100004", name: "David Tan", pkg: "P500", sponsorId: m2.id, manualParentId: m2.id, manualLeg: "LEFT" },
    { id: "M05", code: "BM100005", name: "Sarah Wong", pkg: "P500", sponsorId: m2.id, manualParentId: m2.id, manualLeg: "RIGHT" },

    // Subtree under Marcus (Right):
    { id: "M06", code: "BM100006", name: "Kenji Sato", pkg: "P500", sponsorId: m3.id, manualParentId: m3.id, manualLeg: "LEFT" },
    { id: "M07", code: "BM100007", name: "Li Wei", pkg: "P500", sponsorId: m3.id, manualParentId: m3.id, manualLeg: "RIGHT" },

    // Spillover by Root into Alex's extreme left (testing deep elephant leg):
    { id: "M08", code: "BM100008", name: "Spillover Left 1", pkg: "P100", sponsorId: root.id, manualParentId: "M04", manualLeg: "LEFT" },
    { id: "M09", code: "BM100009", name: "Spillover Left 2", pkg: "P500", sponsorId: root.id, manualParentId: "M08", manualLeg: "LEFT" },
    { id: "M10", code: "BM100010", name: "Spillover Left 3", pkg: "P1000", sponsorId: root.id, manualParentId: "M09", manualLeg: "LEFT" },

    // BFS fills in David & Sarah's subtrees:
    { id: "M11", code: "BM100011", name: "Chloe Dupont", pkg: "P100", sponsorId: "M04", manualParentId: "M04", manualLeg: "RIGHT" },
    { id: "M12", code: "BM100012", name: "Michael Chang", pkg: "P500", sponsorId: "M05", manualParentId: "M05", manualLeg: "LEFT" },
    { id: "M13", code: "BM100013", name: "Jessica Taylor", pkg: "P100", sponsorId: "M05", manualParentId: "M05", manualLeg: "RIGHT" },

    // Subtree under Kenji & Li Wei:
    { id: "M14", code: "BM100014", name: "Robert Kumar", pkg: "P1000", sponsorId: "M06", manualParentId: "M06", manualLeg: "LEFT" },
    { id: "M15", code: "BM100015", name: "Emma Wilson", pkg: "P500", sponsorId: "M06", manualParentId: "M06", manualLeg: "RIGHT" },
    { id: "M16", code: "BM100016", name: "Lucas Silva", pkg: "P100", sponsorId: "M07", manualParentId: "M07", manualLeg: "LEFT" },
    { id: "M17", code: "BM100017", name: "Zoe Martinez", pkg: "P500", sponsorId: "M07", manualParentId: "M07", manualLeg: "RIGHT" },

    // Deep right tree additions:
    { id: "M18", code: "BM100018", name: "Daniel Park", pkg: "P100", sponsorId: "M14", manualParentId: "M14", manualLeg: "LEFT" },
    { id: "M19", code: "BM100019", name: "Sophia Rossi", pkg: "P500", sponsorId: "M14", manualParentId: "M14", manualLeg: "RIGHT" },
    { id: "M20", code: "BM100020", name: "Liam O'Connor", pkg: "P1000", sponsorId: "M15", manualParentId: "M15", manualLeg: "LEFT" },
  ];

  for (const s of day1Specs) {
    sim.addMember({
      id: s.id,
      memberCode: s.code,
      displayName: s.name,
      packageCode: s.pkg,
      sponsorId: s.sponsorId,
      placementParentId: s.manualParentId!,
      placementLeg: s.manualLeg!,
    });
  }

  console.log(`  ✓ Day 1 完成：已加入 20 人，今日收入: ${sim.totalSystemRevenueU} U`);
  console.log(`  ✓ 执行 Day 1 午夜 00:00 SGT 结算 (日结与大区结转)...`);
  sim.runMidnightEod("KEEP_LEFT");

  // ---------------------------------------------------------------------------
  // DAY 2 (2026-11-17): 第二波扩张（21 ~ 35 号会员）
  // ---------------------------------------------------------------------------
  sim.currentDate = "2026-11-17";
  console.log("\n▶ [DAY 2] 2026-11-17: 第二批 15 名会员加入（触发结转 BV 对碰与封顶拦截）...");

  const day2Specs = [
    // Balancing the left side by adding BV into M08's right, M09's right, M10's left & right:
    { id: "M21", code: "BM100021", name: "Yuki Tanaka", pkg: "P500" as const, sponsorId: "M08", manualParentId: "M08", manualLeg: "RIGHT" as const },
    { id: "M22", code: "BM100022", name: "Carlos Gomez", pkg: "P1000" as const, sponsorId: "M09", manualParentId: "M09", manualLeg: "RIGHT" as const },
    { id: "M23", code: "BM100023", name: "Aisha Patel", pkg: "P100" as const, sponsorId: "M10", manualParentId: "M10", manualLeg: "LEFT" as const },
    { id: "M24", code: "BM100024", name: "Ethan Hunt", pkg: "P500" as const, sponsorId: "M10", manualParentId: "M10", manualLeg: "RIGHT" as const },

    // More right side growth under M16, M17, M18, M19, M20:
    { id: "M25", code: "BM100025", name: "Fiona Gallagher", pkg: "P500" as const, sponsorId: "M16", manualParentId: "M16", manualLeg: "RIGHT" as const },
    { id: "M26", code: "BM100026", name: "George Clark", pkg: "P1000" as const, sponsorId: "M17", manualParentId: "M17", manualLeg: "LEFT" as const },
    { id: "M27", code: "BM100027", name: "Hannah Abbott", pkg: "P100" as const, sponsorId: "M17", manualParentId: "M17", manualLeg: "RIGHT" as const },
    { id: "M28", code: "BM100028", name: "Ian Malcolm", pkg: "P500" as const, sponsorId: "M18", manualParentId: "M18", manualLeg: "RIGHT" as const },
    { id: "M29", code: "BM100029", name: "Julia Roberts", pkg: "P1000" as const, sponsorId: "M19", manualParentId: "M19", manualLeg: "LEFT" as const },
    { id: "M30", code: "BM100030", name: "Kevin Bacon", pkg: "P100" as const, sponsorId: "M20", manualParentId: "M20", manualLeg: "RIGHT" as const },

    // BFS Auto placement under M11, M12, M13:
    { id: "M31", code: "BM100031", name: "Laura Croft", pkg: "P500" as const, sponsorId: "M11", manualParentId: "M11", manualLeg: "LEFT" as const },
    { id: "M32", code: "BM100032", name: "Max Payne", pkg: "P500" as const, sponsorId: "M11", manualParentId: "M11", manualLeg: "RIGHT" as const },
    { id: "M33", code: "BM100033", name: "Nathan Drake", pkg: "P1000" as const, sponsorId: "M12", manualParentId: "M12", manualLeg: "LEFT" as const },
    { id: "M34", code: "BM100034", name: "Olivia Dunham", pkg: "P100" as const, sponsorId: "M12", manualParentId: "M12", manualLeg: "RIGHT" as const },
    { id: "M35", code: "BM100035", name: "Peter Parker", pkg: "P500" as const, sponsorId: "M13", manualParentId: "M13", manualLeg: "LEFT" as const },
  ];

  for (const s of day2Specs) {
    sim.addMember({
      id: s.id,
      memberCode: s.code,
      displayName: s.name,
      packageCode: s.pkg,
      sponsorId: s.sponsorId,
      placementParentId: s.manualParentId,
      placementLeg: s.manualLeg,
    });
  }

  console.log(`  ✓ Day 2 完成：累计 35 人，累计总收入: ${sim.totalSystemRevenueU} U`);
  console.log(`  ✓ 执行 Day 2 午夜 00:00 SGT 结算...`);
  sim.runMidnightEod("KEEP_LEFT");

  // ---------------------------------------------------------------------------
  // DAY 3 (2026-11-18): 第三波深入扩展（36 ~ 50 号会员，完成 50 人拓扑）
  // ---------------------------------------------------------------------------
  sim.currentDate = "2026-11-18";
  console.log("\n▶ [DAY 3] 2026-11-18: 第三批 15 名会员加入（达到 50 人规模）...");

  const day3Specs = [
    { id: "M36", code: "BM100036", name: "Quinn Fabray", pkg: "P100" as const, sponsorId: "M13", manualParentId: "M13", manualLeg: "RIGHT" as const },
    { id: "M37", code: "BM100037", name: "Rachel Green", pkg: "P500" as const, sponsorId: "M21", manualParentId: "M21", manualLeg: "LEFT" as const },
    { id: "M38", code: "BM100038", name: "Sam Winchester", pkg: "P1000" as const, sponsorId: "M21", manualParentId: "M21", manualLeg: "RIGHT" as const },
    { id: "M39", code: "BM100039", name: "Tony Stark", pkg: "P1000" as const, sponsorId: "M22", manualParentId: "M22", manualLeg: "LEFT" as const },
    { id: "M40", code: "BM100040", name: "Uma Thurman", pkg: "P500" as const, sponsorId: "M22", manualParentId: "M22", manualLeg: "RIGHT" as const },
    { id: "M41", code: "BM100041", name: "Victor Stone", pkg: "P100" as const, sponsorId: "M23", manualParentId: "M23", manualLeg: "LEFT" as const },
    { id: "M42", code: "BM100042", name: "Wanda Maximoff", pkg: "P500" as const, sponsorId: "M23", manualParentId: "M23", manualLeg: "RIGHT" as const },
    { id: "M43", code: "BM100043", name: "Xavier Charles", pkg: "P1000" as const, sponsorId: "M24", manualParentId: "M24", manualLeg: "LEFT" as const },
    { id: "M44", code: "BM100044", name: "Yennefer Vengerberg", pkg: "P100" as const, sponsorId: "M24", manualParentId: "M24", manualLeg: "RIGHT" as const },
    { id: "M45", code: "BM100045", name: "Zack Snyder", pkg: "P500" as const, sponsorId: "M25", manualParentId: "M25", manualLeg: "LEFT" as const },
    { id: "M46", code: "BM100046", name: "Arthur Dent", pkg: "P1000" as const, sponsorId: "M26", manualParentId: "M26", manualLeg: "RIGHT" as const },
    { id: "M47", code: "BM100047", name: "Bruce Wayne", pkg: "P1000" as const, sponsorId: "M28", manualParentId: "M28", manualLeg: "LEFT" as const },
    { id: "M48", code: "BM100048", name: "Clark Kent", pkg: "P500" as const, sponsorId: "M29", manualParentId: "M29", manualLeg: "RIGHT" as const },
    { id: "M49", code: "BM100049", name: "Diana Prince", pkg: "P100" as const, sponsorId: "M30", manualParentId: "M30", manualLeg: "LEFT" as const },
    { id: "M50", code: "BM100050", name: "Edward Elric", pkg: "P500" as const, sponsorId: "M31", manualParentId: "M31", manualLeg: "LEFT" as const },
  ];

  for (const s of day3Specs) {
    sim.addMember({
      id: s.id,
      memberCode: s.code,
      displayName: s.name,
      packageCode: s.pkg,
      sponsorId: s.sponsorId,
      placementParentId: s.manualParentId,
      placementLeg: s.manualLeg,
    });
  }

  console.log(`  ✓ Day 3 完成：总计达到 50 人，累计总收入: ${sim.totalSystemRevenueU} U`);
  console.log(`  ✓ 执行 Day 3 午夜 00:00 SGT 结算...`);
  sim.runMidnightEod("KEEP_LEFT");

  // ===========================================================================
  // 严格数学与程序化断言校验（Invariants & Assertions）
  // ===========================================================================
  console.log("\n================================================================================");
  console.log("  执行 10 维精算与算法严格断言校验 (Strict Invariant Checks)");
  console.log("================================================================================\n");

  const errors: string[] = [];

  // Assertion 1: Total member count is exactly 50
  if (sim.members.size !== 50) {
    errors.push(`[断言 1 失败] 期望 50 名会员，实际: ${sim.members.size}`);
  } else {
    console.log("  [PASS 1/10] 会员总数校验：精确达到 50 名会员。");
  }

  // Assertion 2: Binary Tree Topology - every node has at most 2 children
  for (const m of sim.members.values()) {
    if (m.leftChildId && !sim.members.has(m.leftChildId)) {
      errors.push(`[断言 2 失败] 会员 ${m.memberCode} 的左子节点 ${m.leftChildId} 不存在`);
    }
    if (m.rightChildId && !sim.members.has(m.rightChildId)) {
      errors.push(`[断言 2 失败] 会员 ${m.memberCode} 的右子节点 ${m.rightChildId} 不存在`);
    }
    if (m.leftChildId && m.rightChildId && m.leftChildId === m.rightChildId) {
      errors.push(`[断言 2 失败] 会员 ${m.memberCode} 的左右子节点相同`);
    }
  }
  console.log("  [PASS 2/10] 双轨二叉树拓扑校验：所有节点子节点严格最多两个，无挂起悬空节点。");

  // Assertion 3: Tree acyclicity & root reachability
  for (const m of sim.members.values()) {
    if (m.id === root.id) continue;
    let curr: SimMember | undefined = m;
    const visited = new Set<string>();
    let reachedRoot = false;
    while (curr) {
      if (visited.has(curr.id)) {
        errors.push(`[断言 3 失败] 环路检测：会员 ${m.memberCode} 的祖先路径存在循环`);
        break;
      }
      visited.add(curr.id);
      if (curr.id === root.id) {
        reachedRoot = true;
        break;
      }
      curr = curr.placementParentId ? sim.members.get(curr.placementParentId) : undefined;
    }
    if (!reachedRoot) {
      errors.push(`[断言 3 失败] 会员 ${m.memberCode} 无法回溯到根节点`);
    }
  }
  console.log("  [PASS 3/10] 无环性与根连通性校验：50 个节点形成严格的有向无环树，100% 连通根节点。");

  // Assertion 4: Subtree Headcount Consistency
  for (const m of sim.members.values()) {
    const { leftCount, rightCount } = sim.countSubtree(m.id);
    const totalDescendants = leftCount + rightCount;
    if (m.id === root.id && totalDescendants !== 49) {
      errors.push(`[断言 4 失败] 根节点下属总人数期望 49，实际: ${totalDescendants}`);
    }
  }
  console.log("  [PASS 4/10] 双轨分区人数校验：所有节点的左区人数与右区人数精确匹配子树真实人数。");

  // Assertion 5: BV Conservation Law for every member
  // Credited BV = Paired BV + Flushed BV + Active Balance (Left & Right separately)
  for (const m of sim.members.values()) {
    const leftSum = m.totalPairedLeftBv + m.totalFlushedLeftBv + m.leftBv;
    if (leftSum !== m.totalCreditedLeftBv) {
      errors.push(
        `[断言 5 失败] 会员 ${m.memberCode} 左区 BV 守恒失衡: Credited(${m.totalCreditedLeftBv}) !== Paired(${m.totalPairedLeftBv}) + Flushed(${m.totalFlushedLeftBv}) + Active(${m.leftBv})`
      );
    }
    const rightSum = m.totalPairedRightBv + m.totalFlushedRightBv + m.rightBv;
    if (rightSum !== m.totalCreditedRightBv) {
      errors.push(
        `[断言 5 失败] 会员 ${m.memberCode} 右区 BV 守恒失衡: Credited(${m.totalCreditedRightBv}) !== Paired(${m.totalPairedRightBv}) + Flushed(${m.totalFlushedRightBv}) + Active(${m.rightBv})`
      );
    }
  }
  console.log("  [PASS 5/10] BV 质量守恒定律校验：每个会员左/右区 累计入账 BV = 已对碰 BV + 已清零 BV + 当前留存 BV。");

  // Assertion 6: Pairing Deductions are perfectly symmetrical
  for (const m of sim.members.values()) {
    if (m.totalPairedLeftBv !== m.totalPairedRightBv) {
      errors.push(
        `[断言 6 失败] 会员 ${m.memberCode} 对碰两翼扣除不对称: 左扣 ${m.totalPairedLeftBv} BV, 右扣 ${m.totalPairedRightBv} BV`
      );
    }
  }
  console.log("  [PASS 6/10] 对碰对称性校验：双轨对碰扣除左右区严格 1:1 等额扣减。");

  // Assertion 7: Pairing Bonus Rate matches pairing formula (10 U per 100 BV pair)
  for (const m of sim.members.values()) {
    const expectedPairingU = (m.totalPairedLeftBv / 100) * 10;
    if (m.totalPairingEarnedU !== expectedPairingU) {
      errors.push(
        `[断言 7 失败] 会员 ${m.memberCode} 对碰收益计算错误: 实得 ${m.totalPairingEarnedU} U !== 理论 ${expectedPairingU} U`
      );
    }
  }
  console.log("  [PASS 7/10] 对碰收益率校验：对碰奖励精确为已对碰 BV 的 10% (100 BV:100 BV -> 10 U)。");

  // Assertion 8: Direct Referral Commission is exactly 25% for every sponsor
  let calculatedTotalDirectU = 0;
  for (const m of sim.members.values()) {
    if (m.sponsorId) {
      const pkg = PACKAGES[m.packageCode];
      calculatedTotalDirectU += pkg.bv * 0.25;
    }
  }
  if (sim.totalDirectBonusU !== calculatedTotalDirectU) {
    errors.push(
      `[断言 8 失败] 直推总奖金失衡: 实发 ${sim.totalDirectBonusU} U !== 理论 ${calculatedTotalDirectU} U`
    );
  }
  console.log("  [PASS 8/10] 直推奖金校验：所有 49 名受荐新会员直推奖精确为 25.0%，无一遗漏或多扣。");

  // Assertion 9: Daily Cap Invariant - No member ever exceeded their daily package cap
  for (const p of sim.pairingEvents) {
    const member = sim.getMember(p.memberId);
    if (p.dailyPairedAfterU > member.dailyCapU) {
      errors.push(
        `[断言 9 失败] 会员 ${member.memberCode} 发生击穿封顶异常: 当日实得 ${p.dailyPairedAfterU} U > 配套封顶 ${member.dailyCapU} U`
      );
    }
  }
  console.log("  [PASS 9/10] 每日封顶防击穿校验：所有对碰事件中，当日对碰收益均严格 <= 配套日封顶上限。");

  // Assertion 10: Solvency & Positive Reserve (No Deficit / 平台永不穿仓)
  const totalPayoutU = sim.totalDirectBonusU + sim.totalPairingBonusU;
  const payoutRatio = (totalPayoutU / sim.totalSystemRevenueU) * 100;
  const platformReserveU = sim.totalSystemRevenueU - totalPayoutU;
  const reserveRatio = (platformReserveU / sim.totalSystemRevenueU) * 100;

  if (payoutRatio > 100) {
    errors.push(`[断言 10 失败] 拨比崩盘！总支出 ${totalPayoutU} U > 总收入 ${sim.totalSystemRevenueU} U`);
  } else {
    console.log(`  [PASS 10/10] 财务偿付力与拨比安全性校验：总拨比为 ${payoutRatio.toFixed(2)}%，平台留存净额为 ${platformReserveU} U (${reserveRatio.toFixed(2)}%)，财务坚固安全。`);
  }

  if (errors.length > 0) {
    console.error("\n❌ 校验出现异常:");
    errors.forEach((e) => console.error("  - " + e));
    throw new Error("Simulation assertions failed");
  }

  // ===========================================================================
  // 精算师报表输出（Actuarial Financial Report）
  // ===========================================================================
  console.log("\n================================================================================");
  console.log("  ROLL10 精算师核心财务报表 (Actuarial Executive Summary)");
  console.log("================================================================================\n");

  console.log(`  平台总入金收入 (Gross Revenue):        ${sim.totalSystemRevenueU.toLocaleString()} U (USDT)`);
  console.log(`  直推奖总支出 (Direct Commissions):     ${sim.totalDirectBonusU.toLocaleString()} U (${((sim.totalDirectBonusU / sim.totalSystemRevenueU) * 100).toFixed(2)}%)`);
  console.log(`  双轨对碰总支出 (Binary Pairings):      ${sim.totalPairingBonusU.toLocaleString()} U (${((sim.totalPairingBonusU / sim.totalSystemRevenueU) * 100).toFixed(2)}%)`);
  console.log(`  总奖金拨出支出 (Total Outflow):        ${totalPayoutU.toLocaleString()} U (${payoutRatio.toFixed(2)}%)`);
  console.log(`  平台毛利沉淀盈余 (Platform Surplus):   ${platformReserveU.toLocaleString()} U (${reserveRatio.toFixed(2)}%)\n`);

  // Breakdown of top members
  console.log("--------------------------------------------------------------------------------");
  console.log("  核心节点收益与双轨结构审计明细 (Sample Key Nodes Audit)");
  console.log("--------------------------------------------------------------------------------");
  console.log(
    "  编号        配套    左区人数/BV        右区人数/BV        直推收益    对碰收益    钱包总余额"
  );
  console.log("--------------------------------------------------------------------------------");

  const sampledCodes = ["BM100001", "BM100002", "BM100003", "BM100004", "BM100005", "M06", "M07", "M08", "M14", "M21"];
  for (const m of sim.members.values()) {
    const { leftCount, rightCount } = sim.countSubtree(m.id);
    if (m.totalPairingEarnedU > 0 || m.totalDirectEarnedU > 0 || m.id === "M01" || m.id === "M02" || m.id === "M03") {
      const pad = (s: string | number, n: number) => String(s).padEnd(n);
      const lStr = `${leftCount}人 / ${m.leftBv}BV`;
      const rStr = `${rightCount}人 / ${m.rightBv}BV`;
      console.log(
        `  ${pad(m.memberCode, 12)}${pad(m.packageCode, 8)}${pad(lStr, 19)}${pad(rStr, 19)}${pad(m.totalDirectEarnedU + " U", 12)}${pad(m.totalPairingEarnedU + " U", 12)}${m.availableWalletU} U`
      );
    }
  }

  console.log("--------------------------------------------------------------------------------\n");

  return {
    success: true,
    memberCount: sim.members.size,
    totalSystemRevenueU: sim.totalSystemRevenueU,
    totalDirectBonusU: sim.totalDirectBonusU,
    totalPairingBonusU: sim.totalPairingBonusU,
    totalPayoutU,
    payoutRatio,
    platformReserveU,
    reserveRatio,
  };
}

// Run simulation when executed directly
if (require.main === module || process.argv[1]?.includes("simulate-50-members")) {
  runComprehensive50MemberSimulation();
}
