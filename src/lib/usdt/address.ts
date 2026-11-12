import crypto from "crypto";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function isValidTronAddress(address: string): boolean {
  const trimmed = address.trim();
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(trimmed)) {
    return false;
  }

  let num = 0n;
  for (const ch of trimmed) {
    const idx = BASE58_ALPHABET.indexOf(ch);
    if (idx < 0) return false;
    num = num * 58n + BigInt(idx);
  }

  const bytes: number[] = [];
  while (num > 0n) {
    bytes.unshift(Number(num & 0xffn));
    num >>= 8n;
  }

  while (bytes.length < 25) {
    bytes.unshift(0);
  }

  if (bytes.length !== 25 || bytes[0] !== 0x41) {
    return false;
  }

  const payload = Buffer.from(bytes.slice(0, 21));
  const h1 = crypto.createHash("sha256").update(payload).digest();
  const h2 = crypto.createHash("sha256").update(h1).digest();
  return Buffer.compare(h2.subarray(0, 4), Buffer.from(bytes.slice(21))) === 0;
}

export function tronHex20ToBase58(hex20: string): string {
  const clean = hex20.replace(/^0x/i, "").replace(/^41/i, "").padStart(40, "0").slice(-40);
  const payload = Buffer.concat([Buffer.from([0x41]), Buffer.from(clean, "hex")]);
  const h1 = crypto.createHash("sha256").update(payload).digest();
  const h2 = crypto.createHash("sha256").update(h1).digest();
  const full = Buffer.concat([payload, h2.subarray(0, 4)]);
  let num = BigInt(`0x${full.toString("hex")}`);
  let out = "";
  while (num > 0n) {
    out = BASE58_ALPHABET[Number(num % 58n)] + out;
    num /= 58n;
  }
  return out;
}

export function isValidUsdtAddressForNetwork(network: string, address: string): boolean {
  if (!network) return false;
  if (network === "TRON_TRC20") {
    return isValidTronAddress(address);
  }
  return address.trim().length >= 20;
}

export function normalizeTxId(txId: string): string {
  return txId.trim().toLowerCase().replace(/^0x/, "");
}

export function isValidTxIdForNetwork(network: string, txId: string): boolean {
  const norm = normalizeTxId(txId);
  if (network === "TRON_TRC20") {
    return /^[0-9a-f]{64}$/.test(norm);
  }
  return norm.length >= 32 && norm.length <= 128;
}

export function formatNetworkLabel(network: string | null | undefined): string {
  if (!network) return "—";
  if (network === "TRON_TRC20") return "TRON (TRC20)";
  return network;
}

export function isUsdtDepositConfigured(cfg: {
  usdtDepositsEnabled: boolean;
  usdtNetwork: string;
  usdtContractAddress: string;
  usdtDepositAddress: string;
}): boolean {
  return Boolean(
    cfg.usdtDepositsEnabled &&
      cfg.usdtNetwork.trim() &&
      cfg.usdtContractAddress.trim() &&
      cfg.usdtDepositAddress.trim()
  );
}

export function isUsdtWithdrawalConfigured(cfg: {
  usdtWithdrawalsEnabled: boolean;
  usdtNetwork: string;
  usdtContractAddress: string;
  usdtPayoutAddress: string;
}): boolean {
  return Boolean(
    cfg.usdtWithdrawalsEnabled &&
      cfg.usdtNetwork.trim() &&
      cfg.usdtContractAddress.trim() &&
      cfg.usdtPayoutAddress.trim()
  );
}
