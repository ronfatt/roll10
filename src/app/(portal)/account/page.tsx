import { headers } from "next/headers";
import { requireMember } from "@/lib/session";
import { getServerT } from "@/lib/i18n-server";
import { AccountClient } from "@/components/portal/AccountClient";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const member = await requireMember();
  const { locale, t } = await getServerT();

  const headerList = await headers();
  const host = headerList.get("host") || "localhost:3000";
  const proto =
    host.includes("localhost") || host.startsWith("127.") ? "http" : "https";
  const referralLink = `${proto}://${host}/register?ref=${member.memberCode}`;

  return (
    <AccountClient
      t={t}
      locale={locale}
      referralLink={referralLink}
      member={{
        memberCode: member.memberCode,
        email: member.email,
        displayName: member.displayName,
        role: member.role,
        status: member.status,
        currentPackageCode: member.currentPackageCode,
        pendingUpgradePackageCode: member.pendingUpgradePackageCode,
      }}
    />
  );
}
