import type { BinaryLeg } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatSgtTimestamp } from "@/lib/sgt";
import { countSubtreeActiveMembers, isInReferralSubtree } from "@/lib/settlement/tree";

export interface ReferralNodeDto {
  id: string;
  memberCode: string;
  displayName: string;
  packageCode: string | null;
  status: string;
  sponsorId: string | null;
  sponsorCode: string | null;
  sponsorName: string | null;
  directCount: number;
  placementParentCode: string | null;
  placementLeg: BinaryLeg | null;
  joinedAtLabel: string;
}

export interface ReferralSearchHit {
  id: string;
  memberCode: string;
  displayName: string;
  packageCode: string | null;
  status: string;
  depth: number;
  pathIds: string[];
}

export interface PlacementNodeDto {
  id: string;
  memberCode: string;
  displayName: string;
  packageCode: string | null;
  status: string;
  placementParentId: string | null;
  placementParentCode: string | null;
  placementParentName: string | null;
  placementLeg: BinaryLeg | null;
  sponsorCode: string | null;
  sponsorName: string | null;
  leftBv: number | null;
  rightBv: number | null;
  leftCount: number;
  rightCount: number;
  hasLeftChild: boolean;
  hasRightChild: boolean;
  inReferralSubtree: boolean;
  joinedAtLabel: string;
}

export interface PlacementBreadcrumbItem {
  id: string;
  memberCode: string;
  displayName: string;
  leg: BinaryLeg | null;
}

export interface PlacementSearchHit {
  id: string;
  memberCode: string;
  displayName: string;
  packageCode: string | null;
  status: string;
  placementLeg: BinaryLeg | null;
  depth: number;
}

const SAFE_MEMBER_SELECT = {
  id: true,
  memberCode: true,
  displayName: true,
  currentPackageCode: true,
  status: true,
  sponsorId: true,
  placementParentId: true,
  placementLeg: true,
  leftBv: true,
  rightBv: true,
  createdAt: true,
  sponsor: {
    select: { memberCode: true, displayName: true },
  },
  placementParent: {
    select: { memberCode: true, displayName: true },
  },
  _count: {
    select: { directReferrals: true },
  },
} as const;

export async function getReferralNodeById(memberId: string): Promise<ReferralNodeDto | null> {
  const m = await prisma.member.findUnique({
    where: { id: memberId },
    select: SAFE_MEMBER_SELECT,
  });
  if (!m) return null;
  return {
    id: m.id,
    memberCode: m.memberCode,
    displayName: m.displayName,
    packageCode: m.currentPackageCode,
    status: m.status,
    sponsorId: m.sponsorId,
    sponsorCode: m.sponsor?.memberCode ?? null,
    sponsorName: m.sponsor?.displayName ?? null,
    directCount: m._count.directReferrals,
    placementParentCode: m.placementParent?.memberCode ?? null,
    placementLeg: m.placementLeg,
    joinedAtLabel: formatSgtTimestamp(m.createdAt),
  };
}

export async function getReferralChildrenPage(
  parentId: string,
  offset: number,
  limit: number
): Promise<{
  children: ReferralNodeDto[];
  total: number;
  hasMore: boolean;
}> {
  const [rows, total] = await Promise.all([
    prisma.member.findMany({
      where: { sponsorId: parentId },
      select: SAFE_MEMBER_SELECT,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: offset,
      take: limit,
    }),
    prisma.member.count({ where: { sponsorId: parentId } }),
  ]);

  const children: ReferralNodeDto[] = rows.map((m) => ({
    id: m.id,
    memberCode: m.memberCode,
    displayName: m.displayName,
    packageCode: m.currentPackageCode,
    status: m.status,
    sponsorId: m.sponsorId,
    sponsorCode: m.sponsor?.memberCode ?? null,
    sponsorName: m.sponsor?.displayName ?? null,
    directCount: m._count.directReferrals,
    placementParentCode: m.placementParent?.memberCode ?? null,
    placementLeg: m.placementLeg,
    joinedAtLabel: formatSgtTimestamp(m.createdAt),
  }));

  return {
    children,
    total,
    hasMore: offset + children.length < total,
  };
}

/**
 * Finds referral path from `rootId` down to `targetId` (inclusive).
 * Returns null if `targetId` is not reachable under `rootId`.
 */
export async function getReferralPathFromRoot(
  rootId: string,
  targetId: string
): Promise<string[] | null> {
  if (rootId === targetId) return [rootId];
  const rows = await prisma.$queryRaw<Array<{ id: string; depth: number }>>`
    WITH RECURSIVE up AS (
      SELECT id, "sponsorId", 0 AS depth
      FROM members
      WHERE id = ${targetId}

      UNION ALL

      SELECT p.id, p."sponsorId", u.depth + 1 AS depth
      FROM members p
      JOIN up u ON p.id = u."sponsorId"
      WHERE u.id <> ${rootId} AND u.depth < 256
    )
    SELECT id, depth FROM up ORDER BY depth DESC
  `;
  if (rows.length === 0 || rows[0]?.id !== rootId) {
    return null;
  }
  return rows.map((r) => r.id);
}

/**
 * Searches members within the viewer's referral subtree (or all members for ADMIN).
 * Never exposes private fields (email, phone, balances).
 */
export async function searchReferralSubtree(
  viewerId: string,
  _isAdmin: boolean,
  query: string
): Promise<ReferralSearchHit[]> {
  const pattern = `%${query}%`;
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      memberCode: string;
      displayName: string;
      currentPackageCode: string | null;
      status: string;
      depth: number;
      path_ids: string[];
    }>
  >`
    WITH RECURSIVE tree AS (
      SELECT
        id,
        "memberCode",
        "displayName",
        "currentPackageCode",
        status::text AS status,
        0 AS depth,
        ARRAY[id]::text[] AS path_ids
      FROM members
      WHERE id = ${viewerId}

      UNION ALL

      SELECT
        c.id,
        c."memberCode",
        c."displayName",
        c."currentPackageCode",
        c.status::text AS status,
        t.depth + 1 AS depth,
        t.path_ids || c.id
      FROM members c
      JOIN tree t ON c."sponsorId" = t.id
      WHERE t.depth < 128
    )
    SELECT id, "memberCode", "displayName", "currentPackageCode", status, depth, path_ids
    FROM tree
    WHERE ("memberCode" ILIKE ${pattern} OR "displayName" ILIKE ${pattern})
    ORDER BY depth ASC, "memberCode" ASC
    LIMIT 10
  `;

  return rows.map((r) => ({
    id: r.id,
    memberCode: r.memberCode,
    displayName: r.displayName,
    packageCode: r.currentPackageCode,
    status: r.status,
    depth: Number(r.depth),
    pathIds: r.path_ids,
  }));
}

export async function getPlacementNodeDto(
  viewerId: string,
  viewerIsAdmin: boolean,
  targetId: string
): Promise<PlacementNodeDto | null> {
  const m = await prisma.member.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      memberCode: true,
      displayName: true,
      currentPackageCode: true,
      status: true,
      placementParentId: true,
      placementLeg: true,
      leftBv: true,
      rightBv: true,
      createdAt: true,
      placementParent: {
        select: { memberCode: true, displayName: true },
      },
      sponsor: {
        select: { memberCode: true, displayName: true },
      },
      placedChildren: {
        select: { placementLeg: true },
      },
    },
  });
  if (!m) return null;

  const [{ leftCount, rightCount }, inRef] = await Promise.all([
    countSubtreeActiveMembers(prisma, m.id),
    viewerIsAdmin ? Promise.resolve(true) : isInReferralSubtree(prisma, viewerId, m.id),
  ]);

  // Viewers may inspect BV only for nodes authorized by route-level subtree/admin checks.
  const canViewBv = m.id === viewerId || viewerIsAdmin;

  return {
    id: m.id,
    memberCode: m.memberCode,
    displayName: m.displayName,
    packageCode: m.currentPackageCode,
    status: m.status,
    placementParentId: m.placementParentId,
    placementParentCode: m.placementParent?.memberCode ?? null,
    placementParentName: m.placementParent?.displayName ?? null,
    placementLeg: m.placementLeg,
    sponsorCode: m.sponsor?.memberCode ?? null,
    sponsorName: m.sponsor?.displayName ?? null,
    leftBv: canViewBv ? m.leftBv : null,
    rightBv: canViewBv ? m.rightBv : null,
    leftCount,
    rightCount,
    hasLeftChild: m.placedChildren.some((c) => c.placementLeg === "LEFT"),
    hasRightChild: m.placedChildren.some((c) => c.placementLeg === "RIGHT"),
    inReferralSubtree: inRef,
    joinedAtLabel: formatSgtTimestamp(m.createdAt),
  };
}

export async function getPlacementBreadcrumbs(
  rootId: string,
  focusId: string
): Promise<PlacementBreadcrumbItem[]> {
  if (rootId === focusId) {
    const r = await prisma.member.findUnique({
      where: { id: rootId },
      select: { id: true, memberCode: true, displayName: true, placementLeg: true },
    });
    return r
      ? [{ id: r.id, memberCode: r.memberCode, displayName: r.displayName, leg: null }]
      : [];
  }

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      memberCode: string;
      displayName: string;
      placementLeg: BinaryLeg | null;
      depth: number;
    }>
  >`
    WITH RECURSIVE up AS (
      SELECT id, "memberCode", "displayName", "placementParentId", "placementLeg", 0 AS depth
      FROM members
      WHERE id = ${focusId}

      UNION ALL

      SELECT p.id, p."memberCode", p."displayName", p."placementParentId", p."placementLeg", u.depth + 1 AS depth
      FROM members p
      JOIN up u ON p.id = u."placementParentId"
      WHERE u.id <> ${rootId} AND u.depth < 256
    )
    SELECT id, "memberCode", "displayName", "placementLeg", depth
    FROM up
    ORDER BY depth DESC
  `;

  return rows.map((r, idx) => ({
    id: r.id,
    memberCode: r.memberCode,
    displayName: r.displayName,
    leg: idx === 0 ? null : r.placementLeg,
  }));
}

export async function searchPlacementSubtree(
  viewerId: string,
  query: string
): Promise<PlacementSearchHit[]> {
  const pattern = `%${query}%`;
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      memberCode: string;
      displayName: string;
      currentPackageCode: string | null;
      status: string;
      placementLeg: BinaryLeg | null;
      depth: number;
    }>
  >`
    WITH RECURSIVE tree AS (
      SELECT
        id,
        "memberCode",
        "displayName",
        "currentPackageCode",
        status::text AS status,
        "placementLeg",
        0 AS depth
      FROM members
      WHERE id = ${viewerId}

      UNION ALL

      SELECT
        c.id,
        c."memberCode",
        c."displayName",
        c."currentPackageCode",
        c.status::text AS status,
        c."placementLeg",
        t.depth + 1 AS depth
      FROM members c
      JOIN tree t ON c."placementParentId" = t.id
      WHERE t.depth < 128
    )
    SELECT id, "memberCode", "displayName", "currentPackageCode", status, "placementLeg", depth
    FROM tree
    WHERE ("memberCode" ILIKE ${pattern} OR "displayName" ILIKE ${pattern})
    ORDER BY depth ASC, "memberCode" ASC
    LIMIT 10
  `;

  return rows.map((r) => ({
    id: r.id,
    memberCode: r.memberCode,
    displayName: r.displayName,
    packageCode: r.currentPackageCode,
    status: r.status,
    placementLeg: r.placementLeg,
    depth: Number(r.depth),
  }));
}
