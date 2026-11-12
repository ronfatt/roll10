import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getServerLocale } from "@/lib/i18n-server";
import { MarbleRaceLoader } from "@/components/MarbleRaceLoader";

export const dynamic = "force-dynamic";

export default async function EnteringDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const locale = await getServerLocale();
  return <MarbleRaceLoader locale={locale} targetHref="/dashboard" />;
}
