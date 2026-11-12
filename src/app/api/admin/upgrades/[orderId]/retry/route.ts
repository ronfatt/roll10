import { NextResponse } from "next/server";
import { getApiAdmin, jsonError } from "@/lib/api-auth";
import { retryUpgradeActivation } from "@/lib/settlement/engine";

export async function POST(
  _req: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const admin = await getApiAdmin();
    if (!admin) return jsonError("Forbidden", 403);
    const { orderId } = await context.params;

    const result = await retryUpgradeActivation({
      orderId,
      operatorId: admin.id,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason, result }, { status: 400 });
    }
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Upgrade retry failed", 400);
  }
}
