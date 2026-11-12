import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiMember, jsonError } from "@/lib/api-auth";
import { isInReferralSubtree } from "@/lib/settlement/tree";
import {
  getReferralChildrenPage,
  getReferralNodeById,
  getReferralPathFromRoot,
  searchReferralSubtree,
} from "@/lib/tree-queries";

export async function GET(req: Request) {
  const viewer = await getApiMember();
  if (!viewer) return jsonError("Unauthorized", 401);

  const url = new URL(req.url);
  const rootIdParam = url.searchParams.get("rootId")?.trim();
  const effectiveRootId =
    viewer.role === "ADMIN" && rootIdParam ? rootIdParam : viewer.id;

  const q = url.searchParams.get("q")?.trim();
  const locateId = url.searchParams.get("locateId")?.trim();
  const parentId = url.searchParams.get("parentId")?.trim() || effectiveRootId;
  const offset = Math.max(0, Math.floor(Number(url.searchParams.get("offset") ?? 0)));
  const limit = Math.min(25, Math.max(1, Math.floor(Number(url.searchParams.get("limit") ?? 5))));

  try {
    // 1. Search within viewer's authorized referral subtree
    if (q !== undefined && q !== "") {
      const results = await searchReferralSubtree(
        effectiveRootId,
        viewer.role === "ADMIN",
        q
      );
      return NextResponse.json({
        ok: true,
        results,
        rootId: effectiveRootId,
      });
    }

    // 2. Locate target member: check authorization, return pathIds & required slices along path
    if (locateId) {
      if (viewer.role !== "ADMIN") {
        const allowed = await isInReferralSubtree(prisma, effectiveRootId, locateId);
        if (!allowed) {
          return jsonError("Target member is outside your referral tree", 403);
        }
      }

      const pathIds = await getReferralPathFromRoot(effectiveRootId, locateId);
      if (!pathIds) {
        return jsonError("Target member is outside your referral tree", 403);
      }

      // For each ancestor in pathIds (excluding leaf), fetch up to the position containing next node
      const slices: Record<
        string,
        {
          children: Awaited<ReturnType<typeof getReferralChildrenPage>>["children"];
          total: number;
          hasMore: boolean;
        }
      > = {};

      for (let i = 0; i < pathIds.length - 1; i++) {
        const ancestorId = pathIds[i];
        const nextChildId = pathIds[i + 1];
        const allSiblingsOrder = await prisma.member.findMany({
          where: { sponsorId: ancestorId },
          select: { id: true },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });
        const idx = allSiblingsOrder.findIndex((s) => s.id === nextChildId);
        const sliceLimit = Math.max(
          limit,
          Math.ceil(((idx >= 0 ? idx : 0) + 1) / limit) * limit
        );
        const page = await getReferralChildrenPage(ancestorId, 0, sliceLimit);
        slices[ancestorId] = page;
      }

      const rootNode = await getReferralNodeById(effectiveRootId);

      return NextResponse.json({
        ok: true,
        rootNode,
        targetId: locateId,
        pathIds,
        slices,
      });
    }

    // 3. Lazy-load a page of direct referrals for `parentId`
    if (viewer.role !== "ADMIN") {
      const allowed = await isInReferralSubtree(prisma, effectiveRootId, parentId);
      if (!allowed) {
        return jsonError("Target member is outside your referral tree", 403);
      }
    }

    const [parent, page] = await Promise.all([
      getReferralNodeById(parentId),
      getReferralChildrenPage(parentId, offset, limit),
    ]);

    if (!parent) {
      return jsonError("Member not found", 404);
    }

    return NextResponse.json({
      ok: true,
      parent,
      parentId,
      offset,
      limit,
      children: page.children,
      total: page.total,
      hasMore: page.hasMore,
      viewerId: viewer.id,
      rootId: effectiveRootId,
    });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Failed to query referral tree",
      500
    );
  }
}
