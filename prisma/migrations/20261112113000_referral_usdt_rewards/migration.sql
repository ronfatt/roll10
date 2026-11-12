-- CreateEnum
CREATE TYPE "ReferralRewardCurrency" AS ENUM ('USDT', 'POINTS');

-- CreateEnum
CREATE TYPE "ReferralRewardStatus" AS ENUM ('PENDING', 'CREDITED', 'REVERSED');

-- AlterTable
ALTER TABLE "system_configs"
ADD COLUMN "directRewardCurrency" "ReferralRewardCurrency" NOT NULL DEFAULT 'USDT',
ADD COLUMN "directUsdtConversionMicros" INTEGER NOT NULL DEFAULT 1000000,
ADD COLUMN "directUsdtWithdrawalsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "rule_version_records"
ADD COLUMN "directRewardCurrency" "ReferralRewardCurrency" NOT NULL DEFAULT 'USDT',
ADD COLUMN "directUsdtConversionMicros" INTEGER NOT NULL DEFAULT 1000000,
ADD COLUMN "directUsdtWithdrawalsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "referral_reward_ledgers" (
    "id" TEXT NOT NULL,
    "rewardNo" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "sourceMemberId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "currency" "ReferralRewardCurrency" NOT NULL DEFAULT 'USDT',
    "baseBv" INTEGER NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "conversionMicros" INTEGER NOT NULL DEFAULT 1000000,
    "amountMicros" BIGINT NOT NULL,
    "status" "ReferralRewardStatus" NOT NULL DEFAULT 'CREDITED',
    "creditedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_reward_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referral_reward_ledgers_rewardNo_key" ON "referral_reward_ledgers"("rewardNo");

-- CreateIndex
CREATE UNIQUE INDEX "referral_reward_ledgers_eventKey_key" ON "referral_reward_ledgers"("eventKey");

-- CreateIndex
CREATE INDEX "referral_reward_ledgers_memberId_currency_status_idx" ON "referral_reward_ledgers"("memberId", "currency", "status");

-- CreateIndex
CREATE INDEX "referral_reward_ledgers_orderId_idx" ON "referral_reward_ledgers"("orderId");

-- AddForeignKey
ALTER TABLE "referral_reward_ledgers" ADD CONSTRAINT "referral_reward_ledgers_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_reward_ledgers" ADD CONSTRAINT "referral_reward_ledgers_sourceMemberId_fkey" FOREIGN KEY ("sourceMemberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_reward_ledgers" ADD CONSTRAINT "referral_reward_ledgers_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "package_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep Supabase public schema locked down via RLS (server-side Prisma uses postgres role with BYPASSRLS)
ALTER TABLE "referral_reward_ledgers" ENABLE ROW LEVEL SECURITY;
