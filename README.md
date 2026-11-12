# Binary Member Portal

International dual-track (binary) membership portal built with **Next.js App Router**, **TypeScript**, **Tailwind CSS**, **PostgreSQL**, **Prisma Migrate**, and **Auth.js (NextAuth v5)**.

This release covers member registration, sponsor & binary placement, packages & upgrades, BV tracking, instant bonus settlement, midnight `00:00 SGT` EOD carryover, wallet & withdrawals, and the admin console. Pinball competition navigation and tournament APIs are scheduled for a subsequent release once physical track, tournament platform, and provider APIs are delivered.

---

## Key Capabilities

- **Dual-Track Membership & Separate Relationships**
  - Direct Sponsor (`sponsorId`) governs 25% direct referral commissions (independent of daily binary cap).
  - Binary Placement (`placementParentId`, `placementLeg`: `LEFT` / `RIGHT`) governs BV propagation up the ancestor chain.
  - Database-level `UNIQUE (placementParentId, placementLeg)` + row-level `SELECT ... FOR UPDATE` locks prevent double-placement under concurrency.
- **Packages & Instant Binary Pairing**
  - `P100` (`US$100`, `100 BV`, `100 Pts/day` cap), `P500` (`US$500`, `500 BV`, `500 Pts/day` cap), `P1000` (`US$1,000`, `1,000 BV`, `1,000 Pts/day` cap).
  - Instant pairing (`100 BV Left + 100 BV Right -> 10 Withdrawable Points`), atomic BV deduction, daily quota deduction, wallet credit, and idempotent ledgers inside one PostgreSQL transaction.
- **Upgrade Effective Rule (`D+2` at `00:01:00 SGT`)**
  - Taking the SGT calendar date `D` of the server-confirmed upgrade payment timestamp, the new package takes effect at **`D+2` `00:01:00 SGT`**.
  - Until `D+2 00:00:59 SGT` (inclusive of `00:00:00–00:00:59` on the effective date), the member continues using the original package's daily pairing cap.
  - At `00:00:00 SGT` on `D+2`, EOD carryover/flush completes first; at `00:01:00 SGT`, the tier switches and immediately attempts catch-up pairing using only BV remaining after EOD, with any points already paired during `00:00:00–00:00:59 SGT` counted toward the new cap.
- **Midnight `00:00 SGT` EOD Carryover & Chronological Replay**
  - Compares remaining BV after all settled pairings: larger BV leg carries over, weaker leg flushes to `0`.
  - Equal non-zero BV tie-breaks by active paid subtree headcount; equal BV and equal headcount follow the admin-configured tie-breaker (`KEEP_LEFT` demo default).
  - Scheduler delays and out-of-order callbacks replay milestones in strict business timestamp order (`00:00` EOD -> `00:01` upgrade -> later BV credits), storing both business effective time and actual processing time alongside the `ruleVersion`.
- **Withdrawable Points Wallet & Demo USD Payout**
  - Strictly separated modeling for BV (`Int`), Withdrawable Points (`0.01` point smallest integer unit), and USD (`cents`).
  - 20% withdrawal fee, rate & fee snapshots saved at request submission, lock-on-request, separate Approval & Payout tracking, automatic lock release on rejection.
- **Bilingual UI (`en` default / `zh-CN`)**
  - Mobile-first dark interface with bottom navigation on mobile, sidebar on desktop, SGT labels on all times, and explicit **Estimated** disclaimers on upgrade/carryover previews.

---

## Local Setup

### 1. Environment Variables
```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL`: Primary PostgreSQL URL
- `TEST_DATABASE_URL`: Isolated PostgreSQL URL for `npm test`
- `AUTH_SECRET`: Random secret for Auth.js JWT sessions
- `NEXTAUTH_URL`: Base URL (e.g., `http://localhost:3000`)
- `CRON_SECRET`: Bearer token protecting `POST /api/cron/eod`

### 2. Install, Migrate & Seed

```bash
npm install
npm run db:deploy
npm run db:seed
```

To migrate any legacy pending upgrade records to `D+2 00:01:00 SGT` while preserving original payment confirmation timestamps:
```bash
npx tsx src/scripts/migrate-pending-upgrades.ts
```

Start the development server:

```bash
npm run dev
```

---

## Demo Accounts (Seeded)

All demo accounts share the password: `Password123!`

| Role | Email | Member Code | Notes |
| --- | --- | --- | --- |
| **Admin** | `admin@binaryportal.io` | `BM100001` | Root `P1000` node; full access to `/admin/*` |
| **Member** | `alex@binaryportal.io` | `BM100002` | `P100` with `500 BV` Left / `500 BV` Right & `100/100` paired today |
| **Member (Waiting Upgrade)** | `sarah@binaryportal.io` | `BM100003` | `P500` with confirmed upgrade to `P1000` waiting effective at `D+2 00:01:00 SGT` |
| **Pending** | `pending@binaryportal.io` | `BM100008` | `PAID_DEMO` initial `P500` order awaiting Admin placement & confirmation |

---

## Running Tests & Production Build

```bash
# Apply migrations to isolated test DB
DATABASE_URL="postgresql://rms@127.0.0.1:5432/binary_member_portal_test?schema=public" npx prisma migrate deploy

# Typecheck, automated Vitest suite & reproducible TestClock E2E suite (A-E)
npm run typecheck
npm test
npm run test:e2e

# Build & start production server
npm run build
npm run start
```

---

## Task Scheduling (`00:00 SGT` EOD & `00:01 SGT` Upgrades)

Schedule execution at `00:00 SGT` (`16:00 UTC`) and `00:01 SGT` (`16:01 UTC`):

```cron
0 16 * * * cd /path/to/app && npm run cron:eod >> /var/log/bmp-eod.log 2>&1
1 16 * * * cd /path/to/app && npm run cron:eod >> /var/log/bmp-eod.log 2>&1
```

Or via HTTP:
```bash
curl -X POST https://your-domain.com/api/cron/eod \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## Pending Project Confirmation (Demo Defaults)

Before enabling production settlement and payouts, the project owner must confirm these configurable defaults (visible in `/admin/config` and versioned via `RuleVersionRecord`):

1. **Upgrade Payment Calculation**: Currently `DIFFERENCE` (price difference between current and target tier).
2. **Upgrade BV Generation**: Currently `false` (`0 BV`; upgrade only raises daily pairing cap).
3. **Upgrade Direct Referral Commission**: Currently `false`.
4. **EOD Active Headcount Definition**: Currently `ACTIVE_PAID_ALL_DEPTHS` (all active paid nodes across all depths at the `00:00 SGT` boundary).
5. **EOD Tie-Breaker (Equal BV & Equal Headcount)**: Currently `KEEP_LEFT` (retains Left BV, flushes Right BV).
6. **Withdrawal USD Exchange Rate & Production Payout Gate**: Currently `1 Point = US$1.00` (`isDemoRate = true`, `productionPayoutEnabled = false`).
7. **P1000 Daily Cap**: Currently `1,000` withdrawable points/day.
