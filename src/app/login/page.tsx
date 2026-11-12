import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getServerT } from "@/lib/i18n-server";
import { LocaleToggle } from "@/components/LocaleToggle";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/dashboard");
  }
  const { locale, t } = await getServerT();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#08090B] bg-[radial-gradient(ellipse_at_top,rgba(203,180,135,0.08),transparent_60%)] px-4 py-10">
      <div className="absolute right-4 top-4 sm:right-8 sm:top-6">
        <LocaleToggle locale={locale} />
      </div>
      <LoginForm t={t} />
    </div>
  );
}
