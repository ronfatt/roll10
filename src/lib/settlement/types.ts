import type { BinaryLeg, Member, SystemConfig } from "@prisma/client";

export interface LockedMemberRow {
  id: string;
  memberCode: string;
  email: string;
  displayName: string;
  role: "MEMBER" | "ADMIN";
  status: "PENDING_PAYMENT" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
  sponsorId: string | null;
  placementParentId: string | null;
  placementLeg: BinaryLeg | null;
  currentPackageCode: string | null;
  dailyCapPointsCents: number;
  pendingUpgradePackageCode: string | null;
  pendingUpgradeEffectiveDate: string | null;
  pendingUpgradeEffectiveAt: Date | null;
  pendingUpgradeOrderId: string | null;
  leftBv: number;
  rightBv: number;
  activeSettlementDate: string;
  todayPairedPointsCents: number;
  availablePointsCents: number;
  lockedPointsCents: number;
  activatedAt: Date | null;
}

export interface AncestorStep {
  ancestorId: string;
  leg: BinaryLeg;
}

export interface ConfirmOrderResult {
  ok: boolean;
  idempotent?: boolean;
  reason?: string;
  orderId: string;
  orderNo: string;
  effectiveSgtDate?: string | null;
  effectiveAt?: Date | null;
  upgradeStatus?: "NOT_APPLICABLE" | "WAITING_EFFECTIVE" | "EFFECTIVE";
  directCommissionCents?: number;
  directRewardUsdtMicros?: string;
  pairingSettlementsCount?: number;
}

export interface EodDecision {
  retainedSide: "LEFT" | "RIGHT" | "NONE";
  flushedSide: "LEFT" | "RIGHT" | "NONE";
  flushedBv: number;
  leftBvAfter: number;
  rightBvAfter: number;
  decisionBasis: string;
}

export type SettlementConfig = SystemConfig;
export type MemberRecord = Member;
