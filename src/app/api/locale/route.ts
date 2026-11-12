import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const locale = body.locale === "zh-CN" ? "zh-CN" : "en";
  const res = NextResponse.json({ ok: true, locale });
  res.cookies.set("bmp_locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}
