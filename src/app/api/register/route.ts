import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateNextMemberCode } from "@/lib/member-code";
import { getSgtDateString } from "@/lib/sgt";
import { createPackageOrder } from "@/lib/settlement/engine";
import { jsonError } from "@/lib/api-auth";

const registerSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2).max(60),
  password: z.string().min(6).max(100),
  sponsorCode: z.string().min(3).max(24),
  packageCode: z.enum(["P100", "P500", "P1000"]).optional(),
  cpAmountU: z.number().min(0).optional(),
  payerMemberId: z.string().optional(),
  payImmediatelyDemo: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid registration input", 400);
    }

    const email = parsed.data.email.trim().toLowerCase();
    const sponsorCode = parsed.data.sponsorCode.trim().toUpperCase();

    const existing = await prisma.member.findUnique({ where: { email } });
    if (existing) {
      return jsonError("Email is already registered", 409);
    }

    const sponsor = await prisma.member.findUnique({
      where: { memberCode: sponsorCode },
    });
    if (!sponsor || sponsor.status !== "ACTIVE") {
      return jsonError("Sponsor member code not found or not active", 400);
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const sgtDate = getSgtDateString(new Date());

    const member = await prisma.$transaction(async (tx) => {
      const memberCode = await generateNextMemberCode(tx);
      const created = await tx.member.create({
        data: {
          memberCode,
          email,
          passwordHash,
          displayName: parsed.data.displayName.trim(),
          role: "MEMBER",
          status: "PENDING_PAYMENT",
          sponsorId: sponsor.id,
          activeSettlementDate: sgtDate,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: created.id,
          actorRole: "MEMBER",
          action: "MEMBER_REGISTER",
          entityType: "Member",
          entityId: created.id,
          summary: `Registered ${created.memberCode} (${created.email}) sponsored by ${sponsor.memberCode}`,
          metadata: { sponsorId: sponsor.id, sponsorCode: sponsor.memberCode },
        },
      });
      return created;
    });

    let order = null;
    if (parsed.data.packageCode) {
      order = await createPackageOrder({
        memberId: member.id,
        orderType: "INITIAL",
        targetPackageCode: parsed.data.packageCode,
        paymentMethod: "USDT",
        requestedCpU: parsed.data.cpAmountU ?? 0,
        payerMemberId: parsed.data.payerMemberId ?? null,
        payImmediatelyDemo: false,
      });
    }

    return NextResponse.json({
      ok: true,
      member: {
        id: member.id,
        memberCode: member.memberCode,
        email: member.email,
        displayName: member.displayName,
      },
      order: order
        ? { id: order.id, orderNo: order.orderNo, status: order.status }
        : null,
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Registration failed", 500);
  }
}
