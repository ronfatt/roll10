import { headers } from "next/headers";
import { requireMember } from "@/lib/session";
import { getServerT } from "@/lib/i18n-server";
import { loadPortalHomeData } from "@/lib/portal-home";
import { HomeClient } from "@/components/portal/HomeClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ simulateError?: string; activated?: string }>;
}) {
  const member = await requireMember();
  const { locale, t } = await getServerT();
  const params = await searchParams;
  const headerList = await headers();
  const host = headerList.get("host") || "localhost:3000";
  const proto =
    host.includes("localhost") || host.startsWith("127.") ? "http" : "https";
  const referralLink = `${proto}://${host}/register?ref=${member.memberCode}`;

  const initialErrorBase =
    params?.simulateError === "1" ? t.common.loadError : null;
  const justActivated = params?.activated === "1";

  let initialData = null;
  let initialError = initialErrorBase;
  if (!initialErrorBase) {
    try {
      initialData = await loadPortalHomeData(member.id, locale);
    } catch (err) {
      console.error("[DashboardPage] loadPortalHomeData failed:", err);
      initialError = t.common.loadError;
    }
  }

  return (
    <HomeClient
      t={t}
      locale={locale}
      referralLink={referralLink}
      initialData={initialData}
      initialError={initialError}
      justActivated={justActivated}
    />
  );
}
