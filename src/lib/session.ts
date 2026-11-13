import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { DEFAULT_DIRECT_LOGIN_ACCOUNT, DIRECT_LOGIN_ENABLED } from "@/lib/app-config";

const DEFAULT_ADMIN_FALLBACK = {
  id: "cm7defaultadmin001",
  email: "admin@binaryportal.io",
  memberCode: "BM100001",
  displayName: "Elena Vance",
  status: "ACTIVE",
  role: "ADMIN",
  locale: "zh-CN",
  sponsorId: null,
  placementParentId: null,
  placementLeg: null,
  placementPosition: null,
  depth: 0,
  currentPackageCode: "P1000",
  pendingUpgradePackageCode: null,
  dailyCapPointsCents: 100000,
  passwordHash: "",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  currentPackage: {
    id: "pkg_p1000",
    tier: "P1000" as const,
    nameZh: "尊享配套 1000",
    nameEn: "Premium Package 1000",
    priceUsdt: 1000,
    dailyMaxCap: 1000,
    bonusValue: 1000,
    directRewardRate: 0.1,
    binaryRewardRate: 0.1,
    active: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  pendingUpgradePackage: null,
  sponsor: null,
  placementParent: null,
};

const DEFAULT_MEMBER_FALLBACK = {
  id: "cm7defaultmember002",
  email: "alex@binaryportal.io",
  memberCode: "BM100002",
  displayName: "Alex Chen",
  status: "ACTIVE",
  role: "MEMBER",
  locale: "zh-CN",
  sponsorId: "cm7defaultadmin001",
  placementParentId: "cm7defaultadmin001",
  placementLeg: "LEFT" as const,
  placementPosition: "LEFT" as const,
  depth: 1,
  currentPackageCode: "P100",
  pendingUpgradePackageCode: null,
  dailyCapPointsCents: 10000,
  passwordHash: "",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  currentPackage: {
    id: "pkg_p100",
    tier: "P100" as const,
    nameZh: "入门配套 100",
    nameEn: "Starter Package 100",
    priceUsdt: 100,
    dailyMaxCap: 100,
    bonusValue: 100,
    directRewardRate: 0.1,
    binaryRewardRate: 0.1,
    active: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  pendingUpgradePackage: null,
  sponsor: { id: "cm7defaultadmin001", memberCode: "BM100001", displayName: "Elena Vance" },
  placementParent: { id: "cm7defaultadmin001", memberCode: "BM100001", displayName: "Elena Vance" },
};

export const getCurrentMember = cache(async () => {
  let userId: string | null = null;
  try {
    const session = await auth();
    userId = session?.user?.id ?? null;
  } catch (authErr) {
    console.warn("[getCurrentMember] auth() error, falling back to direct login:", authErr);
  }

  // 1. If authenticated via NextAuth session, load that specific member
  if (userId) {
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

      if (member && member.status !== "CANCELLED" && member.status !== "SUSPENDED") {
        return member;
      }
    } catch (err) {
      console.error("[getCurrentMember] database lookup failed for user:", err);
    }
  }

  // 2. If not authenticated, but direct login is enabled (development / preview mode),
  // seamlessly load the active direct login member so the user never gets an auth blocker!
  if (DIRECT_LOGIN_ENABLED) {
    let roleChoice = "admin";
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const roleCookie = cookieStore.get("r10_direct_role")?.value;
      if (roleCookie === "member") {
        roleChoice = "member";
      }
    } catch {}

    const targetMemberCode =
      roleChoice === "member"
        ? DEFAULT_DIRECT_LOGIN_ACCOUNT.member.memberCode
        : DEFAULT_DIRECT_LOGIN_ACCOUNT.admin.memberCode;

    try {
      const fallbackMember = await prisma.member.findUnique({
        where: { memberCode: targetMemberCode },
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

      if (
        fallbackMember &&
        fallbackMember.status !== "CANCELLED" &&
        fallbackMember.status !== "SUSPENDED"
      ) {
        return fallbackMember;
      }
    } catch (err) {
      console.error("[getCurrentMember] database lookup failed, using static direct member:", err);
    }

    // Static in-memory member fallback if DB is unreachable
    return roleChoice === "member" ? (DEFAULT_MEMBER_FALLBACK as any) : (DEFAULT_ADMIN_FALLBACK as any);
  }

  return null;
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
