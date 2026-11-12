import "dotenv/config";
import { prisma } from "../lib/db";
import { getSgtDateString, makeSgtDate } from "../lib/sgt";
import { processDueUpgrades } from "../lib/settlement/engine";

async function main() {
  const targetSgtDate = process.argv[2] || getSgtDateString(new Date());
  const asOf = process.argv[2] ? makeSgtDate(targetSgtDate, "00:01:05") : new Date();
  console.log(`[Settlement Tick] Running 00:00 SGT EOD + 00:01 SGT due upgrades as of ${asOf.toISOString()}...`);
  const result = await processDueUpgrades({
    asOf,
    triggeredBy: "CRON",
  });
  console.log("[Settlement Tick] Result:", JSON.stringify(result));
}

main()
  .catch((err) => {
    console.error("[Settlement Tick] Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
