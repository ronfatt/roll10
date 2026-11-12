import { cookies } from "next/headers";
import { getDictionary, type Locale } from "./i18n";

export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const val = cookieStore.get("bmp_locale")?.value;
  return val === "zh-CN" ? "zh-CN" : "en";
}

export async function getServerT() {
  const locale = await getServerLocale();
  return { locale, t: getDictionary(locale) };
}
