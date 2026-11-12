import { auth } from "@/auth";
import { getServerLocale } from "@/lib/i18n-server";
import { LandingClient } from "@/components/landing/LandingClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [session, locale] = await Promise.all([auth(), getServerLocale()]);
  const isAuthenticated = Boolean(session?.user?.id);

  return <LandingClient locale={locale} isAuthenticated={isAuthenticated} />;
}
