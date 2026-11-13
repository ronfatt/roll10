import { getServerLocale } from "@/lib/i18n-server";
import { ArcadeClient } from "@/components/portal/ArcadeClient";

export const dynamic = "force-dynamic";

export default async function ArcadePage() {
  const locale = await getServerLocale();
  return <ArcadeClient locale={locale} />;
}
