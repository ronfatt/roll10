import { getCurrentMember } from "@/lib/session";
import { getServerT } from "@/lib/i18n-server";
import { formatSgtTimestamp } from "@/lib/sgt";
import { AppShell } from "@/components/AppShell";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const member = await getCurrentMember();
  const { locale, t } = await getServerT();
  const sgtTimeLabel = formatSgtTimestamp(new Date());

  const shellMember = member
    ? {
        memberCode: member.memberCode,
        displayName: member.displayName,
        role: member.role,
        currentPackageCode: member.currentPackageCode,
      }
    : null;

  return (
    <AppShell
      member={shellMember}
      locale={locale}
      t={t}
      sgtTimeLabel={sgtTimeLabel}
      mode="member"
    >
      {children}
    </AppShell>
  );
}
