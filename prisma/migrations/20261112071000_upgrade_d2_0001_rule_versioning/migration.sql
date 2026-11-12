-- CreateEnum
CREATE TYPE "UpgradeEffectiveStatus" AS ENUM ('NOT_APPLICABLE', 'WAITING_EFFECTIVE', 'EFFECTIVE');

-- AlterEnum (safely map any legacy SAME_DAY_UPGRADE rows to SCHEDULED_UPGRADE)
BEGIN;
CREATE TYPE "PairingTriggerType_new" AS ENUM ('ORDER_BV', 'SCHEDULED_UPGRADE', 'MANUAL_CATCHUP');
ALTER TABLE "binary_pairing_settlements" ALTER COLUMN "triggerType" TYPE "PairingTriggerType_new" USING (
  CASE
    WHEN "triggerType"::text = 'SAME_DAY_UPGRADE' THEN 'SCHEDULED_UPGRADE'
    ELSE "triggerType"::text
  END::"PairingTriggerType_new"
);
ALTER TYPE "PairingTriggerType" RENAME TO "PairingTriggerType_old";
ALTER TYPE "PairingTriggerType_new" RENAME TO "PairingTriggerType";
DROP TYPE "public"."PairingTriggerType_old";
COMMIT;

-- AlterTable
ALTER TABLE "binary_pairing_settlements" ADD COLUMN     "businessAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "ruleSnapshot" JSONB,
ADD COLUMN     "ruleVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "daily_settlements" ADD COLUMN     "businessAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "ruleSnapshot" JSONB,
ADD COLUMN     "ruleVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "members" ADD COLUMN     "pendingUpgradeEffectiveAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "package_orders" ADD COLUMN     "effectiveAt" TIMESTAMP(3),
ADD COLUMN     "ruleVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "upgradeProcessedAt" TIMESTAMP(3),
ADD COLUMN     "upgradeStatus" "UpgradeEffectiveStatus" NOT NULL DEFAULT 'NOT_APPLICABLE';

-- AlterTable
ALTER TABLE "system_configs" DROP COLUMN "cutoffHourSgt",
DROP COLUMN "cutoffMinuteSgt",
ADD COLUMN     "ruleVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "upgradeEffectiveDaysOffset" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "upgradeEffectiveTimeSgt" TEXT NOT NULL DEFAULT '00:01:00';

-- AlterTable
ALTER TABLE "withdrawal_requests" ADD COLUMN     "feeRateBpsSnapshot" INTEGER NOT NULL DEFAULT 2000;

-- CreateTable
CREATE TABLE "rule_version_records" (
    "version" INTEGER NOT NULL,
    "tieBreakerRule" "TieBreakerRule" NOT NULL,
    "headcountRule" "HeadcountRule" NOT NULL,
    "upgradePriceMode" "UpgradePriceMode" NOT NULL,
    "upgradeGrantsBv" BOOLEAN NOT NULL,
    "upgradeTriggersDirectCommission" BOOLEAN NOT NULL,
    "upgradeEffectiveDaysOffset" INTEGER NOT NULL,
    "upgradeEffectiveTimeSgt" TEXT NOT NULL,
    "directCommissionRateBps" INTEGER NOT NULL,
    "pairingUnitBv" INTEGER NOT NULL,
    "pairingRewardPointsCents" INTEGER NOT NULL,
    "withdrawalFeeRateBps" INTEGER NOT NULL,
    "withdrawalUsdRateMicros" INTEGER NOT NULL,
    "isDemoRate" BOOLEAN NOT NULL,
    "productionPayoutEnabled" BOOLEAN NOT NULL,
    "changedById" TEXT,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_version_records_pkey" PRIMARY KEY ("version")
);

-- Data Migration 1: Seed initial rule_version_records row from existing system_configs
INSERT INTO "rule_version_records" (
    "version", "tieBreakerRule", "headcountRule", "upgradePriceMode",
    "upgradeGrantsBv", "upgradeTriggersDirectCommission",
    "upgradeEffectiveDaysOffset", "upgradeEffectiveTimeSgt",
    "directCommissionRateBps", "pairingUnitBv", "pairingRewardPointsCents",
    "withdrawalFeeRateBps", "withdrawalUsdRateMicros", "isDemoRate",
    "productionPayoutEnabled", "changeNote"
)
SELECT
    1, "tieBreakerRule", "headcountRule", "upgradePriceMode",
    "upgradeGrantsBv", "upgradeTriggersDirectCommission",
    "upgradeEffectiveDaysOffset", "upgradeEffectiveTimeSgt",
    "directCommissionRateBps", "pairingUnitBv", "pairingRewardPointsCents",
    "withdrawalFeeRateBps", "withdrawalUsdRateMicros", "isDemoRate",
    "productionPayoutEnabled", 'Migrated to D+2 00:01:00 SGT upgrade rule'
FROM "system_configs"
WHERE id = 1
ON CONFLICT ("version") DO NOTHING;

-- Data Migration 2: Migrate any existing pending upgrades (preserving paidAt & confirmedAt) to D+2 00:01:00 SGT
UPDATE "package_orders" po
SET
    "upgradeStatus" = 'WAITING_EFFECTIVE',
    "effectiveSgtDate" = to_char((COALESCE(po."confirmedAt", po."paidAt", po."createdAt") AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore')::date + INTERVAL '2 days', 'YYYY-MM-DD'),
    "effectiveAt" = (((to_char((COALESCE(po."confirmedAt", po."paidAt", po."createdAt") AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore')::date + INTERVAL '2 days', 'YYYY-MM-DD') || ' 00:01:00')::timestamp) AT TIME ZONE 'Asia/Singapore') AT TIME ZONE 'UTC',
    "isSameDayEffective" = false
FROM "members" m
WHERE m."pendingUpgradeOrderId" = po.id
  AND po."orderType" = 'UPGRADE'
  AND po."status" = 'CONFIRMED';

UPDATE "members" m
SET
    "pendingUpgradeEffectiveDate" = po."effectiveSgtDate",
    "pendingUpgradeEffectiveAt" = po."effectiveAt"
FROM "package_orders" po
WHERE m."pendingUpgradeOrderId" = po.id
  AND po."upgradeStatus" = 'WAITING_EFFECTIVE';

-- Mark already-effective historical upgrade orders
UPDATE "package_orders" po
SET
    "upgradeStatus" = 'EFFECTIVE',
    "upgradeProcessedAt" = COALESCE(po."confirmedAt", po."updatedAt"),
    "effectiveAt" = COALESCE(po."effectiveAt", po."confirmedAt")
WHERE po."orderType" = 'UPGRADE'
  AND po."status" = 'CONFIRMED'
  AND po."upgradeStatus" = 'NOT_APPLICABLE';

-- CreateIndex
CREATE INDEX "binary_pairing_settlements_triggerOrderId_idx" ON "binary_pairing_settlements"("triggerOrderId");

-- CreateIndex
CREATE INDEX "bv_ledgers_settlementDate_idx" ON "bv_ledgers"("settlementDate");

-- CreateIndex
CREATE INDEX "members_pendingUpgradeEffectiveAt_idx" ON "members"("pendingUpgradeEffectiveAt");

-- CreateIndex
CREATE INDEX "package_orders_upgradeStatus_effectiveAt_idx" ON "package_orders"("upgradeStatus", "effectiveAt");

-- CreateIndex
CREATE INDEX "wallet_ledgers_orderId_idx" ON "wallet_ledgers"("orderId");
