import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiAdmin, jsonError } from "@/lib/api-auth";
import { findOpenPlacementSlot } from "@/lib/settlement/tree";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getApiAdmin();
  if (!admin) return jsonError("Forbidden", 403);
  const { id } = await context.params;

  const order = await prisma.packageOrder.findUnique({
    where: { id },
    include: { member: true },
  });
  if (!order) return jsonError("Order not found", 404);

  const url = new URL(req.url);
  const strategy = (url.searchParams.get("strategy") ?? "BFS") as
    | "BFS"
    | "EXTREME_LEFT"
    | "EXTREME_RIGHT";

  const rootId =
    order.member.sponsorId ||
    (await prisma.member.findFirst({
      where: { status: "ACTIVE", placementParentId: null },
      select: { id: true },
    }))?.id;

  if (!rootId) {
    return NextResponse.json({ ok: true, slot: null });
  }

  const slot = await findOpenPlacementSlot(prisma, rootId, strategy);
  return NextResponse.json({ ok: true, slot });
}
