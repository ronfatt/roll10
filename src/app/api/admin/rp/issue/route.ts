import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiMember, jsonError } from "@/lib/api-auth";
import { getSgtDateString } from "@/lib/sgt";

const issueRpSchema = z.object({
  memberCode: z.string().min(3),
  rpAmount: z.number().int().positive(),
  receiptNo: z.string().min(2),
  note: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const admin = await getApiMember();
    if (!admin || admin.role !== "ADMIN") {
      return jsonError("Unauthorized: Admin privileges required", 403);
    }

    const body = await req.json();
    const parsed = issueRpSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid RP issuance input", 400);
    }

    const member = await prisma.member.findUnique({
      where: { memberCode: parsed.data.memberCode.trim().toUpperCase() },
    });
    if (!member) {
      return jsonError(`Member ${parsed.data.memberCode} not found`, 404);
    }

    const rpCents = parsed.data.rpAmount * 100;
    const sgtDate = getSgtDateString(new Date());

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.member.update({
        where: { id: member.id },
        data: {
          rpBalanceCents: (member.rpBalanceCents || 0) + rpCents,
        },
      });

      const note = `Company RP sale / issuance (${parsed.data.receiptNo}): ${parsed.data.rpAmount} RP. ${parsed.data.note || ""}`.trim();

      await tx.walletLedger.create({
        data: {
          ledgerNo: `RP-${sgtDate.replace(/-/g, "")}-${Date.now().toString().slice(-4)}`,
          eventKey: `rp_issue:${parsed.data.receiptNo}:${member.id}`,
          memberId: member.id,
          operatorId: admin.id,
          entryType: "RP_ISSUANCE",
          deltaAvailableCents: 0,
          deltaLockedCents: 0,
          availableAfterCents: member.availablePointsCents,
          lockedAfterCents: member.lockedPointsCents,
          note,
          createdAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorRole: "ADMIN",
          action: "RP_ISSUANCE",
          entityType: "Member",
          entityId: member.id,
          summary: `Admin ${admin.memberCode} issued ${parsed.data.rpAmount} RP to ${member.memberCode} (Receipt: ${parsed.data.receiptNo})`,
          metadata: {
            memberCode: member.memberCode,
            rpAmount: parsed.data.rpAmount,
            receiptNo: parsed.data.receiptNo,
            newRpBalance: updated.rpBalanceCents / 100,
          },
        },
      });

      return updated;
    });

    return NextResponse.json({
      ok: true,
      memberCode: result.memberCode,
      rpBalance: result.rpBalanceCents / 100,
      rpBalanceCents: result.rpBalanceCents,
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "RP issuance failed", 500);
  }
}
