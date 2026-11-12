import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiAdmin, jsonError } from "@/lib/api-auth";
import { confirmPackageOrder } from "@/lib/settlement/engine";

const schema = z.object({
  placementParentId: z.string().nullable().optional(),
  placementLeg: z.enum(["LEFT", "RIGHT"]).nullable().optional(),
  markPaidDemo: z.boolean().optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getApiAdmin();
    if (!admin) return jsonError("Forbidden", 403);
    const { id } = await context.params;

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid confirmation input", 400);
    }

    const result = await confirmPackageOrder({
      orderId: id,
      operatorId: admin.id,
      placementParentId: parsed.data.placementParentId,
      placementLeg: parsed.data.placementLeg,
      markPaidDemo: parsed.data.markPaidDemo,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason, result }, { status: 400 });
    }

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Order confirmation failed", 400);
  }
}
