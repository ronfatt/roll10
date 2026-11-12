-- AlterEnum
ALTER TYPE "UpgradeEffectiveStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "WithdrawalStatus" ADD VALUE IF NOT EXISTS 'PAYOUT_PENDING_CHECK';
ALTER TYPE "PayoutStatus" ADD VALUE IF NOT EXISTS 'PENDING_CHECK';

-- AlterTable
ALTER TABLE "package_orders" ADD COLUMN "upgradeFailureReason" TEXT;

-- AlterTable
ALTER TABLE "withdrawal_requests" ADD COLUMN "payoutCheckNote" TEXT;
