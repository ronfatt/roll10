import type { Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function generateNextMemberCode(db: DbClient): Promise<string> {
  const rows = await db.$queryRaw<Array<{ max_num: number | null }>>`
    SELECT MAX(CAST(SUBSTRING("memberCode" FROM 3) AS INTEGER)) AS max_num
    FROM members
    WHERE "memberCode" ~ '^BM[0-9]+$'
  `;
  const nextNum = (rows[0]?.max_num ?? 100000) + 1;
  return `BM${nextNum}`;
}
