import type { BinaryLeg, Prisma, PrismaClient } from "@prisma/client";
import type { AncestorStep } from "./types";

type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Walks up the placement tree from `startParentId` (where the new node sits on `firstLeg`)
 * and returns every ancestor plus the leg (LEFT or RIGHT) into which BV flows.
 */
export async function getPlacementAncestorPath(
  db: DbClient,
  startParentId: string,
  firstLeg: BinaryLeg
): Promise<AncestorStep[]> {
  const rows = await db.$queryRaw<Array<{ id: string; leg: BinaryLeg; depth: number }>>`
    WITH RECURSIVE ancestors AS (
      SELECT
        m.id,
        m."placementParentId",
        m."placementLeg",
        ${firstLeg}::"BinaryLeg" AS leg,
        1 AS depth
      FROM members m
      WHERE m.id = ${startParentId}

      UNION ALL

      SELECT
        p.id,
        p."placementParentId",
        p."placementLeg",
        a."placementLeg" AS leg,
        a.depth + 1 AS depth
      FROM members p
      JOIN ancestors a ON p.id = a."placementParentId"
      WHERE a.depth < 256
    )
    SELECT id, leg, depth FROM ancestors ORDER BY depth ASC
  `;

  return rows.map((r) => ({ ancestorId: r.id, leg: r.leg }));
}

/**
 * Walks up the sponsor tree from `startSponsorId` (direct sponsor) to root,
 * ordered by ascending depth (depth 1 = direct sponsor, depth 2 = sponsor's sponsor, etc.).
 */
export async function getSponsorAncestorChain(
  db: DbClient,
  startSponsorId: string
): Promise<string[]> {
  const rows = await db.$queryRaw<Array<{ id: string; depth: number }>>`
    WITH RECURSIVE sponsor_chain AS (
      SELECT
        m.id,
        m."sponsorId",
        1 AS depth
      FROM members m
      WHERE m.id = ${startSponsorId}

      UNION ALL

      SELECT
        p.id,
        p."sponsorId",
        s.depth + 1 AS depth
      FROM members p
      JOIN sponsor_chain s ON p.id = s."sponsorId"
      WHERE s.depth < 100
    )
    SELECT id, depth FROM sponsor_chain ORDER BY depth ASC
  `;
  return rows.map((r) => r.id);
}

/**
 * Counts active paid members in a member's LEFT and RIGHT placement subtrees (all depths).
 * When `asOfBoundary` is provided, only includes members activated on or before that boundary
 * so delayed EOD runs reconstruct the exact 00:00 SGT boundary headcount.
 */
export async function countSubtreeActiveMembers(
  db: DbClient,
  memberId: string,
  asOfBoundary?: Date
): Promise<{ leftCount: number; rightCount: number }> {
  const rows = asOfBoundary
    ? await db.$queryRaw<Array<{ root_leg: BinaryLeg; cnt: bigint }>>`
        WITH RECURSIVE subtree AS (
          SELECT
            m.id,
            m."placementLeg" AS root_leg,
            m.status,
            m."activatedAt",
            m."placedAt",
            1 AS depth
          FROM members m
          WHERE m."placementParentId" = ${memberId}

          UNION ALL

          SELECT
            c.id,
            s.root_leg,
            c.status,
            c."activatedAt",
            c."placedAt",
            s.depth + 1 AS depth
          FROM members c
          JOIN subtree s ON c."placementParentId" = s.id
          WHERE s.depth < 256
        )
        SELECT root_leg, COUNT(*)::bigint AS cnt
        FROM subtree
        WHERE status = 'ACTIVE'
          AND ("activatedAt" IS NULL OR "activatedAt" <= ${asOfBoundary})
          AND ("placedAt" IS NULL OR "placedAt" <= ${asOfBoundary})
        GROUP BY root_leg
      `
    : await db.$queryRaw<Array<{ root_leg: BinaryLeg; cnt: bigint }>>`
        WITH RECURSIVE subtree AS (
          SELECT
            m.id,
            m."placementLeg" AS root_leg,
            m.status,
            1 AS depth
          FROM members m
          WHERE m."placementParentId" = ${memberId}

          UNION ALL

          SELECT
            c.id,
            s.root_leg,
            c.status,
            s.depth + 1 AS depth
          FROM members c
          JOIN subtree s ON c."placementParentId" = s.id
          WHERE s.depth < 256
        )
        SELECT root_leg, COUNT(*)::bigint AS cnt
        FROM subtree
        WHERE status = 'ACTIVE'
        GROUP BY root_leg
      `;

  let leftCount = 0;
  let rightCount = 0;
  for (const row of rows) {
    if (row.root_leg === "LEFT") leftCount = Number(row.cnt);
    if (row.root_leg === "RIGHT") rightCount = Number(row.cnt);
  }
  return { leftCount, rightCount };
}

/**
 * Finds the next open binary placement slot under `rootMemberId` using BFS or extreme leg strategy.
 */
export async function findOpenPlacementSlot(
  db: DbClient,
  rootMemberId: string,
  strategy: "BFS" | "EXTREME_LEFT" | "EXTREME_RIGHT" = "BFS"
): Promise<{ parentId: string; parentCode: string; parentName: string; leg: BinaryLeg } | null> {
  const root = await db.member.findUnique({
    where: { id: rootMemberId },
    select: { id: true, memberCode: true, displayName: true, status: true },
  });
  if (!root || root.status !== "ACTIVE") return null;

  if (strategy === "EXTREME_LEFT" || strategy === "EXTREME_RIGHT") {
    const leg: BinaryLeg = strategy === "EXTREME_LEFT" ? "LEFT" : "RIGHT";
    let current = root;
    for (let depth = 0; depth < 256; depth++) {
      const child = await db.member.findFirst({
        where: { placementParentId: current.id, placementLeg: leg },
        select: { id: true, memberCode: true, displayName: true, status: true },
      });
      if (!child) {
        return {
          parentId: current.id,
          parentCode: current.memberCode,
          parentName: current.displayName,
          leg,
        };
      }
      current = child;
    }
    return null;
  }

  const queue: Array<{ id: string; memberCode: string; displayName: string }> = [
    { id: root.id, memberCode: root.memberCode, displayName: root.displayName },
  ];
  const visited = new Set<string>([root.id]);

  while (queue.length > 0 && visited.size < 1000) {
    const node = queue.shift()!;
    const children = await db.member.findMany({
      where: { placementParentId: node.id },
      select: { id: true, memberCode: true, displayName: true, placementLeg: true, status: true },
    });
    const left = children.find((c) => c.placementLeg === "LEFT");
    const right = children.find((c) => c.placementLeg === "RIGHT");

    if (!left) {
      return {
        parentId: node.id,
        parentCode: node.memberCode,
        parentName: node.displayName,
        leg: "LEFT",
      };
    }
    if (!right) {
      return {
        parentId: node.id,
        parentCode: node.memberCode,
        parentName: node.displayName,
        leg: "RIGHT",
      };
    }

    if (left.status === "ACTIVE" && !visited.has(left.id)) {
      visited.add(left.id);
      queue.push({ id: left.id, memberCode: left.memberCode, displayName: left.displayName });
    }
    if (right.status === "ACTIVE" && !visited.has(right.id)) {
      visited.add(right.id);
      queue.push({ id: right.id, memberCode: right.memberCode, displayName: right.displayName });
    }
  }

  return null;
}

/**
 * Checks whether `candidateDescendantId` sits in the placement subtree of `ancestorId`.
 */
export async function isInPlacementSubtree(
  db: DbClient,
  ancestorId: string,
  candidateId: string
): Promise<boolean> {
  if (ancestorId === candidateId) return true;
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    WITH RECURSIVE ancestors AS (
      SELECT id, "placementParentId", 1 AS depth
      FROM members
      WHERE id = ${candidateId}

      UNION ALL

      SELECT p.id, p."placementParentId", a.depth + 1 AS depth
      FROM members p
      JOIN ancestors a ON p.id = a."placementParentId"
      WHERE a.depth < 256
    )
    SELECT id FROM ancestors WHERE id = ${ancestorId} LIMIT 1
  `;
  return rows.length > 0;
}

/**
 * Checks whether `candidateId` sits in the referral (sponsor) subtree of `ancestorId`.
 */
export async function isInReferralSubtree(
  db: DbClient,
  ancestorId: string,
  candidateId: string
): Promise<boolean> {
  if (ancestorId === candidateId) return true;
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    WITH RECURSIVE ancestors AS (
      SELECT id, "sponsorId", 1 AS depth
      FROM members
      WHERE id = ${candidateId}

      UNION ALL

      SELECT s.id, s."sponsorId", a.depth + 1 AS depth
      FROM members s
      JOIN ancestors a ON s.id = a."sponsorId"
      WHERE a.depth < 256
    )
    SELECT id FROM ancestors WHERE id = ${ancestorId} LIMIT 1
  `;
  return rows.length > 0;
}
