import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const DEFAULT_DATABASE_URL =
  "postgresql://postgres.koieqfxxohlnbuffodqv:Sorsor800614@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require";

/**
 * Prevents Supabase Session Pooler (port 5432, pool_size=15) from exhausting
 * connections on multi-core hosts where Prisma's default pool is num_cpus * 2 + 1.
 */
function buildPooledDatasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  if (!raw) return undefined;
  if (raw.includes("pooler.supabase.com") && !raw.includes("connection_limit=")) {
    const sep = raw.includes("?") ? "&" : "?";
    return `${raw}${sep}connection_limit=5&pool_timeout=15`;
  }
  return raw;
}

const datasourceUrl = buildPooledDatasourceUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
