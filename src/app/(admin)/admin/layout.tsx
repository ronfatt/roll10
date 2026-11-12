import { requireAdmin } from "@/lib/session";
import { getServerT } from "@/lib/i18n-server";
import { formatSgtTimestamp } from "@/lib/sgt";
import { AppShell } from "@/components/AppShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  const { locale, t } = await getServerT();

  return (
    <AppShell
      member={{
        memberCode: admin.memberCode,
        displayName: admin.displayName,
        role: admin.role,
        currentPackageCode: admin.currentPackageCode,
      }}
      locale={locale}
      t={t}
      sgtTimeLabel={formatSgtTimestamp(new Date())}
      mode="admin"
    >
      {children}
    </AppShell>
  );
}
