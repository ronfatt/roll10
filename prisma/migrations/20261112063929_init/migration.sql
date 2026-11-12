-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('MEMBER', 'ADMIN');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BinaryLeg" AS ENUM ('LEFT', 'RIGHT');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('INITIAL', 'UPGRADE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID_DEMO', 'PAID');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_CONFIRMATION', 'CONFIRMED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BvEntryType" AS ENUM ('CREDIT_ORDER', 'DEBIT_PAIRING', 'DEBIT_EOD_FLUSH', 'CARRYOVER_RETAIN', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PairingTriggerType" AS ENUM ('ORDER_BV', 'SAME_DAY_UPGRADE', 'SCHEDULED_UPGRADE', 'MANUAL_CATCHUP');

-- CreateEnum
CREATE TYPE "WalletEntryType" AS ENUM ('DIRECT_COMMISSION', 'BINARY_PAIRING', 'WITHDRAWAL_LOCK', 'WITHDRAWAL_RELEASE', 'WITHDRAWAL_PAID', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "RetainedSide" AS ENUM ('LEFT', 'RIGHT', 'NONE');

-- CreateEnum
CREATE TYPE "TieBreakerRule" AS ENUM ('KEEP_LEFT', 'KEEP_RIGHT');

-- CreateEnum
CREATE TYPE "HeadcountRule" AS ENUM ('ACTIVE_PAID_ALL_DEPTHS');

-- CreateEnum
CREATE TYPE "UpgradePriceMode" AS ENUM ('DIFFERENCE', 'FULL');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('UNPAID', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "system_configs" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "tieBreakerRule" "TieBreakerRule" NOT NULL DEFAULT 'KEEP_LEFT',
    "headcountRule" "HeadcountRule" NOT NULL DEFAULT 'ACTIVE_PAID_ALL_DEPTHS',
    "upgradePriceMode" "UpgradePriceMode" NOT NULL DEFAULT 'DIFFERENCE',
    "upgradeGrantsBv" BOOLEAN NOT NULL DEFAULT false,
    "upgradeTriggersDirectCommission" BOOLEAN NOT NULL DEFAULT false,
    "cutoffHourSgt" INTEGER NOT NULL DEFAULT 23,
    "cutoffMinuteSgt" INTEGER NOT NULL DEFAULT 0,
    "directCommissionRateBps" INTEGER NOT NULL DEFAULT 2500,
    "pairingUnitBv" INTEGER NOT NULL DEFAULT 100,
    "pairingRewardPointsCents" INTEGER NOT NULL DEFAULT 1000,
    "withdrawalFeeRateBps" INTEGER NOT NULL DEFAULT 2000,
    "withdrawalUsdRateMicros" INTEGER NOT NULL DEFAULT 1000000,
    "isDemoRate" BOOLEAN NOT NULL DEFAULT true,
    "productionPayoutEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_tiers" (
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameZh" TEXT NOT NULL,
    "priceUsdCents" INTEGER NOT NULL,
    "bv" INTEGER NOT NULL,
    "dailyCapPointsCents" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_tiers_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "memberCode" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "status" "MemberStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "sponsorId" TEXT,
    "placementParentId" TEXT,
    "placementLeg" "BinaryLeg",
    "placedAt" TIMESTAMP(3),
    "placedById" TEXT,
    "currentPackageCode" TEXT,
    "dailyCapPointsCents" INTEGER NOT NULL DEFAULT 0,
    "pendingUpgradePackageCode" TEXT,
    "pendingUpgradeEffectiveDate" TEXT,
    "pendingUpgradeOrderId" TEXT,
    "leftBv" INTEGER NOT NULL DEFAULT 0,
    "rightBv" INTEGER NOT NULL DEFAULT 0,
    "activeSettlementDate" TEXT NOT NULL,
    "todayPairedPointsCents" INTEGER NOT NULL DEFAULT 0,
    "availablePointsCents" INTEGER NOT NULL DEFAULT 0,
    "lockedPointsCents" INTEGER NOT NULL DEFAULT 0,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_orders" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "orderType" "OrderType" NOT NULL,
    "targetPackageCode" TEXT NOT NULL,
    "previousPackageCode" TEXT,
    "amountUsdCents" INTEGER NOT NULL,
    "bvAmount" INTEGER NOT NULL,
    "commissionableBv" INTEGER NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "requestedPlacementParentId" TEXT,
    "requestedPlacementLeg" "BinaryLeg",
    "failureReason" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "effectiveSgtDate" TEXT,
    "isSameDayEffective" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bv_ledgers" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "leg" "BinaryLeg" NOT NULL,
    "entryType" "BvEntryType" NOT NULL,
    "deltaBv" INTEGER NOT NULL,
    "balanceAfterBv" INTEGER NOT NULL,
    "settlementDate" TEXT NOT NULL,
    "orderId" TEXT,
    "sourceMemberId" TEXT,
    "pairingSettlementId" TEXT,
    "dailySettlementId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bv_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "binary_pairing_settlements" (
    "id" TEXT NOT NULL,
    "settlementNo" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "settlementDate" TEXT NOT NULL,
    "triggerType" "PairingTriggerType" NOT NULL,
    "triggerOrderId" TEXT,
    "pairsCount" INTEGER NOT NULL,
    "bvDeductedPerLeg" INTEGER NOT NULL,
    "pointsAwardedCents" INTEGER NOT NULL,
    "leftBvBefore" INTEGER NOT NULL,
    "rightBvBefore" INTEGER NOT NULL,
    "leftBvAfter" INTEGER NOT NULL,
    "rightBvAfter" INTEGER NOT NULL,
    "dailyCapPointsCents" INTEGER NOT NULL,
    "dailyPairedBeforeCents" INTEGER NOT NULL,
    "dailyPairedAfterCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "binary_pairing_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_ledgers" (
    "id" TEXT NOT NULL,
    "ledgerNo" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "entryType" "WalletEntryType" NOT NULL,
    "deltaAvailableCents" INTEGER NOT NULL,
    "deltaLockedCents" INTEGER NOT NULL,
    "availableAfterCents" INTEGER NOT NULL,
    "lockedAfterCents" INTEGER NOT NULL,
    "orderId" TEXT,
    "pairingSettlementId" TEXT,
    "withdrawalId" TEXT,
    "operatorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_settlements" (
    "id" TEXT NOT NULL,
    "settlementNo" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "settlementDate" TEXT NOT NULL,
    "leftBvBefore" INTEGER NOT NULL,
    "rightBvBefore" INTEGER NOT NULL,
    "leftMemberCount" INTEGER NOT NULL,
    "rightMemberCount" INTEGER NOT NULL,
    "retainedSide" "RetainedSide" NOT NULL,
    "flushedSide" "RetainedSide" NOT NULL,
    "flushedBv" INTEGER NOT NULL,
    "leftBvAfter" INTEGER NOT NULL,
    "rightBvAfter" INTEGER NOT NULL,
    "decisionBasis" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_requests" (
    "id" TEXT NOT NULL,
    "withdrawalNo" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "requestedPointsCents" INTEGER NOT NULL,
    "feePointsCents" INTEGER NOT NULL,
    "netPointsCents" INTEGER NOT NULL,
    "usdRateMicros" INTEGER NOT NULL,
    "isDemoRate" BOOLEAN NOT NULL DEFAULT true,
    "estimatedUsdCents" INTEGER NOT NULL,
    "payoutDestination" TEXT NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "payoutStatus" "PayoutStatus" NOT NULL DEFAULT 'UNPAID',
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectionReason" TEXT,
    "payoutTxRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "members_memberCode_key" ON "members"("memberCode");

-- CreateIndex
CREATE UNIQUE INDEX "members_email_key" ON "members"("email");

-- CreateIndex
CREATE INDEX "members_sponsorId_idx" ON "members"("sponsorId");

-- CreateIndex
CREATE INDEX "members_status_idx" ON "members"("status");

-- CreateIndex
CREATE UNIQUE INDEX "members_placementParentId_placementLeg_key" ON "members"("placementParentId", "placementLeg");

-- CreateIndex
CREATE UNIQUE INDEX "package_orders_orderNo_key" ON "package_orders"("orderNo");

-- CreateIndex
CREATE INDEX "package_orders_memberId_status_idx" ON "package_orders"("memberId", "status");

-- CreateIndex
CREATE INDEX "package_orders_status_createdAt_idx" ON "package_orders"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "bv_ledgers_eventKey_key" ON "bv_ledgers"("eventKey");

-- CreateIndex
CREATE INDEX "bv_ledgers_memberId_createdAt_idx" ON "bv_ledgers"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "bv_ledgers_orderId_idx" ON "bv_ledgers"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "binary_pairing_settlements_settlementNo_key" ON "binary_pairing_settlements"("settlementNo");

-- CreateIndex
CREATE UNIQUE INDEX "binary_pairing_settlements_eventKey_key" ON "binary_pairing_settlements"("eventKey");

-- CreateIndex
CREATE INDEX "binary_pairing_settlements_memberId_settlementDate_idx" ON "binary_pairing_settlements"("memberId", "settlementDate");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_ledgers_ledgerNo_key" ON "wallet_ledgers"("ledgerNo");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_ledgers_eventKey_key" ON "wallet_ledgers"("eventKey");

-- CreateIndex
CREATE INDEX "wallet_ledgers_memberId_createdAt_idx" ON "wallet_ledgers"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "wallet_ledgers_entryType_idx" ON "wallet_ledgers"("entryType");

-- CreateIndex
CREATE UNIQUE INDEX "daily_settlements_settlementNo_key" ON "daily_settlements"("settlementNo");

-- CreateIndex
CREATE INDEX "daily_settlements_settlementDate_idx" ON "daily_settlements"("settlementDate");

-- CreateIndex
CREATE UNIQUE INDEX "daily_settlements_memberId_settlementDate_key" ON "daily_settlements"("memberId", "settlementDate");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_requests_withdrawalNo_key" ON "withdrawal_requests"("withdrawalNo");

-- CreateIndex
CREATE INDEX "withdrawal_requests_memberId_createdAt_idx" ON "withdrawal_requests"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "withdrawal_requests_status_idx" ON "withdrawal_requests"("status");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_placementParentId_fkey" FOREIGN KEY ("placementParentId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_placedById_fkey" FOREIGN KEY ("placedById") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_currentPackageCode_fkey" FOREIGN KEY ("currentPackageCode") REFERENCES "package_tiers"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_pendingUpgradePackageCode_fkey" FOREIGN KEY ("pendingUpgradePackageCode") REFERENCES "package_tiers"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_orders" ADD CONSTRAINT "package_orders_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_orders" ADD CONSTRAINT "package_orders_targetPackageCode_fkey" FOREIGN KEY ("targetPackageCode") REFERENCES "package_tiers"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_orders" ADD CONSTRAINT "package_orders_previousPackageCode_fkey" FOREIGN KEY ("previousPackageCode") REFERENCES "package_tiers"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_orders" ADD CONSTRAINT "package_orders_requestedPlacementParentId_fkey" FOREIGN KEY ("requestedPlacementParentId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_orders" ADD CONSTRAINT "package_orders_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bv_ledgers" ADD CONSTRAINT "bv_ledgers_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bv_ledgers" ADD CONSTRAINT "bv_ledgers_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "package_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bv_ledgers" ADD CONSTRAINT "bv_ledgers_sourceMemberId_fkey" FOREIGN KEY ("sourceMemberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bv_ledgers" ADD CONSTRAINT "bv_ledgers_pairingSettlementId_fkey" FOREIGN KEY ("pairingSettlementId") REFERENCES "binary_pairing_settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bv_ledgers" ADD CONSTRAINT "bv_ledgers_dailySettlementId_fkey" FOREIGN KEY ("dailySettlementId") REFERENCES "daily_settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "binary_pairing_settlements" ADD CONSTRAINT "binary_pairing_settlements_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledgers" ADD CONSTRAINT "wallet_ledgers_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledgers" ADD CONSTRAINT "wallet_ledgers_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "package_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledgers" ADD CONSTRAINT "wallet_ledgers_pairingSettlementId_fkey" FOREIGN KEY ("pairingSettlementId") REFERENCES "binary_pairing_settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledgers" ADD CONSTRAINT "wallet_ledgers_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "withdrawal_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledgers" ADD CONSTRAINT "wallet_ledgers_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_settlements" ADD CONSTRAINT "daily_settlements_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
