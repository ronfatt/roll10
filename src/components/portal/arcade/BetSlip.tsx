"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Coins,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { QUICK_STAKES } from "./data";
import type { SelectedBet } from "./types";

interface BetSlipProps {
  selectedBets: SelectedBet[];
  onRemoveBet: (id: string) => void;
  onClearAll: () => void;
  onConfirmBet: (bets: SelectedBet[], stakeCp: number) => void;
  cpBalanceCents: number; // in cents e.g. 35000 = 350 CP
  issueNo: string;
  isZh?: boolean;
}

export function BetSlip({
  selectedBets,
  onRemoveBet,
  onClearAll,
  onConfirmBet,
  cpBalanceCents,
  issueNo,
  isZh = true,
}: BetSlipProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [stakeCp, setStakeCp] = useState<number>(100);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableCp = cpBalanceCents / 100;

  if (selectedBets.length === 0) {
    return null;
  }

  // Calculate highest odds or multi-bet total
  const primaryBet = selectedBets[0];
  const totalOdds = primaryBet ? primaryBet.odds : 0;
  const projectedReturn = (stakeCp || 0) * totalOdds;
  const projectedNet = projectedReturn - (stakeCp || 0);

  const isInsufficient = stakeCp > availableCp;
  const isValid = stakeCp > 0 && !isInsufficient;

  const handleQuickStake = (amount: number) => {
    setStakeCp(amount);
  };

  const handleMaxStake = () => {
    // Floor to nearest integer or max available
    const max = Math.floor(availableCp);
    setStakeCp(Math.max(1, max));
  };

  const handleSubmit = () => {
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);
    setTimeout(() => {
      onConfirmBet(selectedBets, stakeCp);
      setIsSubmitting(false);
      setIsExpanded(false);
    }, 400);
  };

  return (
    <>
      {/* Backdrop overlay when expanded */}
      {isExpanded && (
        <div
          aria-hidden="true"
          onClick={() => setIsExpanded(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-[2px] transition-opacity"
        />
      )}

      {/* Floating Bet Dock: positioned above fixed 5-item mobile nav */}
      <div className="fixed bottom-[64px] sm:bottom-[70px] left-0 right-0 z-35 px-3 sm:px-4 max-w-xl mx-auto pointer-events-auto">
        <div className="overflow-hidden rounded-2xl border border-[#E9C66B]/50 bg-[#10171B] shadow-[0_12px_40px_rgba(0,0,0,0.9),0_0_20px_rgba(233,198,107,0.15)] transition-all duration-300">
          {/* Collapsed Bar (Always Visible when bets exist) */}
          <div className="flex items-center justify-between p-2.5 sm:p-3 bg-gradient-to-r from-[#172126] to-[#10171B]">
            {/* Left: Summary pill & expand toggle */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 text-left group"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E9C66B] text-[#070B0D] font-black text-xs shadow-[0_0_10px_rgba(233,198,107,0.4)]">
                {selectedBets.length}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#F4F6F7]">
                    {primaryBet.pickDetail}
                  </span>
                  <span className="font-mono text-[11px] font-bold text-[#E9C66B]">
                    @{primaryBet.odds.toFixed(2)}x
                  </span>
                </div>
                <p className="text-[10px] text-[#829098]">
                  {isZh
                    ? `下注 ${stakeCp} CP · 预计最高返还 ${projectedReturn.toFixed(0)} CP`
                    : `Stake ${stakeCp} CP · Max return ${projectedReturn.toFixed(0)} CP`}
                </p>
              </div>
              <div className="text-[#829098] group-hover:text-[#00D9DF] transition-colors ml-1">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </div>
            </button>

            {/* Right: Quick confirm button or expand */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClearAll}
                title={isZh ? "清空选择" : "Clear"}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#29363D] bg-[#070B0D] text-[#829098] hover:text-rose-400 hover:border-rose-500/40 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isValid || isSubmitting}
                className={`min-h-[36px] px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isValid && !isSubmitting
                    ? "r10-btn-gold text-[#070B0D]"
                    : "bg-[#172126] text-[#829098] border border-[#29363D] cursor-not-allowed"
                }`}
              >
                {isSubmitting ? (
                  <span className="animate-pulse">{isZh ? "提交中..." : "Submitting..."}</span>
                ) : isInsufficient ? (
                  <span>{isZh ? "余额不足" : "No Balance"}</span>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>
                      {isZh ? "投注" : "Bet"}{" "}
                      <span className="font-mono">{stakeCp}</span> CP
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Expanded Drawer Body */}
          {isExpanded && (
            <div className="p-3.5 sm:p-4 border-t border-[#29363D] bg-[#070B0D]/95 space-y-3.5 animate-in slide-in-from-bottom-2 duration-200">
              {/* Header: Issue & Balance */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-[#829098]">
                  {isZh ? "注单详情 · 第 " : "Issue: "}
                  <strong className="text-[#F4F6F7]">{issueNo}</strong> 期
                </span>

                <div className="flex items-center gap-1.5 text-xs">
                  <Wallet className="h-3.5 w-3.5 text-[#E9C66B]" />
                  <span className="text-[#829098]">{isZh ? "可用 CP:" : "Available:"}</span>
                  <span className="font-mono font-bold text-[#F4F6F7]">
                    {availableCp.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Selections List */}
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {selectedBets.map((bet) => (
                  <div
                    key={bet.id}
                    className="flex items-center justify-between rounded-xl border border-[#29363D] bg-[#10171B] p-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[#00D9DF]/15 text-[#00D9DF] border border-[#00D9DF]/30">
                        {bet.label}
                      </span>
                      <span className="font-bold text-[#F4F6F7]">{bet.pickDetail}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#E9C66B]">
                        {bet.odds.toFixed(2)}x
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveBet(bet.id)}
                        className="text-[#829098] hover:text-rose-400 p-0.5"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Stake Amount Input & Quick Chips */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="arcade-stake-input"
                    className="text-xs font-semibold text-[#F4F6F7] flex items-center gap-1"
                  >
                    <Coins className="h-3.5 w-3.5 text-[#E9C66B]" />
                    <span>{isZh ? "投注金额 (CP)" : "Stake Amount (CP)"}</span>
                  </label>
                  {isInsufficient && (
                    <span className="text-[11px] text-rose-400">
                      {isZh ? "超出可用余额" : "Exceeds balance"}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    id="arcade-stake-input"
                    type="number"
                    min="1"
                    max={availableCp}
                    value={stakeCp || ""}
                    onChange={(e) => setStakeCp(Number(e.target.value) || 0)}
                    placeholder="输入金额"
                    className="w-full h-11 rounded-xl border border-[#29363D] bg-[#10171B] px-3 pr-14 text-sm font-mono font-bold text-[#F4F6F7] placeholder-[#829098] focus:border-[#E9C66B] focus:outline-none transition-colors"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#E9C66B]">
                    CP
                  </span>
                </div>

                {/* Quick Stake Chips */}
                <div className="grid grid-cols-5 gap-1.5 pt-0.5">
                  {QUICK_STAKES.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleQuickStake(amt)}
                      className={`h-8 rounded-lg text-xs font-mono font-bold transition-all border ${
                        stakeCp === amt
                          ? "border-[#E9C66B] bg-[#E9C66B]/20 text-[#FFE8A3]"
                          : "border-[#29363D] bg-[#10171B] text-[#B0BBC2] hover:border-[#00D9DF]"
                      }`}
                    >
                      +{amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleMaxStake}
                    className="h-8 rounded-lg text-xs font-bold transition-all border border-[#00D9DF]/40 bg-[#00D9DF]/10 text-[#00D9DF] hover:bg-[#00D9DF]/20"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Projected Return Calculation Box */}
              <div className="rounded-xl border border-[#29363D] bg-[#10171B] p-2.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[#829098]">
                  <span>{isZh ? "预计最高返还" : "Projected Max Return"}</span>
                  <span className="font-mono font-black text-sm text-[#52C898]">
                    {projectedReturn.toFixed(2)}{" "}
                    <span className="text-[10px] text-[#52C898]">CP</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#829098] text-[11px]">
                  <span>{isZh ? "预期净利" : "Estimated Net Gain"}</span>
                  <span className="font-mono text-[#E9C66B]">
                    +{Math.max(0, projectedNet).toFixed(2)} CP
                  </span>
                </div>
              </div>

              {/* Expanded Confirm Button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isValid || isSubmitting}
                className={`w-full h-11 rounded-xl text-sm font-black tracking-wide flex items-center justify-center gap-2 transition-all ${
                  isValid && !isSubmitting
                    ? "r10-btn-gold text-[#070B0D]"
                    : "bg-[#172126] text-[#829098] border border-[#29363D] cursor-not-allowed"
                }`}
              >
                {isSubmitting ? (
                  <span>{isZh ? "注单处理中..." : "Processing..."}</span>
                ) : isInsufficient ? (
                  <span>{isZh ? "CP 余额不足" : "Insufficient CP"}</span>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>
                      {isZh ? "确认投注" : "Confirm Bet"} ({stakeCp} CP)
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
