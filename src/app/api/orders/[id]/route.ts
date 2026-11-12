import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiMember, jsonError } from "@/lib/api-auth";
import { serializeBigInt } from "@/lib/json-bigint";
import { formatSgtTimestamp } from "@/lib/sgt";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const viewer = await getApiMember();
  if (!viewer) return jsonError("Unauthorized", 401);

  const { id } = await context.params;
  const order = await prisma.packageOrder.findUnique({
    where: { id },
    include: {
      targetPackage: true,
      previousPackage: true,
      matchedDepositEvent: true,
      depositTransferEvents: {
        orderBy: [{ createdAt: "desc" }, { eventIndex: "asc" }],
        take: 10,
      },
    },
  });

  if (!order) return jsonError("Order not found", 404);
  if (viewer.role !== "ADMIN" && order.memberId !== viewer.id) {
    return jsonError("Forbidden", 403);
  }

  return NextResponse.json({
    ok: true,
    order: serializeBigInt({
      ...order,
      chainConfirmedAtLabel: order.chainConfirmedAt
        ? formatSgtTimestamp(order.chainConfirmedAt)
        : null,
      confirmedAtLabel: order.confirmedAt
        ? formatSgtTimestamp(order.confirmedAt)
        : null,
      effectiveAtLabel: order.effectiveAt
        ? formatSgtTimestamp(order.effectiveAt)
        : null,
      createdAtLabel: formatSgtTimestamp(order.createdAt),
    }),
  });
}
