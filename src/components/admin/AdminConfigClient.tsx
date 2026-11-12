"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, History, Settings, Wallet } from "lucide-react";
import type { Locale } from "@/lib/i18n";
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
  nameZh?: string;
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
  locale = "en",
  config,
  tiers,
  versions,
}: {
  locale?: Locale;
  config: ConfigDto;
  tiers: TierDto[];
  versions: RuleVersionDto[];
}) {
  const isZh = locale === "zh-CN";
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
      setBanner({
        type: "err",
        text: isZh ? "USDT 换算汇率无效" : "Invalid USDT exchange rate",
      });
      setSaving(false);
      return;
    }

    const minConfs = Math.round(Number(usdtMinConfirmations));
    const procHours = Math.round(Number(usdtProcessingHours));
    const tierUsdtPrices: Record<string, string> = {};
    for (const t of tiers) {
      const n = Number(tierUsdtMap[t.code]);
      if (!Number.isFinite(n) || n <= 0) {
        setBanner({
          type: "err",
          text: isZh ? `${t.code} 的 USDT 定价无效` : `Invalid USDT price for ${t.code}`,
        });
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
      setBanner({
        type: "err",
        text: data.error || (isZh ? "保存配置失败" : "Failed to save configuration"),
      });
      return;
    }
    setChangeNote("");
    setBanner({
      type: "ok",
      text: isZh
        ? `配置已保存为规则版本 v${data.config.ruleVersion} 并记入审计日志。`
        : `Configuration saved as Rule Version v${data.config.ruleVersion} and recorded in Audit Log.`,
    });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {isZh ? "配套、结算规则与版本配置" : "Packages, Rules & Rule Versions"}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {isZh
              ? "集中管理当前生效结算参数、TRC20 USDT 收付款地址配置及不可篡改规则版本历史。"
              : "Centralized view of active settlement rules, parameters, and immutable version history."}
          </p>
        </div>
        <span className="rounded-full border border-[#CBB487]/40 bg-[#CBB487]/15 px-3 py-1 text-xs font-semibold text-[#CBB487]">
          {isZh ? `当前生效规则版本: v${config.ruleVersion}` : `Active Rule Version: v${config.ruleVersion}`}
        </span>
      </div>

      {/* Active Rules Summary */}
      <div className="flex items-start gap-3 rounded-2xl border border-[#CBB487]/25 bg-[#141619] p-4 text-xs text-[#D6D3CC]">
        <Settings className="mt-0.5 h-5 w-5 shrink-0 text-[#CBB487]" />
        <div>
          <div className="font-semibold text-[#F2F0EB]">
            {isZh ? "当前线上结算规则策略 (SGT)" : "Active Production Settlement Policy (SGT)"}
          </div>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[#A7AEBC]">
            {isZh ? (
              <>
                <li>计量标准：团队区、对碰及 00:00 SGT 日结使用 BV；奖金、余额与提现使用 U / USDT（1 U = 1 BV）</li>
                <li>升级计价方式：差额补缴（{config.upgradePriceMode}）</li>
                <li>升级赠送 BV 与直推佣金：0 BV / 关闭（仅提升每日对碰封顶）</li>
                <li>日结活跃人数口径：统计双边全深度所有已激活付款会员（{config.headcountRule}）</li>
                <li>日结同分同人数判定：保留左区（{config.tieBreakerRule}）</li>
                <li>结算换算与直推：1 U = {config.withdrawalUsdRateMicros / 1_000_000} USDT · 直推奖励 25% BV → U（不受日封顶限制）</li>
                <li>每日对碰封顶：P100 = 100 U/天 · P500 = 500 U/天 · P1000 = 1,000 U/天</li>
              </>
            ) : (
              <>
                <li>Unit Standard: BV (team legs, matching, 00:00 SGT rollover) &amp; U / USDT (1 U = 1 BV)</li>
                <li>Upgrade Payment: Price Difference ({config.upgradePriceMode})</li>
                <li>Upgrade BV &amp; Direct Commission: 0 BV / Disabled (cap-only upgrade)</li>
                <li>EOD Active Headcount Definition: All active paid nodes across all subtree depths ({config.headcountRule})</li>
                <li>EOD Tie-Breaker (Equal BV &amp; Equal Headcount): Retain Left ({config.tieBreakerRule})</li>
                <li>Settlement Equivalence: 1 U = {config.withdrawalUsdRateMicros / 1_000_000} USDT · Direct Bonus: 25% BV → U (independent of daily pairing cap)</li>
                <li>Daily Pairing Caps: P100 = 100 U/day · P500 = 500 U/day · P1000 = 1,000 U/day</li>
              </>
            )}
          </ul>
          <div className="mt-2.5 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
            {isZh ? (
              <>
                <strong>待确认规则说明：</strong>{" "}
                <span className="font-semibold">直推 U</span>（推荐奖励）与{" "}
                <span className="font-semibold">对碰 U</span>（双轨钱包）之间的独立提现门槛与分账手续费规则待最终业务确认；当前钱包余额提现按{" "}
                {config.withdrawalFeeRateBps / 100}% 手续费以 U (USDT) 执行出款。
              </>
            ) : (
              <>
                <strong>Pending Confirmation (待确认):</strong> Separate withdrawal eligibility &amp; fee rules between{" "}
                <span className="font-semibold">Direct U</span> (referral rewards) and{" "}
                <span className="font-semibold">Pairing U</span> (binary wallet) are pending final confirmation; wallet balance withdrawals currently execute in U (USDT) at the configured {config.withdrawalFeeRateBps / 100}% fee.
              </>
            )}
          </div>
        </div>
      </div>

      {/* Package Tiers */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">
          {isZh ? "当前启用配套等级" : "Active Package Tiers"}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.code}
              className="rounded-xl border border-white/10 bg-[#08090B] p-4 text-xs"
            >
              <div className="font-bold text-[#D8C39A]">
                {tier.code} · {isZh ? tier.nameZh ?? tier.nameEn : tier.nameEn}
              </div>
              <div className="mt-2 tabular-nums text-lg font-semibold text-white">
                {formatU(tier.priceUsdCents)} U
              </div>
              <div className="mt-0.5 tabular-nums text-xs font-medium text-[#CBB487]">
                {formatUsdtMicros(tier.priceUsdtMicros)}
              </div>
              <div className="mt-1 tabular-nums text-zinc-400">
                {isZh
                  ? `BV: ${tier.bv} BV · 每日封顶: ${formatU(tier.dailyCapPointsCents)} U`
                  : `BV: ${tier.bv} BV · Daily Cap: ${formatU(tier.dailyCapPointsCents)} U`}
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
          <span>
            {isZh
              ? "可配置业务与结算参数（保存后将生成新规则版本）"
              : "Editable Business & Settlement Parameters (Creates New Rule Version)"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              {isZh
                ? "00:00 SGT 日结同分同人数判定规则"
                : "00:00 SGT Tie-Breaker (Equal BV & Equal Headcount)"}
            </label>
            <select
              value={tieBreakerRule}
              onChange={(e) =>
                setTieBreakerRule(e.target.value as "KEEP_LEFT" | "KEEP_RIGHT")
              }
              className="w-full rounded-xl border border-white/10 bg-[#08090B] px-3.5 py-2.5 text-xs text-white"
            >
              <option value="KEEP_LEFT">
                {isZh ? "KEEP_LEFT（保留左区，清零右区）" : "KEEP_LEFT (Retain Left, Flush Right)"}
              </option>
              <option value="KEEP_RIGHT">
                {isZh ? "KEEP_RIGHT（保留右区，清零左区）" : "KEEP_RIGHT (Retain Right, Flush Left)"}
              </option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              {isZh ? "配套升级应付金额计算方式" : "Upgrade Payment Calculation"}
            </label>
            <select
              value={upgradePriceMode}
              onChange={(e) =>
                setUpgradePriceMode(e.target.value as "DIFFERENCE" | "FULL")
              }
              className="w-full rounded-xl border border-white/10 bg-[#08090B] px-3.5 py-2.5 text-xs text-white"
            >
              <option value="DIFFERENCE">
                {isZh ? "DIFFERENCE（补交配套差价）" : "DIFFERENCE (Pay Tier Price Difference)"}
              </option>
              <option value="FULL">
                {isZh ? "FULL（按目标配套全额支付）" : "FULL (Pay Full Target Package Price)"}
              </option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              {isZh ? "USDT 结算汇率（每 1 U 对应 USDT）" : "USDT Conversion Rate (USDT per 1 U)"}
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
            <div className="font-medium text-zinc-200">
              {isZh ? "固定核心算法公式 (SGT)" : "Fixed Core Formulas (SGT)"}
            </div>
            <div className="mt-1">
              {isZh ? "直推奖励: " : "Direct Reward: "}
              {config.directCommissionRateBps / 100}% × BV → U
            </div>
            <div>
              {isZh ? "双轨对碰: " : "Pairing: "}
              {config.pairingUnitBv} BV {isZh ? "左" : "L"} + {config.pairingUnitBv} BV{" "}
              {isZh ? "右" : "R"} → {formatU(config.pairingRewardPointsCents)} U
            </div>
            <div>
              {isZh
                ? `升级生效: 确认后 D+${config.upgradeEffectiveDaysOffset} 日 ${config.upgradeEffectiveTimeSgt} SGT`
                : `Upgrade Effective: D+${config.upgradeEffectiveDaysOffset} at ${config.upgradeEffectiveTimeSgt} SGT`}
            </div>
            <div>
              {isZh
                ? `午夜结转: 00:00:00 SGT · 提现手续费: ${config.withdrawalFeeRateBps / 100}%`
                : `EOD Carryover: 00:00:00 SGT · Withdrawal Fee: ${config.withdrawalFeeRateBps / 100}%`}
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
            <span>
              {isZh ? "升级产生 BV（默认关闭 / 0 BV）" : "Upgrade Grants BV (Default: Off / 0 BV)"}
            </span>
          </label>

          <label className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#08090B] p-3 text-xs text-zinc-200">
            <input
              type="checkbox"
              checked={upgradeTriggersDirectCommission}
              onChange={(e) => setUpgradeTriggersDirectCommission(e.target.checked)}
              className="h-4 w-4 accent-[#CBB487]"
            />
            <span>
              {isZh
                ? "升级触发直推奖金（默认关闭）"
                : "Upgrade Triggers Direct Commission (Default: Off)"}
            </span>
          </label>

          <label className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#08090B] p-3 text-xs text-zinc-200">
            <input
              type="checkbox"
              checked={isDemoRate}
              onChange={(e) => setIsDemoRate(e.target.checked)}
              className="h-4 w-4 accent-[#CBB487]"
            />
            <span>
              {isZh
                ? "在会员钱包显示参考汇率提示"
                : "Display Fixed Reference Rate Notice in Member Wallet"}
            </span>
          </label>

          <label className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#08090B] p-3 text-xs text-zinc-200">
            <input
              type="checkbox"
              checked={productionPayoutEnabled}
              onChange={(e) => setProductionPayoutEnabled(e.target.checked)}
              className="h-4 w-4 accent-[#CBB487]"
            />
            <span>
              {isZh ? "启用自动出款网关" : "Enable Automated Payout Gateway"}
            </span>
          </label>
        </div>

        {/* USDT Collection & Payout Parameters */}
        <div className="space-y-4 rounded-xl border border-[#CBB487]/25 bg-[#08090B] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#CBB487]">
            <Wallet className="h-4 w-4" />
            <span>
              {isZh
                ? "USDT 收付款结算配置（仅保存公钥地址，绝不存储私钥）"
                : "Phase 1 USDT Settlement Config (Public Addresses Only — Zero Private Keys)"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-300">
                {isZh ? "USDT 网络" : "USDT Network"}
              </label>
              <input
                type="text"
                value={usdtNetwork}
                onChange={(e) => setUsdtNetwork(e.target.value)}
                className="font-mono-sgt w-full rounded-xl border border-white/10 bg-[#141619] px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-300">
                {isZh ? "USDT 合约地址" : "USDT Token Contract"}
              </label>
              <input
                type="text"
                value={usdtContractAddress}
                onChange={(e) => setUsdtContractAddress(e.target.value)}
                className="font-mono-sgt w-full rounded-xl border border-white/10 bg-[#141619] px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-300">
                {isZh ? "公司固定收款地址 (入金)" : "Company Fixed Deposit Address"}
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
                {isZh ? "公司财务出款地址 (提现)" : "Company Treasury Payout Address"}
              </label>
              <input
                type="text"
                value={usdtPayoutAddress}
                onChange={(e) => setUsdtPayoutAddress(e.target.value)}
                className="font-mono-sgt w-full rounded-xl border border-white/10 bg-[#141619] px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-300">
                {isZh ? "最小区块确认数" : "Min Block Confirmations"}
              </label>
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
                {isZh ? "提现处理 SLA 时限 (小时)" : "Withdrawal SLA Deadline (Hours)"}
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
                  {isZh ? `${t.code} 应收 USDT` : `${t.code} Receivable USDT`}
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
              <span>{isZh ? "开启会员 USDT 入金付款" : "Enable Member USDT Deposits"}</span>
            </label>

            <label className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#141619] p-3 text-xs text-zinc-200">
              <input
                type="checkbox"
                checked={usdtWithdrawalsEnabled}
                onChange={(e) => setUsdtWithdrawalsEnabled(e.target.checked)}
                className="h-4 w-4 accent-[#CBB487]"
              />
              <span>{isZh ? "开启会员 USDT 提现申请" : "Enable Member USDT Withdrawals"}</span>
            </label>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-300">
            {isZh ? "变更原因 / 版本备注" : "Change Reason / Version Note"}
          </label>
          <input
            type="text"
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder={
              isZh ? "选填：随本规则版本一并记录..." : "Optional note recorded with this rule version..."
            }
            className="w-full rounded-xl border border-white/10 bg-[#08090B] px-3.5 py-2 text-xs text-white"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-[#CBB487] px-5 py-2.5 text-xs font-semibold text-[#08090B] hover:bg-[#D8C39A] disabled:opacity-50"
        >
          {saving
            ? isZh
              ? "正在保存..."
              : "Saving..."
            : isZh
              ? `保存为规则 v${config.ruleVersion + 1}`
              : `Save as Rule v${config.ruleVersion + 1}`}
        </button>
      </form>

      {/* Rule Version History */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#141619] p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <History className="h-4 w-4 text-[#CBB487]" />
          <span>{isZh ? "规则版本变更历史" : "Rule Version History"}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/[0.08] text-zinc-400">
              <tr>
                <th className="py-2 pr-3">{isZh ? "版本号" : "Version"}</th>
                <th className="py-2 pr-3">{isZh ? "日结同分判定" : "Tie-Breaker"}</th>
                <th className="py-2 pr-3">{isZh ? "升级计价与BV" : "Upgrade Mode"}</th>
                <th className="py-2 pr-3">{isZh ? "USDT 汇率" : "USDT Rate"}</th>
                <th className="py-2 pr-3">{isZh ? "备注" : "Note"}</th>
                <th className="py-2 pr-3">{isZh ? "创建时间 (SGT)" : "Created (SGT)"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {versions.map((v) => (
                <tr key={v.version}>
                  <td className="py-2 pr-3 font-semibold text-[#D8C39A]">v{v.version}</td>
                  <td className="py-2 pr-3 text-zinc-300">
                    {isZh
                      ? v.tieBreakerRule === "KEEP_LEFT"
                        ? "保留左区"
                        : "保留右区"
                      : v.tieBreakerRule}
                  </td>
                  <td className="py-2 pr-3 text-zinc-300">
                    {isZh
                      ? v.upgradePriceMode === "DIFFERENCE"
                        ? "差额升级"
                        : "全额升级"
                      : v.upgradePriceMode}{" "}
                    / {v.upgradeGrantsBv ? "BV" : "0 BV"}
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
