import { NextResponse } from "next/server";
import { requireMember } from "@/lib/session";
import { getServerT } from "@/lib/i18n-server";
import { loadPortalHomeData } from "@/lib/portal-home";

export async function GET(req: Request) {
  try {
    const member = await requireMember();
    const { locale } = await getServerT();
    const { searchParams } = new URL(req.url);

    if (searchParams.get("simulateError") === "1") {
      return NextResponse.json(
        { ok: false, error: "Simulated upstream settlement sync timeout" },
        { status: 503 }
      );
    }

    let asOfOverride: Date | undefined = undefined;
    const rawAsOf = searchParams.get("asOf");
    if (
      rawAsOf &&
      (process.env.NODE_ENV !== "production" ||
        process.env.ROLL10_ALLOW_TEST_CLOCK === "1")
    ) {
      const parsed = new Date(rawAsOf);
      if (!Number.isNaN(parsed.getTime())) {
        asOfOverride = parsed;
      }
    }

    const payload = await loadPortalHomeData(member.id, locale, asOfOverride);
    if (!payload) {
      return NextResponse.json({ ok: false, error: "Member not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: payload });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to load home data" },
      { status: 500 }
    );
  }
}
