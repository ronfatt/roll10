import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiAdmin, jsonError } from "@/lib/api-auth";
import { assignOrderPlacement } from "@/lib/settlement/engine";

const schema = z.object({
  placementParentId: z.string().min(1),
  placementLeg: z.enum(["LEFT", "RIGHT"]),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getApiAdmin();
    if (!admin) return jsonError("Forbidden", 403);
    const { id } = await context.params;

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid placement input", 400);
    }

    const order = await assignOrderPlacement({
      orderId: id,
      placementParentId: parsed.data.placementParentId,
      placementLeg: parsed.data.placementLeg,
      operatorId: admin.id,
    });

    return NextResponse.json({ ok: true, order });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Placement assignment failed", 400);
  }
}
