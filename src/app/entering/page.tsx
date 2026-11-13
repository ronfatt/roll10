import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getServerLocale } from "@/lib/i18n-server";
import { MarbleRaceLoader } from "@/components/MarbleRaceLoader";
import { DIRECT_LOGIN_ENABLED } from "@/lib/app-config";

export const dynamic = "force-dynamic";

export default async function EnteringDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(DIRECT_LOGIN_ENABLED ? "/login?auto=1" : "/login");
  }

  const locale = await getServerLocale();
  return <MarbleRaceLoader locale={locale} targetHref="/dashboard" durationMs={1400} />;
}
