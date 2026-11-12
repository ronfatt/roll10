"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, History, Settings, Wallet } from "lucide-react";
import { formatU, formatUsdtMicros } from "@/lib/money";

interface ConfigDto {
  ruleVersion: number;
  tieBreakerRule: "KEEP_LEFT" | "KEEP_RIGHT";
  headcountRule: string;
  upgradePriceMode: "DIFFERENCE" | "FULL";
  upgradeGrantsBv: boolean;
  upgradeTriggersDirectCommission: boolean;
  upgradeEffectiveDaysOffset: number;
  upgradeEffectiveTimeSgt: string;
  directCommissionRateBps: number;
  pairingUnitBv: number;
  pairingRewardPointsCents: number;
  withdrawalFeeRateBps: number;
  withdrawalUsdRateMicros: number;
  isDemoRate: boolean;
  productionPayoutEnabled: boolean;
  usdtNetwork: string;
  usdtContractAddress: string;
  usdtDepositAddress: string;
  usdtPayoutAddress: string;
  usdtMinConfirmations: number;
  usdtWithdrawalProcessingHours: number;
  usdtDepositsEnabled: boolean;
  usdtWithdrawalsEnabled: boolean;
}

interface TierDto {
  code: string;
  nameEn: string;
  priceUsdCents: number;
  priceUsdtMicros: string;
  bv: number;
  dailyCapPointsCents: number;
}

interface RuleVersionDto {
  version: number;
  tieBreakerRule: string;
  upgradePriceMode: string;
  upgradeGrantsBv: boolean;
  upgradeTriggersDirectCommission: boolean;
  withdrawalUsdRateMicros: number;
  changeNote: string | null;
  createdAtLabel: string;
}

export function AdminConfigClient({
  config,
  tiers,
  versions,
}: {
  config: ConfigDto;
  tiers: TierDto[];
  versions: RuleVersionDto[];
}) {
  const router = useRouter();
  const [tieBreakerRule, setTieBreakerRule] = useState(config.tieBreakerRule);
  const [upgradePriceMode, setUpgradePriceMode] = useState(config.upgradePriceMode);
  const [upgradeGrantsBv, setUpgradeGrantsBv] = useState(config.upgradeGrantsBv);
  const [upgradeTriggersDirectCommission, setUpgradeTriggersDirectCommission] = useState(
    config.upgradeTriggersDirectCommission
  );
  const [usdRateInput, setUsdRateInput] = useState(
    String(config.withdrawalUsdRateMicros / 1_000_000)
  );
  const [isDemoRate, setIsDemoRate] = useState(config.isDemoRate);
  const [productionPayoutEnabled, setProductionPayoutEnabled] = useState(
    config.productionPayoutEnabled
  );
  const [usdtNetwork, setUsdtNetwork] = useState(config.usdtNetwork);
  const [usdtContractAddress, setUsdtContractAddress] = useState(config.usdtContractAddress);
  const [usdtDepositAddress, setUsdtDepositAddress] = useState(config.usdtDepositAddress);
  const [usdtPayoutAddress, setUsdtPayoutAddress] = useState(config.usdtPayoutAddress);
  const [usdtMinConfirmations, setUsdtMinConfirmations] = useState(
    String(config.usdtMinConfirmations)
  );
  const [usdtProcessingHours, setUsdtProcessingHours] = useState(
    String(config.usdtWithdrawalProcessingHours)
  );
  const [usdtDepositsEnabled, setUsdtDepositsEnabled] = useState(config.usdtDepositsEnabled);
  const [usdtWithdrawalsEnabled, setUsdtWithdrawalsEnabled] = useState(
    config.usdtWithdrawalsEnabled
  );
  const [tierUsdtMap, setTierUsdtMap] = useState<Record<string, string>>(
    Object.fromEntries(
      tiers.map((t) => [t.code, String(Number(t.priceUsdtMicros) / 1_000_000)])
    )
  );
  const [changeNote, setChangeNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setBanner(null);

    const rateNum = Number(usdRateInput);
    if (!Number.isFinite(rateNum) || rateNum <= 0) {
      setBanner({ type: "err", text: "Invalid USDT exchange rate" });
      setSaving(false);
      return;
    }

    const minConfs = Math.round(Number(usdtMinConfirmations));
    const procHours = Math.round(Number(usdtProcessingHours));
    const tierUsdtPrices: Record<string, string> = {};
    for (const t of tiers) {
      const n = Number(tierUsdtMap[t.code]);
      if (!Number.isFinite(n) || n <= 0) {
        setBanner({ type: "err", text: `Invalid USDT price for ${t.code}` });
        setSaving(false);
        return;
      }
      tierUsdtPrices[t.code] = String(Math.round(n * 1_000_000));
    }

    const res = await fetch("/api/admin/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tieBreakerRule,
        upgradePriceMode,
        upgradeGrantsBv,
        upgradeTriggersDirectCommission,
        withdrawalUsdRateMicros: Math.round(rateNum * 1_000_000),
        isDemoRate,
        productionPayoutEnabled,
        usdtNetwork: usdtNetwork.trim(),
        usdtContractAddress: usdtContractAddress.trim(),
        usdtDepositAddress: usdtDepositAddress.trim(),
        usdtPayoutAddress: usdtPayoutAddress.trim(),
        usdtMinConfirmations: minConfs,
        usdtWithdrawalProcessingHours: procHours,
        usdtDepositsEnabled,
        usdtWithdrawalsEnabled,
        tierUsdtPrices,
        changeNote,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok || !data.ok) {
      setBanner({ type: "err", text: data.error || "Failed to save configuration" });
      return;
    }
    setChangeNote("");
    setBanner({
      type: "ok",
      text: `Configuration saved as Rule Version v${data.config.ruleVersion} and recorded in Audit Log.`,
    });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Packages, Rules & Rule Versions
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Centralized view of active settlement rules, parameters, and immutable version history.
          </p>
        </div>
        <span className="rounded-full border border-[#CBB487]/40 bg-[#CBB487]/15 px-3 py-1 text-xs font-semibold text-[#CBB487]">
          Active Rule Version: v{config.ruleVersion}
        </span>
      </div>

      {/* Active Rules Summary */}
      <div className="flex items-start gap-3 rounded-2xl border border-[#CBB487]/25 bg-[#141619] p-4 text-xs text-[#D6D3CC]">
        <Settings className="mt-0.5 h-5 w-5 shrink-0 text-[#CBB487]" />
        <div>
          <div className="font-semibold text-[#F2F0EB]">
            Active Production Settlement Policy (SGT)
          </div>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[#A7AEBC]">
            <li>Unit Standard: BV (team legs, matching, 00:00 SGT rollover) &amp; U / USDT (1 U = 1 BV)</li>
            <li>Upgrade Payment: Price Difference ({config.upgradePriceMode})</li>
            <li>Upgrade BV &amp; Direct Commission: 0 BV / Disabled (cap-only upgrade)</li>
            <li>EOD Active Headcount Definition: All active paid nodes across all subtree depths ({config.headcountRule})</li>
            <li>EOD Tie-Breaker (Equal BV &amp; Equal Headcount): Retain Left ({config.tieBreakerRule})</li>
            <li>Settlement Equivalence: 1 U = {config.withdrawalUsdRateMicros / 1_000_000} USDT · Direct Bonus: 25% BV → U (independent of daily pairing cap)</li>
            <li>Daily Pairing Caps: P100 = 100 U/day · P500 = 500 U/day · P1000 = 1,000 U/day</li>
          </ul>
          <div className="mt-2.5 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
            <strong>Pending Confirmation (待确认):</strong> Separate withdrawal eligibility &amp; fee rules between{" "}
            <span className="font-semibold">Direct U</span> (referral rewards) and{" "}
            <span className="font-semibold">Pairing U</span> (binary wallet) are pending final confirmation; wallet balance withdrawals currently execute in U (USDT) at the configured {config.withdrawalFeeRateBps / 100}% fee.
          </div>
        </div>
      </div>

      {/* Package Tiers */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">Active Package Tiers</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.code}
              className="rounded-xl border border-white/10 bg-[#08090B] p-4 text-xs"
            >
              <div className="font-bold text-[#D8C39A]">
                {tier.code} · {tier.nameEn}
              </div>
              <div className="mt-2 tabular-nums text-lg font-semibold text-white">
                {formatU(tier.priceUsdCents)} U
              </div>
              <div className="mt-0.5 tabular-nums text-xs font-medium text-[#CBB487]">
                {formatUsdtMicros(tier.priceUsdtMicros)}
              </div>
              <div className="mt-1 tabular-nums text-zinc-400">
                BV: {tier.bv} BV · Daily Cap: {formatU(tier.dailyCapPointsCents)} U
              </div>
            </div>
          ))}
        </div>
      </div>

      {banner && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs ${
            banner.type === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-300"
          }`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{banner.text}</span>
        </div>
      )}

      {/* Configurable Rules Form */}
      <form
        onSubmit={handleSave}
        className="space-y-5 rounded-2xl border border-white/[0.08] bg-[#141619] p-5 sm:p-6"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Settings className="h-4 w-4 text-[#CBB487]" />
          <span>Editable Business & Settlement Parameters (Creates New Rule Version)</span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              00:00 SGT Tie-Breaker (Equal BV & Equal Headcount)
            </label>
            <select
              value={tieBreakerRule}
              onChange={(e) =>
                setTieBreakerRule(e.target.value as "KEEP_LEFT" | "KEEP_RIGHT")
              }
              className="w-full rounded-xl border border-white/10 bg-[#08090B] px-3.5 py-2.5 text-xs text-white"
            >
              <option value="KEEP_LEFT">KEEP_LEFT (Retain Left, Flush Right)</option>
              <option value="KEEP_RIGHT">KEEP_RIGHT (Retain Right, Flush Left)</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              Upgrade Payment Calculation
            </label>
            <select
              value={upgradePriceMode}
              onChange={(e) =>
                setUpgradePriceMode(e.target.value as "DIFFERENCE" | "FULL")
              }
              className="w-full rounded-xl border border-white/10 bg-[#08090B] px-3.5 py-2.5 text-xs text-white"
            >
              <option value="DIFFERENCE">DIFFERENCE (Pay Tier Price Difference)</option>
              <option value="FULL">FULL (Pay Full Target Package Price)</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              USDT Conversion Rate (USDT per 1 U)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={usdRateInput}
              onChange={(e) => setUsdRateInput(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#08090B] px-3.5 py-2.5 tabular-nums text-xs text-white"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-[#08090B] p-3 text-xs text-zinc-400">
            <div className="font-medium text-zinc-200">Fixed Core Formulas (SGT)</div>
            <div className="mt-1">Direct Reward: {config.directCommissionRateBps / 100}% × BV → U</div>
            <div>
              Pairing: {config.pairingUnitBv} BV L + {config.pairingUnitBv} BV R →{" "}
              {formatU(config.pairingRewardPointsCents)} U
            </div>
            <div>
              Upgrade Effective: D+{config.upgradeEffectiveDaysOffset} at{" "}
              {config.upgradeEffectiveTimeSgt} SGT
            </div>
            <div>
              EOD Carryover: 00:00:00 SGT · Withdrawal Fee: {config.withdrawalFeeRateBps / 100}%
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#08090B] p-3 text-xs text-zinc-200">
            <input
              type="checkbox"
              checked={upgradeGrantsBv}
              onChange={(e) => setUpgradeGrantsBv(e.target.checked)}
              className="h-4 w-4 accent-[#CBB487]"
            />
            <span>Upgrade Grants BV (Default: Off / 0 BV)</span>
          </label>

          <label className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#08090B] p-3 text-xs text-zinc-200">
            <input
              type="checkbox"
              checked={upgradeTriggersDirectCommission}
              onChange={(e) => setUpgradeTriggersDirectCommission(e.target.checked)}
              className="h-4 w-4 accent-[#CBB487]"
            />
            <span>Upgrade Triggers Direct Commission (Default: Off)</span>
          </label>

          <label className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#08090B] p-3 text-xs text-zinc-200">
            <input
              type="checkbox"
              checked={isDemoRate}
              onChange={(e) => setIsDemoRate(e.target.checked)}
              className="h-4 w-4 accent-[#CBB487]"
            />
            <span>Display Fixed Reference Rate Notice in Member Wallet</span>
          </label>

          <label className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#08090B] p-3 text-xs text-zinc-200">
            <input
              type="checkbox"
              checked={productionPayoutEnabled}
              onChange={(e) => setProductionPayoutEnabled(e.target.checked)}
              className="h-4 w-4 accent-[#CBB487]"
            />
            <span>Enable Automated Payout Gateway</span>
          </label>
        </div>

        {/* USDT Collection & Payout Parameters */}
        <div className="space-y-4 rounded-xl border border-[#CBB487]/25 bg-[#08090B] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#CBB487]">
            <Wallet className="h-4 w-4" />
            <span>Phase 1 USDT Settlement Config (Public Addresses Only — Zero Private Keys)</span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-300">USDT Network</label>
              <input
                type="text"
                value={usdtNetwork}
                onChange={(e) => setUsdtNetwork(e.target.value)}
                className="font-mono-sgt w-full rounded-xl border border-white/10 bg-[#141619] px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-300">USDT Token Contract</label>
              <input
                type="text"
                value={usdtContractAddress}
                onChange={(e) => setUsdtContractAddress(e.target.value)}
                className="font-mono-sgt w-full rounded-xl border border-white/10 bg-[#141619] px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-300">
                Company Fixed Deposit Address
              </label>
              <input
                type="text"
                value={usdtDepositAddress}
                onChange={(e) => setUsdtDepositAddress(e.target.value)}
                className="font-mono-sgt w-full rounded-xl border border-white/10 bg-[#141619] px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-300">
                Company Treasury Payout Address
              </label>
              <input
                type="text"
                value={usdtPayoutAddress}
                onChange={(e) => setUsdtPayoutAddress(e.target.value)}
                className="font-mono-sgt w-full rounded-xl border border-white/10 bg-[#141619] px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-300">Min Block Confirmations</label>
              <input
                type="number"
                min="1"
                max="200"
                value={usdtMinConfirmations}
                onChange={(e) => setUsdtMinConfirmations(e.target.value)}
                className="tabular-nums w-full rounded-xl border border-white/10 bg-[#141619] px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-300">
                Withdrawal SLA Deadline (Hours)
              </label>
              <input
                type="number"
                min="1"
                max="720"
                value={usdtProcessingHours}
                onChange={(e) => setUsdtProcessingHours(e.target.value)}
                className="tabular-nums w-full rounded-xl border border-white/10 bg-[#141619] px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {tiers.map((t) => (
              <div key={t.code}>
                <label className="mb-1 block text-xs text-zinc-300">
                  {t.code} Receivable USDT
                </label>
                <input
                  type="number"
                  step="0.000001"
                  min="1"
                  value={tierUsdtMap[t.code] ?? ""}
                  onChange={(e) =>
                    setTierUsdtMap((prev) => ({ ...prev, [t.code]: e.target.value }))
                  }
                  className="tabular-nums w-full rounded-xl border border-white/10 bg-[#141619] px-3 py-2 text-xs text-white"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#141619] p-3 text-xs text-zinc-200">
              <input
                type="checkbox"
                checked={usdtDepositsEnabled}
                onChange={(e) => setUsdtDepositsEnabled(e.target.checked)}
                className="h-4 w-4 accent-[#CBB487]"
              />
              <span>Enable Member USDT Deposits</span>
            </label>

            <label className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#141619] p-3 text-xs text-zinc-200">
              <input
                type="checkbox"
                checked={usdtWithdrawalsEnabled}
                onChange={(e) => setUsdtWithdrawalsEnabled(e.target.checked)}
                className="h-4 w-4 accent-[#CBB487]"
              />
              <span>Enable Member USDT Withdrawals</span>
            </label>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-300">
            Change Reason / Version Note
          </label>
          <input
            type="text"
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="Optional note recorded with this rule version..."
            className="w-full rounded-xl border border-white/10 bg-[#08090B] px-3.5 py-2 text-xs text-white"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-[#CBB487] px-5 py-2.5 text-xs font-semibold text-[#08090B] hover:bg-[#D8C39A] disabled:opacity-50"
        >
          {saving ? "Saving..." : `Save as Rule v${config.ruleVersion + 1}`}
        </button>
      </form>

      {/* Rule Version History */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <History className="h-4 w-4 text-[#CBB487]" />
          <span>Rule Version History</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/[0.08] text-zinc-400">
              <tr>
                <th className="py-2 pr-3">Version</th>
                <th className="py-2 pr-3">Tie-Breaker</th>
                <th className="py-2 pr-3">Upgrade Mode</th>
                <th className="py-2 pr-3">USDT Rate</th>
                <th className="py-2 pr-3">Note</th>
                <th className="py-2 pr-3">Created (SGT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {versions.map((v) => (
                <tr key={v.version}>
                  <td className="py-2 pr-3 font-semibold text-[#D8C39A]">v{v.version}</td>
                  <td className="py-2 pr-3 text-zinc-300">{v.tieBreakerRule}</td>
                  <td className="py-2 pr-3 text-zinc-300">
                    {v.upgradePriceMode} / {v.upgradeGrantsBv ? "BV" : "0 BV"}
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-zinc-200">
                    {v.withdrawalUsdRateMicros / 1_000_000} USDT
                  </td>
                  <td className="py-2 pr-3 text-zinc-400">{v.changeNote ?? "—"}</td>
                  <td className="py-2 pr-3 tabular-nums text-zinc-400">{v.createdAtLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
