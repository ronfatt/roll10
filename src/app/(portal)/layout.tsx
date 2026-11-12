import { requireMember } from "@/lib/session";
import { getServerT } from "@/lib/i18n-server";
import { formatSgtTimestamp } from "@/lib/sgt";
import { AppShell } from "@/components/AppShell";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const member = await requireMember();
  const { locale, t } = await getServerT();
  const sgtTimeLabel = formatSgtTimestamp(new Date());

  return (
    <AppShell
      member={{
        memberCode: member.memberCode,
        displayName: member.displayName,
        role: member.role,
        currentPackageCode: member.currentPackageCode,
      }}
      locale={locale}
      t={t}
      sgtTimeLabel={sgtTimeLabel}
      mode="member"
    >
      {children}
    </AppShell>
  );
}
