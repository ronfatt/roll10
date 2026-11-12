import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiMember, jsonError } from "@/lib/api-auth";
import { createPackageOrder } from "@/lib/settlement/engine";
import { serializeBigInt } from "@/lib/json-bigint";
import { prisma } from "@/lib/db";

const createOrderSchema = z.object({
  orderType: z.enum(["INITIAL", "UPGRADE"]),
  targetPackageCode: z.enum(["P100", "P500", "P1000"]),
  paymentMethod: z.enum(["USDT", "MANUAL"]).optional(),
  payImmediatelyDemo: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const member = await getApiMember();
    if (!member) return jsonError("Unauthorized", 401);

    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid order request", 400);
    }

    const order = await createPackageOrder({
      memberId: member.id,
      orderType: parsed.data.orderType,
      targetPackageCode: parsed.data.targetPackageCode,
      paymentMethod: parsed.data.paymentMethod ?? "USDT",
      payImmediatelyDemo: parsed.data.payImmediatelyDemo ?? false,
    });

    return NextResponse.json({ ok: true, order: serializeBigInt(order) });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Order creation failed", 400);
  }
}

export async function GET() {
  const member = await getApiMember();
  if (!member) return jsonError("Unauthorized", 401);

  const orders = await prisma.packageOrder.findMany({
    where: { memberId: member.id },
    include: { targetPackage: true, previousPackage: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ ok: true, orders: serializeBigInt(orders) });
}
