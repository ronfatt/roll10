import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiAdmin, jsonError } from "@/lib/api-auth";
import { serializeBigInt } from "@/lib/json-bigint";
import { prisma } from "@/lib/db";
import {
  approveWithdrawal,
  claimWithdrawal,
  markWithdrawalPaid,
  markWithdrawalPendingCheck,
  rejectWithdrawal,
  submitWithdrawalPayoutTx,
} from "@/lib/settlement/withdrawals";

const schema = z.object({
  action: z.enum([
    "CLAIM",
    "TAKEOVER",
    "APPROVE",
    "SUBMIT_TX",
    "RETRY_TX",
    "MARK_PENDING_CHECK",
    "PAY",
    "REJECT",
  ]),
  reason: z.string().optional(),
  payoutTxRef: z.string().optional(),
  takeoverNote: z.string().optional(),
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
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid withdrawal action", 400);
    }

    if (parsed.data.action === "CLAIM" || parsed.data.action === "TAKEOVER") {
      const withdrawal = await claimWithdrawal({
        withdrawalId: id,
        operatorId: admin.id,
        forceTakeover: parsed.data.action === "TAKEOVER",
        takeoverNote: parsed.data.takeoverNote,
      });
      return NextResponse.json({ ok: true, withdrawal: serializeBigInt(withdrawal) });
    }

    if (parsed.data.action === "APPROVE") {
      const withdrawal = await approveWithdrawal({
        withdrawalId: id,
        operatorId: admin.id,
      });
      return NextResponse.json({ ok: true, withdrawal: serializeBigInt(withdrawal) });
    }

    if (parsed.data.action === "SUBMIT_TX" || parsed.data.action === "RETRY_TX") {
      let txId = parsed.data.payoutTxRef?.trim();
      if (!txId && parsed.data.action === "RETRY_TX") {
        const wd = await prisma.withdrawalRequest.findUnique({
          where: { id },
          select: { payoutTxRef: true },
        });
        txId = wd?.payoutTxRef?.trim();
      }
      if (!txId) {
        return jsonError("Outbound payout TxID is required", 400);
      }
      const res = await submitWithdrawalPayoutTx({
        withdrawalId: id,
        operatorId: admin.id,
        txId,
      });
      return NextResponse.json(serializeBigInt(res));
    }

    if (parsed.data.action === "MARK_PENDING_CHECK") {
      const withdrawal = await markWithdrawalPendingCheck({
        withdrawalId: id,
        operatorId: admin.id,
        note: parsed.data.reason,
        payoutTxRef: parsed.data.payoutTxRef,
      });
      return NextResponse.json({ ok: true, withdrawal: serializeBigInt(withdrawal) });
    }

    if (parsed.data.action === "PAY") {
      const withdrawal = await markWithdrawalPaid({
        withdrawalId: id,
        operatorId: admin.id,
        payoutTxRef: parsed.data.payoutTxRef,
      });
      return NextResponse.json({ ok: true, withdrawal: serializeBigInt(withdrawal) });
    }

    const withdrawal = await rejectWithdrawal({
      withdrawalId: id,
      operatorId: admin.id,
      reason: parsed.data.reason ?? "",
    });
    return NextResponse.json({ ok: true, withdrawal: serializeBigInt(withdrawal) });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Action failed", 400);
  }
}
