import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeTxId, tronHex20ToBase58 } from "./address";

export interface ChainTransferItem {
  eventIndex: number;
  contractAddress: string;
  fromAddress: string;
  toAddress: string;
  amountMicros: bigint;
}

export type ChainTxInspectionResult =
  | {
      ok: true;
      mode: "mock" | "live";
      network: string;
      txId: string;
      txExecutedSuccess: boolean;
      confirmations: number;
      chainTimestamp: Date;
      transfers: ChainTransferItem[];
      rawPayload: Prisma.InputJsonValue;
    }
  | {
      ok: false;
      mode: "mock" | "live";
      errorCode: "NOT_FOUND" | "TIMEOUT" | "RPC_ERROR";
      errorMessage: string;
    };

const ERC20_TRANSFER_TOPIC =
  "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/**
 * Registers or updates a deterministic mock chain transaction in PostgreSQL.
 * Used in local staging & automated acceptance tests (`USDT_CHAIN_MODE="mock"`).
 */
export async function registerMockChainTx(params: {
  network: string;
  txId: string;
  txExecutedSuccess?: boolean;
  confirmations?: number;
  chainTimestamp?: Date;
  simulateError?: "TIMEOUT" | "RPC_ERROR" | "NOT_FOUND" | null;
  transfers: Array<{
    eventIndex: number;
    contractAddress: string;
    fromAddress: string;
    toAddress: string;
    amountMicros: bigint | number | string;
  }>;
}) {
  const normTxId = normalizeTxId(params.txId);
  const serializedTransfers = params.transfers.map((t) => ({
    eventIndex: t.eventIndex,
    contractAddress: t.contractAddress,
    fromAddress: t.fromAddress,
    toAddress: t.toAddress,
    amountMicros: String(t.amountMicros),
  }));

  return prisma.mockChainTx.upsert({
    where: {
      network_txId: { network: params.network, txId: normTxId },
    },
    update: {
      txExecutedSuccess: params.txExecutedSuccess ?? true,
      confirmations: params.confirmations ?? 20,
      chainTimestamp: params.chainTimestamp ?? new Date(),
      simulateError: params.simulateError ?? null,
      transfers: serializedTransfers as Prisma.InputJsonValue,
    },
    create: {
      network: params.network,
      txId: normTxId,
      txExecutedSuccess: params.txExecutedSuccess ?? true,
      confirmations: params.confirmations ?? 20,
      chainTimestamp: params.chainTimestamp ?? new Date(),
      simulateError: params.simulateError ?? null,
      transfers: serializedTransfers as Prisma.InputJsonValue,
    },
  });
}

async function queryMockChain(
  network: string,
  txId: string
): Promise<ChainTxInspectionResult> {
  const norm = normalizeTxId(txId);
  const row = await prisma.mockChainTx.findUnique({
    where: { network_txId: { network, txId: norm } },
  });

  if (!row) {
    return {
      ok: false,
      mode: "mock",
      errorCode: "NOT_FOUND",
      errorMessage: "Transaction not found on chain yet (awaiting propagation or invalid TxID)",
    };
  }

  if (row.simulateError === "TIMEOUT") {
    return {
      ok: false,
      mode: "mock",
      errorCode: "TIMEOUT",
      errorMessage: "Simulated blockchain RPC timeout",
    };
  }
  if (row.simulateError === "RPC_ERROR") {
    return {
      ok: false,
      mode: "mock",
      errorCode: "RPC_ERROR",
      errorMessage: "Simulated blockchain RPC error",
    };
  }
  if (row.simulateError === "NOT_FOUND") {
    return {
      ok: false,
      mode: "mock",
      errorCode: "NOT_FOUND",
      errorMessage: "Simulated transaction not yet indexed",
    };
  }

  const rawList = Array.isArray(row.transfers) ? row.transfers : [];
  const transfers: ChainTransferItem[] = rawList.map((item, idx) => {
    const rec = item as Record<string, unknown>;
    return {
      eventIndex: Number(rec.eventIndex ?? idx),
      contractAddress: String(rec.contractAddress ?? ""),
      fromAddress: String(rec.fromAddress ?? ""),
      toAddress: String(rec.toAddress ?? ""),
      amountMicros: BigInt(String(rec.amountMicros ?? "0")),
    };
  });

  return {
    ok: true,
    mode: "mock",
    network,
    txId: norm,
    txExecutedSuccess: row.txExecutedSuccess,
    confirmations: row.confirmations,
    chainTimestamp: row.chainTimestamp,
    transfers,
    rawPayload: {
      source: "MOCK_CHAIN_VERIFIER",
      txId: norm,
      confirmations: row.confirmations,
      txExecutedSuccess: row.txExecutedSuccess,
      transfers: rawList as Prisma.InputJsonValue,
    },
  };
}

async function queryLiveTronGrid(
  network: string,
  txId: string
): Promise<ChainTxInspectionResult> {
  const norm = normalizeTxId(txId);
  const baseUrl = (process.env.TRONGRID_API_URL || "https://api.trongrid.io").replace(/\/+$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.TRONGRID_API_KEY) {
    headers["TRON-PRO-API-KEY"] = process.env.TRONGRID_API_KEY;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const [infoRes, txRes, nowRes] = await Promise.all([
      fetch(`${baseUrl}/wallet/gettransactioninfobyid`, {
        method: "POST",
        headers,
        body: JSON.stringify({ value: norm }),
        signal: controller.signal,
      }),
      fetch(`${baseUrl}/wallet/gettransactionbyid`, {
        method: "POST",
        headers,
        body: JSON.stringify({ value: norm }),
        signal: controller.signal,
      }),
      fetch(`${baseUrl}/wallet/getnowblock`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
        signal: controller.signal,
      }),
    ]);

    if (!infoRes.ok || !txRes.ok || !nowRes.ok) {
      return {
        ok: false,
        mode: "live",
        errorCode: "RPC_ERROR",
        errorMessage: `TronGrid RPC HTTP ${infoRes.status}/${txRes.status}/${nowRes.status}`,
      };
    }

    const info = (await infoRes.json()) as {
      id?: string;
      blockNumber?: number;
      blockTimeStamp?: number;
      receipt?: { result?: string };
      log?: Array<{ address?: string; topics?: string[]; data?: string }>;
    };
    const tx = (await txRes.json()) as {
      txID?: string;
      ret?: Array<{ contractRet?: string }>;
    };
    const nowBlock = (await nowRes.json()) as {
      block_header?: { raw_data?: { number?: number } };
    };

    if (!info.id && !tx.txID) {
      return {
        ok: false,
        mode: "live",
        errorCode: "NOT_FOUND",
        errorMessage: "Transaction not found on TRON network",
      };
    }

    const latestBlock = nowBlock.block_header?.raw_data?.number ?? 0;
    const txBlock = info.blockNumber ?? 0;
    const confirmations =
      txBlock > 0 && latestBlock >= txBlock ? latestBlock - txBlock + 1 : 0;

    const contractRet = tx.ret?.[0]?.contractRet;
    const receiptResult = info.receipt?.result;
    const txExecutedSuccess =
      contractRet === "SUCCESS" && (!receiptResult || receiptResult === "SUCCESS");

    const logs = info.log ?? [];
    const transfers: ChainTransferItem[] = [];
    logs.forEach((log, idx) => {
      const topics = log.topics ?? [];
      if (
        topics.length >= 3 &&
        topics[0]?.toLowerCase().replace(/^0x/, "") === ERC20_TRANSFER_TOPIC &&
        log.address
      ) {
        const contractAddress = tronHex20ToBase58(log.address);
        const fromAddress = tronHex20ToBase58(topics[1]);
        const toAddress = tronHex20ToBase58(topics[2]);
        const dataHex = (log.data ?? "0").replace(/^0x/, "") || "0";
        const amountMicros = BigInt(`0x${dataHex}`);
        transfers.push({
          eventIndex: idx,
          contractAddress,
          fromAddress,
          toAddress,
          amountMicros,
        });
      }
    });

    return {
      ok: true,
      mode: "live",
      network,
      txId: norm,
      txExecutedSuccess,
      confirmations,
      chainTimestamp: info.blockTimeStamp ? new Date(info.blockTimeStamp) : new Date(),
      transfers,
      rawPayload: {
        source: "TRONGRID",
        blockNumber: txBlock,
        latestBlock,
        confirmations,
        contractRet,
        receiptResult,
      },
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      mode: "live",
      errorCode: isAbort ? "TIMEOUT" : "RPC_ERROR",
      errorMessage: err instanceof Error ? err.message : "Chain query failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function inspectChainTransferTx(
  network: string,
  txId: string
): Promise<ChainTxInspectionResult> {
  const mode = process.env.USDT_CHAIN_MODE === "live" ? "live" : "mock";
  if (mode === "live" && network === "TRON_TRC20") {
    return queryLiveTronGrid(network, txId);
  }
  return queryMockChain(network, txId);
}
