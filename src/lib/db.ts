import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const DEFAULT_DATABASE_URL =
  "postgresql://postgres.koieqfxxohlnbuffodqv:Sorsor800614@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true";

/**
 * Ensures Supabase uses Transaction Mode Pooler (port 6543, pgbouncer=true)
 * rather than Session Mode (port 5432, max 15 clients which causes EMAXCONNSESSION).
 * Also limits Prisma connections per container/instance so connections are never exhausted.
 */
function buildPooledDatasourceUrl(): string | undefined {
  let raw = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  if (!raw) return undefined;

  // Automatically migrate legacy session port 5432 to transaction pooler port 6543
  if (raw.includes("pooler.supabase.com:5432")) {
    raw = raw.replace("pooler.supabase.com:5432", "pooler.supabase.com:6543");
  }

  if (raw.includes("pooler.supabase.com")) {
    if (!raw.includes("pgbouncer=true")) {
      const sep = raw.includes("?") ? "&" : "?";
      raw = `${raw}${sep}pgbouncer=true`;
    }
    if (!raw.includes("connection_limit=")) {
      const sep = raw.includes("?") ? "&" : "?";
      raw = `${raw}${sep}connection_limit=5&pool_timeout=15`;
    }
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
