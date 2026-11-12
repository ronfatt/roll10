import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiAdmin, jsonError } from "@/lib/api-auth";

const schema = z.object({
  role: z.enum(["MEMBER", "ADMIN"]).optional(),
  status: z.enum(["PENDING_PAYMENT", "ACTIVE", "SUSPENDED", "CANCELLED"]).optional(),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getApiAdmin();
    if (!admin) return jsonError("Forbidden", 403);
    const { id } = await context.params;

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid member update", 400);
    }

    if (id === admin.id && parsed.data.role === "MEMBER") {
      return jsonError("Cannot demote your own admin role", 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const m = await tx.member.update({
        where: { id },
        data: parsed.data,
        select: { id: true, memberCode: true, role: true, status: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorRole: "ADMIN",
          action: "MEMBER_UPDATE",
          entityType: "Member",
          entityId: id,
          summary: `Updated member ${m.memberCode}: role=${m.role}, status=${m.status}`,
          metadata: parsed.data,
        },
      });
      return m;
    });

    return NextResponse.json({ ok: true, member: updated });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Member update failed", 400);
  }
}
