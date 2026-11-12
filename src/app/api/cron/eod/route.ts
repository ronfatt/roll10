import { NextResponse } from "next/server";
import { processDueUpgrades } from "@/lib/settlement/engine";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET || "";
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await processDueUpgrades({
    asOf: new Date(),
    triggeredBy: "CRON",
  });

  return NextResponse.json({ ok: true, result });
}
