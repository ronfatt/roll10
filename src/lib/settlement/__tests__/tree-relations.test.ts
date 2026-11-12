import { beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

if (!process.env.DATABASE_URL?.includes("binary_member_portal_test")) {
  throw new Error(
    `Refusing to run test suite against non-test DATABASE_URL: ${process.env.DATABASE_URL}`
  );
}

import {
  isInPlacementSubtree,
  isInReferralSubtree,
} from "@/lib/settlement/tree";
import {
  getPlacementBreadcrumbs,
  getPlacementNodeDto,
  getReferralChildrenPage,
  getReferralNodeById,
  getReferralPathFromRoot,
  searchPlacementSubtree,
  searchReferralSubtree,
} from "@/lib/tree-queries";

describe("Team Dual-Tree (Referral Tree & Placement Tree) Queries & Authorization", () => {
  let rootId = "";
  let memberAId = "";
  let memberBId = "";
  let memberCId = "";
  let outsiderId = "";
  let depth3Id = "";

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        audit_logs,
        wallet_ledgers,
        bv_ledgers,
        binary_pairing_settlements,
        daily_settlements,
        withdrawal_requests,
        package_orders,
        members,
        package_tiers,
        rule_version_records,
        system_configs
      RESTART IDENTITY CASCADE
    `);

    const pwHash = await bcrypt.hash("Password123!", 6);
    await prisma.packageTier.create({
      data: {
        code: "P500",
        nameEn: "Pro 500",
        nameZh: "进阶配套 500",
        priceUsdCents: 50000,
        bv: 500,
        dailyCapPointsCents: 50000,
        sortOrder: 2,
      },
    });

    const top = await prisma.member.create({
      data: {
        memberCode: "TM0001",
        email: "top@test.io",
        passwordHash: pwHash,
        displayName: "Top Admin",
        role: "ADMIN",
        status: "ACTIVE",
        currentPackageCode: "P500",
        activeSettlementDate: "2026-11-16",
      },
    });

    const outsider = await prisma.member.create({
      data: {
        memberCode: "TM0002",
        email: "outsider@test.io",
        passwordHash: pwHash,
        displayName: "Outsider Branch",
        role: "MEMBER",
        status: "ACTIVE",
        sponsorId: top.id,
        placementParentId: top.id,
        placementLeg: "RIGHT",
        currentPackageCode: "P500",
        activeSettlementDate: "2026-11-16",
      },
    });
    outsiderId = outsider.id;

    const root = await prisma.member.create({
      data: {
        memberCode: "TM0010",
        email: "root@test.io",
        passwordHash: pwHash,
        displayName: "Root Member",
        role: "MEMBER",
        status: "ACTIVE",
        sponsorId: top.id,
        placementParentId: top.id,
        placementLeg: "LEFT",
        currentPackageCode: "P500",
        leftBv: 1500,
        rightBv: 500,
        activeSettlementDate: "2026-11-16",
      },
    });
    rootId = root.id;

    // Root directly sponsors A, B, C, plus D, E, F, G (7 directs for pagination)
    // C's placementParent is A and placementLeg is RIGHT
    const memberA = await prisma.member.create({
      data: {
        memberCode: "TM0011",
        email: "a@test.io",
        passwordHash: pwHash,
        displayName: "Member A",
        role: "MEMBER",
        status: "ACTIVE",
        sponsorId: root.id,
        placementParentId: root.id,
        placementLeg: "LEFT",
        currentPackageCode: "P500",
        activeSettlementDate: "2026-11-16",
        createdAt: new Date("2026-11-16T01:01:00Z"),
      },
    });
    memberAId = memberA.id;

    const memberB = await prisma.member.create({
      data: {
        memberCode: "TM0012",
        email: "b@test.io",
        passwordHash: pwHash,
        displayName: "Member B",
        role: "MEMBER",
        status: "ACTIVE",
        sponsorId: root.id,
        placementParentId: root.id,
        placementLeg: "RIGHT",
        currentPackageCode: "P500",
        activeSettlementDate: "2026-11-16",
        createdAt: new Date("2026-11-16T01:02:00Z"),
      },
    });
    memberBId = memberB.id;

    const memberC = await prisma.member.create({
      data: {
        memberCode: "TM0013",
        email: "c@test.io",
        passwordHash: pwHash,
        displayName: "Member C",
        role: "MEMBER",
        status: "ACTIVE",
        sponsorId: root.id,
        placementParentId: memberA.id,
        placementLeg: "RIGHT",
        currentPackageCode: "P500",
        activeSettlementDate: "2026-11-16",
        createdAt: new Date("2026-11-16T01:03:00Z"),
      },
    });
    memberCId = memberC.id;

    for (let i = 4; i <= 7; i++) {
      await prisma.member.create({
        data: {
          memberCode: `TM001${i}`,
          email: `d${i}@test.io`,
          passwordHash: pwHash,
          displayName: `Direct ${i}`,
          role: "MEMBER",
          status: "PENDING_PAYMENT",
          sponsorId: root.id,
          activeSettlementDate: "2026-11-16",
          createdAt: new Date(`2026-11-16T01:0${i}:00Z`),
        },
      });
    }

    // 2nd and 3rd layer under A -> L2 -> L3
    const l2 = await prisma.member.create({
      data: {
        memberCode: "TM0020",
        email: "l2@test.io",
        passwordHash: pwHash,
        displayName: "Layer Two",
        role: "MEMBER",
        status: "ACTIVE",
        sponsorId: memberA.id,
        placementParentId: memberA.id,
        placementLeg: "LEFT",
        currentPackageCode: "P500",
        activeSettlementDate: "2026-11-16",
      },
    });
    const l3 = await prisma.member.create({
      data: {
        memberCode: "TM0030",
        email: "l3@test.io",
        passwordHash: pwHash,
        displayName: "Target Layer Three",
        role: "MEMBER",
        status: "ACTIVE",
        sponsorId: l2.id,
        placementParentId: memberC.id,
        placementLeg: "LEFT",
        currentPackageCode: "P500",
        activeSettlementDate: "2026-11-16",
      },
    });
    depth3Id = l3.id;
  });

  it("places A, B, C as direct siblings in Referral Tree while placing C on A's RIGHT leg in Placement Tree", async () => {
    const page1 = await getReferralChildrenPage(rootId, 0, 5);
    expect(page1.total).toBe(7);
    expect(page1.hasMore).toBe(true);
    expect(page1.children.slice(0, 3).map((c) => c.id)).toEqual([
      memberAId,
      memberBId,
      memberCId,
    ]);

    const page2 = await getReferralChildrenPage(rootId, 5, 5);
    expect(page2.children).toHaveLength(2);
    expect(page2.hasMore).toBe(false);

    // Placement: under A, C is on RIGHT and L2 is on LEFT
    const placementChildrenOfA = await prisma.member.findMany({
      where: { placementParentId: memberAId },
      select: { id: true, placementLeg: true },
    });
    const rightOfA = placementChildrenOfA.find((c) => c.placementLeg === "RIGHT");
    expect(rightOfA?.id).toBe(memberCId);
  });

  it("resolves 3rd-layer referral path, search filtering, and placement breadcrumbs", async () => {
    const refHits = await searchReferralSubtree(rootId, false, "Layer Three");
    expect(refHits).toHaveLength(1);
    expect(refHits[0]?.id).toBe(depth3Id);
    expect(refHits[0]?.depth).toBe(3);

    const refPath = await getReferralPathFromRoot(rootId, depth3Id);
    expect(refPath).toHaveLength(4); // root -> A -> L2 -> L3
    expect(refPath?.[0]).toBe(rootId);
    expect(refPath?.[3]).toBe(depth3Id);

    const placeHits = await searchPlacementSubtree(rootId, "TM0030");
    expect(placeHits).toHaveLength(1);
    expect(placeHits[0]?.depth).toBe(3);

    const crumbs = await getPlacementBreadcrumbs(rootId, depth3Id);
    expect(crumbs.map((c) => c.memberCode)).toEqual([
      "TM0010",
      "TM0011",
      "TM0013",
      "TM0030",
    ]);
  });

  it("blocks unauthorized cross-branch queries and never exposes private fields", async () => {
    expect(await isInReferralSubtree(prisma, rootId, outsiderId)).toBe(false);
    expect(await isInPlacementSubtree(prisma, rootId, outsiderId)).toBe(false);

    const refSearchOutsider = await searchReferralSubtree(rootId, false, "Outsider");
    expect(refSearchOutsider).toHaveLength(0);

    const placeSearchOutsider = await searchPlacementSubtree(rootId, "TM0002");
    expect(placeSearchOutsider).toHaveLength(0);

    const refDto = await getReferralNodeById(memberCId);
    expect(refDto).not.toBeNull();
    expect("email" in (refDto as object)).toBe(false);
    expect("passwordHash" in (refDto as object)).toBe(false);
    expect("availablePointsCents" in (refDto as object)).toBe(false);

    const placeDto = await getPlacementNodeDto(rootId, false, memberCId);
    expect(placeDto?.inReferralSubtree).toBe(true);
    expect("email" in (placeDto as object)).toBe(false);
    expect("availablePointsCents" in (placeDto as object)).toBe(false);
  });
});
