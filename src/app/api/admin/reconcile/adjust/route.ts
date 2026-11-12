import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiAdmin, jsonError } from "@/lib/api-auth";
import { adjustMemberBalance } from "@/lib/settlement/engine";

const schema = z.object({
  memberId: z.string().min(1),
  kind: z.enum(["POINTS", "BV"]),
  deltaPoints: z.number().optional(),
  leg: z.enum(["LEFT", "RIGHT"]).optional(),
  deltaBv: z.number().int().optional(),
  reason: z.string().min(3).max(200),
});

export async function POST(req: Request) {
  try {
    const admin = await getApiAdmin();
    if (!admin) return jsonError("Forbidden", 403);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid adjustment input", 400);
    }

    const result = await adjustMemberBalance({
      memberId: parsed.data.memberId,
      operatorId: admin.id,
      kind: parsed.data.kind,
      deltaPointsCents:
        parsed.data.deltaPoints !== undefined ? Math.round(parsed.data.deltaPoints * 100) : undefined,
      leg: parsed.data.leg,
      deltaBv: parsed.data.deltaBv,
      reason: parsed.data.reason,
    });

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Balance adjustment failed", 400);
  }
}
