/**
 * Safely serializes objects containing BigInt fields (such as 6-decimal USDT micros)
 * into JSON-safe strings without losing integer precision.
 */
export function serializeBigInt<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
  ) as T;
}
