import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiMember, jsonError } from "@/lib/api-auth";
import { serializeBigInt } from "@/lib/json-bigint";
import { requestWithdrawal } from "@/lib/settlement/withdrawals";

const withdrawalSchema = z.object({
  requestedPoints: z.number().positive().max(1_000_000),
  payoutDestination: z.string().min(10).max(160),
  saveAddress: z.boolean().optional(),
  addressLabel: z.string().max(60).optional(),
});

export async function POST(req: Request) {
  try {
    const member = await getApiMember();
    if (!member) return jsonError("Unauthorized", 401);

    const body = await req.json();
    const parsed = withdrawalSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid withdrawal input", 400);
    }

    const requestedPointsCents = Math.round(parsed.data.requestedPoints * 100);
    if (requestedPointsCents <= 0) {
      return jsonError("Withdrawal amount must be positive", 400);
    }

    const withdrawal = await requestWithdrawal({
      memberId: member.id,
      requestedPointsCents,
      payoutDestination: parsed.data.payoutDestination,
      saveAddress: parsed.data.saveAddress,
      addressLabel: parsed.data.addressLabel,
      strictAddressCheck: true,
    });

    return NextResponse.json({ ok: true, withdrawal: serializeBigInt(withdrawal) });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Withdrawal request failed", 400);
  }
}
