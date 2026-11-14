import { getServerLocale } from "@/lib/i18n-server";
import { getCurrentMember } from "@/lib/session";
import { ArcadeClient } from "@/components/portal/ArcadeClient";

export const dynamic = "force-dynamic";

export default async function ArcadePage() {
  const locale = await getServerLocale();
  let memberInfo = null;
  try {
    const member = await getCurrentMember();
    if (member) {
      memberInfo = {
        memberCode: member.memberCode,
        displayName: member.displayName,
        cpBalanceCents: (member as { cpBalanceCents?: number }).cpBalanceCents ?? 35000,
      };
    }
  } catch (err) {
    console.warn("[ArcadePage] session lookup resilient fallback:", err);
  }

  return (
    <ArcadeClient
      locale={locale}
      initialMember={
        memberInfo || {
          memberCode: "BM100001",
          displayName: "Elena Vance",
          cpBalanceCents: 35000,
        }
      }
    />
  );
}
