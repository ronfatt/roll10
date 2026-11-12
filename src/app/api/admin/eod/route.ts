import { NextResponse } from "next/server";
import { getApiAdmin, jsonError } from "@/lib/api-auth";
import { processDueUpgrades } from "@/lib/settlement/engine";
import { makeSgtDate } from "@/lib/sgt";

export async function POST(req: Request) {
  try {
    const admin = await getApiAdmin();
    if (!admin) return jsonError("Forbidden", 403);

    const body = await req.json().catch(() => ({}));
    const asOf =
      typeof body.targetCurrentSgtDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.targetCurrentSgtDate)
        ? makeSgtDate(body.targetCurrentSgtDate, "00:01:05")
        : new Date();

    const result = await processDueUpgrades({
      asOf,
      triggeredBy: "ADMIN_MANUAL",
    });

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Settlement tick failed", 400);
  }
}
