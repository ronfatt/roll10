import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getServerT } from "@/lib/i18n-server";
import { LocaleToggle } from "@/components/LocaleToggle";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/dashboard");
  }
  const { locale, t } = await getServerT();
  const params = await searchParams;
  const initialRef = params.ref?.trim().toUpperCase();

  let sponsorDisplayName: string | null = null;
  if (initialRef) {
    const sponsor = await prisma.member.findUnique({
      where: { memberCode: initialRef },
      select: { displayName: true, status: true },
    });
    if (sponsor && sponsor.status === "ACTIVE") {
      sponsorDisplayName = sponsor.displayName;
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#08090B] bg-[radial-gradient(ellipse_at_top,rgba(203,180,135,0.08),transparent_60%)] px-4 py-10">
      <div className="absolute right-4 top-4 sm:right-8 sm:top-6">
        <LocaleToggle locale={locale} />
      </div>
      <RegisterForm
        t={t}
        initialRef={initialRef}
        sponsorDisplayName={sponsorDisplayName}
      />
    </div>
  );
}
