import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getServerLocale } from "@/lib/i18n-server";
import { AdminMembersClient } from "@/components/admin/AdminMembersClient";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const admin = await requireAdmin();
  const locale = await getServerLocale();

  const rawMembers = await prisma.member.findMany({
    include: {
      sponsor: { select: { memberCode: true } },
      placementParent: { select: { memberCode: true } },
    },
    orderBy: { memberCode: "asc" },
    take: 200,
  });

  return (
    <AdminMembersClient
      locale={locale}
      currentAdminId={admin.id}
      members={rawMembers.map((m) => ({
        id: m.id,
        memberCode: m.memberCode,
        email: m.email,
        displayName: m.displayName,
        role: m.role,
        status: m.status,
        sponsorCode: m.sponsor?.memberCode ?? null,
        placementParentCode: m.placementParent?.memberCode ?? null,
        placementLeg: m.placementLeg,
        currentPackageCode: m.currentPackageCode,
        leftBv: m.leftBv,
        rightBv: m.rightBv,
        availablePointsCents: m.availablePointsCents,
        lockedPointsCents: m.lockedPointsCents,
      }))}
    />
  );
}
