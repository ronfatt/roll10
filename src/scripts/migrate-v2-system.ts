import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  console.log("Running V2 System Migration...");

  // 1. Update PackageTiers with direct referral rates
  const tiers = [
    {
      code: "P100",
      nameEn: "Silver",
      nameZh: "Silver (白银)",
      priceUsdCents: 10000,
      priceUsdtMicros: BigInt(100_000_000),
      bv: 100,
      directReferralRateBps: 2500, // 25%
      dailyCapPointsCents: 10000, // 100 CP
      sortOrder: 1,
    },
    {
      code: "P500",
      nameEn: "Gold",
      nameZh: "Gold (黄金)",
      priceUsdCents: 50000,
      priceUsdtMicros: BigInt(500_000_000),
      bv: 500,
      directReferralRateBps: 3000, // 30%
      dailyCapPointsCents: 50000, // 500 CP
      sortOrder: 2,
    },
    {
      code: "P1000",
      nameEn: "Diamond",
      nameZh: "Diamond (钻石)",
      priceUsdCents: 100000,
      priceUsdtMicros: BigInt(1_000_000_000),
      bv: 1000,
      directReferralRateBps: 3500, // 35%
      dailyCapPointsCents: 100000, // 1000 CP
      sortOrder: 3,
    },
  ];

  for (const t of tiers) {
    await prisma.packageTier.upsert({
      where: { code: t.code },
      update: {
        nameEn: t.nameEn,
        nameZh: t.nameZh,
        directReferralRateBps: t.directReferralRateBps,
        bv: t.bv,
        dailyCapPointsCents: t.dailyCapPointsCents,
        priceUsdCents: t.priceUsdCents,
        priceUsdtMicros: t.priceUsdtMicros,
      },
      create: t,
    });
    console.log(`Updated tier ${t.code}: direct rate ${t.directReferralRateBps / 100}%, team points ${t.bv}, cap ${t.dailyCapPointsCents / 100} CP`);
  }

  // 2. Synchronize member cpBalanceCents from availablePointsCents if zero, and provide test RP
  const members = await prisma.member.findMany();
  console.log(`Found ${members.length} members in database.`);

  for (const m of members) {
    const cp = m.cpBalanceCents > 0 ? m.cpBalanceCents : m.availablePointsCents;
    // For admin BM100001, give at least 5000 RP (500000 cents) and 2000 CP (200000 cents) for testing
    const rp = m.memberCode === "BM100001" && m.rpBalanceCents < 500000 ? 500000 : m.rpBalanceCents;
    await prisma.member.update({
      where: { id: m.id },
      data: {
        cpBalanceCents: cp,
        rpBalanceCents: rp,
        availablePointsCents: cp,
      },
    });
    console.log(`Member ${m.memberCode}: CP=${cp / 100}, RP=${rp / 100}, LeftPoints=${m.leftBv}, RightPoints=${m.rightBv}`);
  }

  console.log("V2 System Migration Completed Successfully!");
}

main()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
