import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { DIRECT_LOGIN_ENABLED } from "@/lib/app-config";

export const getCurrentMember = cache(async () => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  try {
    const member = await prisma.member.findUnique({
      where: { id: userId },
      include: {
        currentPackage: true,
        pendingUpgradePackage: true,
        sponsor: {
          select: { id: true, memberCode: true, displayName: true },
        },
        placementParent: {
          select: { id: true, memberCode: true, displayName: true },
        },
      },
    });

    if (!member || member.status === "CANCELLED" || member.status === "SUSPENDED") {
      return null;
    }
    return member;
  } catch (err) {
    console.error("[getCurrentMember] database lookup failed:", err);
    return null;
  }
});

export async function requireMember() {
  const member = await getCurrentMember();
  if (!member) {
    redirect(DIRECT_LOGIN_ENABLED ? "/login?auto=1" : "/login");
  }
  return member;
}

export async function requireAdmin() {
  const member = await requireMember();
  if (member.role !== "ADMIN") {
    redirect("/dashboard");
  }
  return member;
}
