import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiMember, jsonError } from "@/lib/api-auth";
import { submitDepositTxId } from "@/lib/usdt/deposits";

const schema = z.object({
  txId: z.string().min(10).max(160),
  proofNote: z.string().max(300).optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const viewer = await getApiMember();
    if (!viewer) return jsonError("Unauthorized", 401);

    const { id } = await context.params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid TxID submission", 400);
    }

    const result = await submitDepositTxId({
      orderId: id,
      txId: parsed.data.txId,
      proofNote: parsed.data.proofNote,
      actorId: viewer.id,
      isAdmin: viewer.role === "ADMIN",
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to verify TxID";
    const status = msg.startsWith("Forbidden")
      ? 403
      : msg.includes("already been used")
        ? 409
        : 400;
    return jsonError(msg, status);
  }
}
