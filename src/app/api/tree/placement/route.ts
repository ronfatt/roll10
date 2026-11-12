import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiMember, jsonError } from "@/lib/api-auth";
import { isInPlacementSubtree } from "@/lib/settlement/tree";
import {
  getPlacementBreadcrumbs,
  getPlacementNodeDto,
  searchPlacementSubtree,
} from "@/lib/tree-queries";

export async function GET(req: Request) {
  const viewer = await getApiMember();
  if (!viewer) return jsonError("Unauthorized", 401);

  const url = new URL(req.url);
  const rootIdParam = url.searchParams.get("rootId")?.trim();
  const effectiveRootId =
    viewer.role === "ADMIN" && rootIdParam ? rootIdParam : viewer.id;

  const q = url.searchParams.get("q")?.trim();
  const focusId = url.searchParams.get("focusId")?.trim() || effectiveRootId;

  try {
    // 1. Search within viewer's authorized placement subtree
    if (q !== undefined && q !== "") {
      const results = await searchPlacementSubtree(effectiveRootId, q);
      return NextResponse.json({
        ok: true,
        results,
        rootId: effectiveRootId,
      });
    }

    // 2. Authorization check for focus node
    if (viewer.role !== "ADMIN") {
      const allowed = await isInPlacementSubtree(prisma, effectiveRootId, focusId);
      if (!allowed) {
        return jsonError("Target member is outside your placement subtree", 403);
      }
    }

    // 3. Lazy-load ONLY the focus node and its immediate Left / Right slots
    const childRefs = await prisma.member.findMany({
      where: { placementParentId: focusId },
      select: { id: true, placementLeg: true },
    });
    const leftRef = childRefs.find((c) => c.placementLeg === "LEFT");
    const rightRef = childRefs.find((c) => c.placementLeg === "RIGHT");

    const isAdmin = viewer.role === "ADMIN";
    const [rootOverviewNode, focusNode, leftNode, rightNode, breadcrumbs] =
      await Promise.all([
        getPlacementNodeDto(effectiveRootId, isAdmin, effectiveRootId),
        getPlacementNodeDto(effectiveRootId, isAdmin, focusId),
        leftRef ? getPlacementNodeDto(effectiveRootId, isAdmin, leftRef.id) : Promise.resolve(null),
        rightRef ? getPlacementNodeDto(effectiveRootId, isAdmin, rightRef.id) : Promise.resolve(null),
        getPlacementBreadcrumbs(effectiveRootId, focusId),
      ]);

    if (!focusNode) {
      return jsonError("Member not found", 404);
    }

    return NextResponse.json({
      ok: true,
      viewerId: viewer.id,
      rootId: effectiveRootId,
      rootOverview: rootOverviewNode
        ? {
            leftBv: rootOverviewNode.leftBv ?? 0,
            rightBv: rootOverviewNode.rightBv ?? 0,
            leftCount: rootOverviewNode.leftCount,
            rightCount: rootOverviewNode.rightCount,
          }
        : null,
      focus: focusNode,
      left: leftNode,
      right: rightNode,
      breadcrumbs,
    });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Failed to query placement tree",
      500
    );
  }
}
