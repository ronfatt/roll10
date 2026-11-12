import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiMember, jsonError } from "@/lib/api-auth";
import { countSubtreeActiveMembers, isInPlacementSubtree } from "@/lib/settlement/tree";

interface TreeNodeDto {
  id: string;
  memberCode: string;
  displayName: string;
  status: string;
  packageCode: string | null;
  placementParentId: string | null;
  placementLeg: "LEFT" | "RIGHT" | null;
  leftBv: number;
  rightBv: number;
  leftCount: number;
  rightCount: number;
  left: TreeNodeDto | null;
  right: TreeNodeDto | null;
}

async function buildTreeNode(memberId: string, depth: number, maxDepth: number): Promise<TreeNodeDto | null> {
  const m = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      memberCode: true,
      displayName: true,
      status: true,
      currentPackageCode: true,
      placementParentId: true,
      placementLeg: true,
      leftBv: true,
      rightBv: true,
    },
  });
  if (!m) return null;

  const { leftCount, rightCount } = await countSubtreeActiveMembers(prisma, m.id);

  let left: TreeNodeDto | null = null;
  let right: TreeNodeDto | null = null;

  if (depth < maxDepth) {
    const children = await prisma.member.findMany({
      where: { placementParentId: m.id },
      select: { id: true, placementLeg: true },
    });
    const leftChild = children.find((c) => c.placementLeg === "LEFT");
    const rightChild = children.find((c) => c.placementLeg === "RIGHT");
    if (leftChild) left = await buildTreeNode(leftChild.id, depth + 1, maxDepth);
    if (rightChild) right = await buildTreeNode(rightChild.id, depth + 1, maxDepth);
  }

  return {
    id: m.id,
    memberCode: m.memberCode,
    displayName: m.displayName,
    status: m.status,
    packageCode: m.currentPackageCode,
    placementParentId: m.placementParentId,
    placementLeg: m.placementLeg,
    leftBv: m.leftBv,
    rightBv: m.rightBv,
    leftCount,
    rightCount,
    left,
    right,
  };
}

export async function GET(req: Request) {
  const viewer = await getApiMember();
  if (!viewer) return jsonError("Unauthorized", 401);

  const url = new URL(req.url);
  const query = url.searchParams.get("q")?.trim();
  const focusIdParam = url.searchParams.get("focusId")?.trim();
  const maxDepth = Math.min(4, Math.max(1, Number(url.searchParams.get("depth") ?? 3)));

  let focusId = focusIdParam || viewer.id;

  if (query) {
    const target = await prisma.member.findFirst({
      where: {
        OR: [
          { memberCode: { equals: query.toUpperCase(), mode: "insensitive" } },
          { displayName: { contains: query, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (!target) {
      return jsonError("Member not found", 404);
    }
    focusId = target.id;
  }

  // Non-admins can only view nodes within their own placement subtree
  if (viewer.role !== "ADMIN") {
    const allowed = await isInPlacementSubtree(prisma, viewer.id, focusId);
    if (!allowed) {
      return jsonError("Target member is outside your placement subtree", 403);
    }
  }

  const tree = await buildTreeNode(focusId, 0, maxDepth);
  if (!tree) return jsonError("Node not found", 404);

  return NextResponse.json({ ok: true, tree, viewerId: viewer.id });
}
