import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function getCurrentMember() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

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
}

export async function requireMember() {
  const member = await getCurrentMember();
  if (!member) {
    redirect("/login");
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
