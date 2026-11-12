import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiAdmin, jsonError } from "@/lib/api-auth";
import { serializeBigInt } from "@/lib/json-bigint";
import { findOpenPlacementSlot } from "@/lib/settlement/tree";
import { confirmUsdtDepositOrder, submitDepositTxId } from "@/lib/usdt/deposits";

const schema = z.object({
  action: z.enum(["RETRY_CHAIN", "CONFIRM_AND_SETTLE"]),
  txId: z.string().optional(),
  eventId: z.string().optional(),
  attributionNote: z.string().max(400).optional(),
  placementParentId: z.string().nullable().optional(),
  placementLeg: z.enum(["LEFT", "RIGHT"]).nullable().optional(),
});

export async function POST(
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
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid deposit verification request", 400);
    }

    if (parsed.data.action === "RETRY_CHAIN") {
      const order = await prisma.packageOrder.findUnique({
        where: { id },
        select: { submittedTxId: true },
      });
      const txId = parsed.data.txId?.trim() || order?.submittedTxId;
      if (!txId) {
        return jsonError("TxID is required to retry chain verification", 400);
      }
      const res = await submitDepositTxId({
        orderId: id,
        txId,
        actorId: admin.id,
        isAdmin: true,
      });
      return NextResponse.json(serializeBigInt(res));
    }

    let placementParentId = parsed.data.placementParentId ?? undefined;
    let placementLeg = parsed.data.placementLeg ?? undefined;

    if (!placementParentId) {
      const ord = await prisma.packageOrder.findUnique({
        where: { id },
        select: {
          orderType: true,
          requestedPlacementParentId: true,
          requestedPlacementLeg: true,
          member: {
            select: {
              placementParentId: true,
              placementLeg: true,
              sponsorId: true,
            },
          },
        },
      });
      if (ord?.orderType === "INITIAL" && !ord.member.placementParentId) {
        if (ord.requestedPlacementParentId && ord.requestedPlacementLeg) {
          placementParentId = ord.requestedPlacementParentId;
          placementLeg = ord.requestedPlacementLeg;
        } else {
          const rootId =
            ord.member.sponsorId ||
            (
              await prisma.member.findFirst({
                where: { status: "ACTIVE", placementParentId: null },
                select: { id: true },
              })
            )?.id;
          if (rootId) {
            const slot = await findOpenPlacementSlot(prisma, rootId, "BFS");
            if (slot) {
              placementParentId = slot.parentId;
              placementLeg = slot.leg;
            }
          }
        }
      }
    }

    const result = await confirmUsdtDepositOrder({
      orderId: id,
      operatorId: admin.id,
      eventId: parsed.data.eventId,
      attributionNote: parsed.data.attributionNote,
      placementParentId,
      placementLeg,
    });

    return NextResponse.json({ ok: true, result: serializeBigInt(result) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Deposit verification action failed";
    return jsonError(msg, msg.includes("already confirmed another order") ? 409 : 400);
  }
}
