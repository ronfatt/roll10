import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/session";
import { getServerT } from "@/lib/i18n-server";
import { TeamClient } from "@/components/portal/TeamClient";

export const dynamic = "force-dynamic";

export default async function TreePage({
  searchParams,
}: {
  searchParams: Promise<{ focusId?: string; tab?: string; leg?: string }>;
}) {
  const member = await requireMember();
  const { t } = await getServerT();
  const params = await searchParams;

  let initialFocusId =
    member.role === "ADMIN" && params.focusId ? params.focusId : member.id;
  const initialTab =
    params.tab === "placement" || params.tab === "binary"
      ? "placement"
      : "referral";

  if (
    initialTab === "placement" &&
    (params.leg === "LEFT" || params.leg === "RIGHT")
  ) {
    const legChild = await prisma.member.findFirst({
      where: { placementParentId: member.id, placementLeg: params.leg },
      select: { id: true },
    });
    if (legChild) {
      initialFocusId = legChild.id;
    }
  }

  const headerList = await headers();
  const host = headerList.get("host") || "localhost:3000";
  const proto =
    host.includes("localhost") || host.startsWith("127.") ? "http" : "https";
  const referralLink = `${proto}://${host}/register?ref=${member.memberCode}`;

  return (
    <TeamClient
      t={t}
      initialFocusId={initialFocusId}
      viewerId={member.id}
      viewerMemberCode={member.memberCode}
      referralLink={referralLink}
      initialTab={initialTab}
    />
  );
}
