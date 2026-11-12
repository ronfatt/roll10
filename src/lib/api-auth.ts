import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function getApiMember() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const member = await prisma.member.findUnique({
    where: { id: userId },
  });
  if (!member || member.status === "CANCELLED" || member.status === "SUSPENDED") {
    return null;
  }
  return member;
}

export async function getApiAdmin() {
  const member = await getApiMember();
  if (!member || member.role !== "ADMIN") return null;
  return member;
}

export function jsonError(message: string, status: number = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
