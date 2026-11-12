-- AlterEnum
ALTER TYPE "WithdrawalStatus" ADD VALUE IF NOT EXISTS 'CHAIN_CONFIRMING';

-- CreateEnum
CREATE TYPE "DepositVerifyStatus" AS ENUM ('AWAITING_TX', 'VERIFYING', 'VERIFIED_MATCH', 'MANUAL_REVIEW', 'MATCHED_CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TransferDirection" AS ENUM ('DEPOSIT', 'PAYOUT');

-- AlterTable system_configs
ALTER TABLE "system_configs"
  ADD COLUMN "usdtNetwork" TEXT NOT NULL DEFAULT 'TRON_TRC20',
  ADD COLUMN "usdtContractAddress" TEXT NOT NULL DEFAULT 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  ADD COLUMN "usdtDepositAddress" TEXT NOT NULL DEFAULT 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
  ADD COLUMN "usdtPayoutAddress" TEXT NOT NULL DEFAULT 'TLyqzVGLV1srkB7dToTAEqgDSfPtXRJZYH',
  ADD COLUMN "usdtMinConfirmations" INTEGER NOT NULL DEFAULT 19,
  ADD COLUMN "usdtWithdrawalProcessingHours" INTEGER NOT NULL DEFAULT 72,
  ADD COLUMN "usdtDepositsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "usdtWithdrawalsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable rule_version_records
ALTER TABLE "rule_version_records"
  ADD COLUMN "usdtNetwork" TEXT NOT NULL DEFAULT 'TRON_TRC20',
  ADD COLUMN "usdtContractAddress" TEXT NOT NULL DEFAULT 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  ADD COLUMN "usdtDepositAddress" TEXT NOT NULL DEFAULT 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
  ADD COLUMN "usdtPayoutAddress" TEXT NOT NULL DEFAULT 'TLyqzVGLV1srkB7dToTAEqgDSfPtXRJZYH',
  ADD COLUMN "usdtMinConfirmations" INTEGER NOT NULL DEFAULT 19,
  ADD COLUMN "usdtWithdrawalProcessingHours" INTEGER NOT NULL DEFAULT 72,
  ADD COLUMN "usdtDepositsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "usdtWithdrawalsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable package_tiers
ALTER TABLE "package_tiers"
  ADD COLUMN "priceUsdtMicros" BIGINT NOT NULL DEFAULT 0;

-- Backfill package_tiers priceUsdtMicros from priceUsdCents (1 USD = 1 USDT = 1,000,000 micros)
UPDATE "package_tiers" SET "priceUsdtMicros" = ("priceUsdCents"::BIGINT * 10000);

-- AlterTable package_orders
ALTER TABLE "package_orders"
  ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'USDT',
  ADD COLUMN "usdtNetwork" TEXT,
  ADD COLUMN "usdtContractAddress" TEXT,
  ADD COLUMN "usdtDepositAddress" TEXT,
  ADD COLUMN "expectedUsdtMicros" BIGINT,
  ADD COLUMN "actualUsdtMicros" BIGINT,
  ADD COLUMN "submittedTxId" TEXT,
  ADD COLUMN "paymentProofNote" TEXT,
  ADD COLUMN "chainConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "depositVerifyStatus" "DepositVerifyStatus" NOT NULL DEFAULT 'AWAITING_TX',
  ADD COLUMN "depositFailureReason" TEXT,
  ADD COLUMN "matchedDepositEventId" TEXT;

-- AlterTable withdrawal_requests
ALTER TABLE "withdrawal_requests"
  ADD COLUMN "usdtNetwork" TEXT NOT NULL DEFAULT 'TRON_TRC20',
  ADD COLUMN "usdtContractAddress" TEXT,
  ADD COLUMN "companyPayoutAddress" TEXT,
  ADD COLUMN "payoutAmountUsdtMicros" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "processingDeadlineAt" TIMESTAMP(3),
  ADD COLUMN "claimedAt" TIMESTAMP(3),
  ADD COLUMN "claimedById" TEXT,
  ADD COLUMN "chainConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "matchedPayoutEventId" TEXT,
  ADD COLUMN "payoutFailureReason" TEXT;

-- CreateTable member_saved_addresses
CREATE TABLE "member_saved_addresses" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "network" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "member_saved_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable chain_transfer_events
CREATE TABLE "chain_transfer_events" (
  "id" TEXT NOT NULL,
  "direction" "TransferDirection" NOT NULL,
  "network" TEXT NOT NULL,
  "txId" TEXT NOT NULL,
  "eventIndex" INTEGER NOT NULL,
  "contractAddress" TEXT NOT NULL,
  "fromAddress" TEXT NOT NULL,
  "toAddress" TEXT NOT NULL,
  "amountMicros" BIGINT NOT NULL,
  "confirmations" INTEGER NOT NULL,
  "minConfirmations" INTEGER NOT NULL,
  "chainSuccess" BOOLEAN NOT NULL,
  "chainTimestamp" TIMESTAMP(3),
  "verifyOutcome" TEXT NOT NULL,
  "rawPayload" JSONB,
  "submittedByOrderId" TEXT,
  "submittedByWithdrawalId" TEXT,
  "claimedOrderId" TEXT,
  "claimedWithdrawalId" TEXT,
  "attributionNote" TEXT,
  "verifiedById" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "chain_transfer_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable mock_chain_txs
CREATE TABLE "mock_chain_txs" (
  "id" TEXT NOT NULL,
  "network" TEXT NOT NULL,
  "txId" TEXT NOT NULL,
  "txExecutedSuccess" BOOLEAN NOT NULL DEFAULT true,
  "confirmations" INTEGER NOT NULL DEFAULT 20,
  "chainTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "simulateError" TEXT,
  "transfers" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "mock_chain_txs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "package_orders_matchedDepositEventId_key" ON "package_orders"("matchedDepositEventId");
CREATE INDEX "package_orders_depositVerifyStatus_createdAt_idx" ON "package_orders"("depositVerifyStatus", "createdAt");
CREATE INDEX "package_orders_submittedTxId_idx" ON "package_orders"("submittedTxId");

CREATE UNIQUE INDEX "withdrawal_requests_matchedPayoutEventId_key" ON "withdrawal_requests"("matchedPayoutEventId");
CREATE INDEX "withdrawal_requests_processingDeadlineAt_idx" ON "withdrawal_requests"("processingDeadlineAt");
CREATE INDEX "withdrawal_requests_payoutTxRef_idx" ON "withdrawal_requests"("payoutTxRef");

CREATE UNIQUE INDEX "member_saved_addresses_memberId_network_address_key" ON "member_saved_addresses"("memberId", "network", "address");
CREATE INDEX "member_saved_addresses_memberId_idx" ON "member_saved_addresses"("memberId");

CREATE UNIQUE INDEX "chain_transfer_events_claimedOrderId_key" ON "chain_transfer_events"("claimedOrderId");
CREATE UNIQUE INDEX "chain_transfer_events_claimedWithdrawalId_key" ON "chain_transfer_events"("claimedWithdrawalId");
CREATE UNIQUE INDEX "chain_transfer_events_network_txId_eventIndex_key" ON "chain_transfer_events"("network", "txId", "eventIndex");
CREATE INDEX "chain_transfer_events_txId_idx" ON "chain_transfer_events"("txId");
CREATE INDEX "chain_transfer_events_submittedByOrderId_idx" ON "chain_transfer_events"("submittedByOrderId");
CREATE INDEX "chain_transfer_events_submittedByWithdrawalId_idx" ON "chain_transfer_events"("submittedByWithdrawalId");

CREATE UNIQUE INDEX "mock_chain_txs_network_txId_key" ON "mock_chain_txs"("network", "txId");

-- AddForeignKey
ALTER TABLE "package_orders" ADD CONSTRAINT "package_orders_matchedDepositEventId_fkey" FOREIGN KEY ("matchedDepositEventId") REFERENCES "chain_transfer_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_matchedPayoutEventId_fkey" FOREIGN KEY ("matchedPayoutEventId") REFERENCES "chain_transfer_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "member_saved_addresses" ADD CONSTRAINT "member_saved_addresses_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chain_transfer_events" ADD CONSTRAINT "chain_transfer_events_submittedByOrderId_fkey" FOREIGN KEY ("submittedByOrderId") REFERENCES "package_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chain_transfer_events" ADD CONSTRAINT "chain_transfer_events_submittedByWithdrawalId_fkey" FOREIGN KEY ("submittedByWithdrawalId") REFERENCES "withdrawal_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
