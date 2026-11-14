"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  Flag,
  Flame,
  History,
  Info,
  Layers,
  RotateCcw,
  Shield,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { SubpageCornerBranding } from "@/components/Roll10Logo";
import { STEEL_BALLS, INITIAL_ROADMAP } from "./arcade/data";
import { BetSlip } from "./arcade/BetSlip";
import { TicketReceiptModal } from "./arcade/TicketReceiptModal";
import { MyTicketsDrawer } from "./arcade/MyTicketsDrawer";
import { RaceTrackPreview } from "./arcade/RaceTrackPreview";
import type {
  BetTicket,
  IssueHistory,
  MarketType,
  SelectedBet,
  SteelBall,
  SubMarketExacta,
  SubMarketWinPlace,
} from "./arcade/types";

interface ArcadeClientProps {
  locale?: Locale;
  initialMember?: {
    memberCode: string;
    displayName: string;
    cpBalanceCents: number;
  };
}

export function ArcadeClient({
  locale = "zh-CN",
  initialMember = {
    memberCode: "BM100001",
    displayName: "Elena Vance",
    cpBalanceCents: 35000,
  },
}: ArcadeClientProps) {
  const router = useRouter();
  const isZh = locale === "zh-CN";

  // Balance & Tickets State
  const [cpBalanceCents, setCpBalanceCents] = useState<number>(
    initialMember.cpBalanceCents || 35000
  );
  const [tickets, setTickets] = useState<BetTicket[]>([]);
  const [activeReceipt, setActiveReceipt] = useState<BetTicket | null>(null);
  const [isTicketsDrawerOpen, setIsTicketsDrawerOpen] = useState(false);

  // Game Loop State
  const [issueNumber, setIssueNumber] = useState<number>(42);
  const [countdown, setCountdown] = useState<number>(45);
  const [raceState, setRaceState] = useState<"BETTING" | "RACING" | "RESULT">("BETTING");
  const [lastWinner, setLastWinner] = useState<SteelBall | null>(null);
  const [history, setHistory] = useState<IssueHistory[]>(INITIAL_ROADMAP);

  // Market & Selection State
  const [activeMarket, setActiveMarket] = useState<MarketType>("WIN_PLACE");
  const [winPlaceMode, setWinPlaceMode] = useState<SubMarketWinPlace>("WIN");
  const [exactaMode, setExactaMode] = useState<SubMarketExacta>("QUINELLA");

  // Multi-pick selection array
  const [selectedBets, setSelectedBets] = useState<SelectedBet[]>([]);

  // Exacta interactive picking state: row 1 (1st) & row 2 (2nd)
  const [exactaPickFirst, setExactaPickFirst] = useState<number | null>(3);
  const [exactaPickSecond, setExactaPickSecond] = useState<number | null>(7);

  const formattedIssueNo = `20261114-${issueNumber.toString().padStart(3, "0")}`;

  // Countdown and Game Loop Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev > 1) {
          return prev - 1;
        }

        // When countdown hits 0 -> Start Racing!
        if (prev === 1 && raceState === "BETTING") {
          setRaceState("RACING");

          // Simulate 8-second sprint
          setTimeout(() => {
            // Pick random winner (weighted towards top balls)
            const winnerIdx = Math.floor(Math.random() * STEEL_BALLS.length);
            const winnerBall = STEEL_BALLS[winnerIdx];
            // Second & Third balls
            const remaining = STEEL_BALLS.filter((b) => b.num !== winnerBall.num);
            const secondBall = remaining[Math.floor(Math.random() * remaining.length)];
            const thirdRemaining = remaining.filter((b) => b.num !== secondBall.num);
            const thirdBall = thirdRemaining[Math.floor(Math.random() * thirdRemaining.length)];

            setLastWinner(winnerBall);
            setRaceState("RESULT");

            // Append to history
            const newHistoryItem: IssueHistory = {
              issue: issueNumber.toString().padStart(3, "0"),
              winner: winnerBall.num,
              second: secondBall.num,
              third: thirdBall.num,
              bigSmall: winnerBall.num >= 6 ? "大" : "小",
              oddEven: winnerBall.num % 2 === 1 ? "单" : "双",
            };
            setHistory((prevHist) => [newHistoryItem, ...prevHist.slice(0, 7)]);

            // Settle active tickets for this issue!
            setTickets((prevTickets) =>
              prevTickets.map((t) => {
                if (t.issueNo === formattedIssueNo && t.status === "PENDING") {
                  let won = false;

                  // Evaluate Win / Place
                  if (t.marketLabel.includes("独赢 · 冠军")) {
                    won = t.pickDetail.includes(`${winnerBall.num}号`);
                  } else if (t.marketLabel.includes("独赢 · 前三")) {
                    won =
                      t.pickDetail.includes(`${winnerBall.num}号`) ||
                      t.pickDetail.includes(`${secondBall.num}号`) ||
                      t.pickDetail.includes(`${thirdBall.num}号`);
                  } else if (t.marketLabel.includes("双面 · 大")) {
                    won = winnerBall.num >= 6;
                  } else if (t.marketLabel.includes("双面 · 小")) {
                    won = winnerBall.num <= 5;
                  } else if (t.marketLabel.includes("双面 · 单")) {
                    won = winnerBall.num % 2 === 1;
                  } else if (t.marketLabel.includes("双面 · 双")) {
                    won = winnerBall.num % 2 === 0;
                  } else if (t.marketLabel.includes("冠亚连赢")) {
                    won =
                      (t.pickDetail.includes(`${winnerBall.num}号`) &&
                        t.pickDetail.includes(`${secondBall.num}号`));
                  } else if (t.marketLabel.includes("精准前二")) {
                    won =
                      t.pickDetail.startsWith(`冠 ${winnerBall.num}号`) &&
                      t.pickDetail.includes(`亚 ${secondBall.num}号`);
                  }

                  if (won) {
                    const payout = t.projectedReturnCp;
                    // Add payout to member balance
                    setCpBalanceCents((prevBal) => prevBal + Math.round(payout * 100));
                    return {
                      ...t,
                      status: "WON",
                      actualPayoutCp: payout,
                    };
                  } else {
                    return {
                      ...t,
                      status: "LOST",
                      actualPayoutCp: 0,
                    };
                  }
                }
                return t;
              })
            );

            // After 5s showing results, advance to next race issue
            setTimeout(() => {
              setIssueNumber((n) => n + 1);
              setCountdown(50);
              setRaceState("BETTING");
              setLastWinner(null);
            }, 5000);
          }, 7000);

          return 0;
        }

        return 0;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [raceState, issueNumber, formattedIssueNo]);

  // Handle Ball Click in 独赢 (Win / Place)
  const handleBallToggle = (ball: SteelBall) => {
    const isWin = winPlaceMode === "WIN";
    const odds = isWin ? ball.winOdds : ball.placeOdds;
    const betId = `BALL_${winPlaceMode}_${ball.num}`;

    // Toggle: if already selected, remove; otherwise set as primary pick
    const exists = selectedBets.some((b) => b.id === betId);
    if (exists) {
      setSelectedBets(selectedBets.filter((b) => b.id !== betId));
    } else {
      const newBet: SelectedBet = {
        id: betId,
        marketType: "WIN_PLACE",
        subType: winPlaceMode,
        label: isZh
          ? `独赢 · ${isWin ? "冠军" : "前三入围"}`
          : `Win/Place · ${isWin ? "Win" : "Place"}`,
        pickDetail: `${ball.num}号 ${ball.nameZh}钢珠`,
        odds,
        ballNums: [ball.num],
      };
      // Keep single pick or replace for clean flow
      setSelectedBets([newBet]);
    }
  };

  // Handle Side Bet Click (大 / 小 / 单 / 双 / 前三和值)
  const handleSideBetToggle = (
    subType: "BIG" | "SMALL" | "ODD" | "EVEN" | "SUM_BIG" | "SUM_SMALL",
    labelZh: string,
    pickDetailZh: string,
    odds: number
  ) => {
    const betId = `SIDE_${subType}`;
    const exists = selectedBets.some((b) => b.id === betId);
    if (exists) {
      setSelectedBets(selectedBets.filter((b) => b.id !== betId));
    } else {
      const newBet: SelectedBet = {
        id: betId,
        marketType: "SIDE_BETS",
        subType,
        label: `${isZh ? "双面" : "Side"} · ${labelZh}`,
        pickDetail: pickDetailZh,
        odds,
      };
      setSelectedBets([newBet]);
    }
  };

  // Handle Exacta / Quinella Pick
  const handleExactaSubmit = () => {
    if (!exactaPickFirst || !exactaPickSecond || exactaPickFirst === exactaPickSecond) return;

    const ball1 = STEEL_BALLS.find((b) => b.num === exactaPickFirst);
    const ball2 = STEEL_BALLS.find((b) => b.num === exactaPickSecond);
    if (!ball1 || !ball2) return;

    const isExacta = exactaMode === "EXACTA";
    const odds = isExacta ? 88.0 : 44.0;
    const betId = `EXACTA_${exactaMode}_${ball1.num}_${ball2.num}`;

    const newBet: SelectedBet = {
      id: betId,
      marketType: "EXACTA",
      subType: exactaMode,
      label: isExacta
        ? (isZh ? "冠亚 · 精准前二" : "Exacta Top 2")
        : (isZh ? "冠亚 · 连赢" : "Quinella Top 2"),
      pickDetail: isExacta
        ? `冠 ${ball1.num}号(${ball1.nameZh}) + 亚 ${ball2.num}号(${ball2.nameZh})`
        : `${ball1.num}号(${ball1.nameZh}) + ${ball2.num}号(${ball2.nameZh})`,
      odds,
      ballNums: [ball1.num, ball2.num],
    };

    setSelectedBets([newBet]);
  };

  // Confirm Bet & Generate Ticket Receipt
  const handleConfirmBet = (bets: SelectedBet[], stakeCp: number) => {
    if (bets.length === 0 || stakeCp <= 0) return;

    const stakeCents = Math.round(stakeCp * 100);
    if (stakeCents > cpBalanceCents) return;

    // Deduct local CP balance
    setCpBalanceCents((prev) => prev - stakeCents);

    const primaryBet = bets[0];
    const ticketId = `TKT-${formattedIssueNo}-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

    const newTicket: BetTicket = {
      ticketId,
      issueNo: formattedIssueNo,
      placedAt: timeStr,
      marketLabel: primaryBet.label,
      pickDetail: primaryBet.pickDetail,
      stakeCp,
      odds: primaryBet.odds,
      projectedReturnCp: stakeCp * primaryBet.odds,
      status: "PENDING",
    };

    setTickets((prev) => [newTicket, ...prev]);
    setActiveReceipt(newTicket);
    setSelectedBets([]);
  };

  return (
    <div className="space-y-3.5 pb-24 max-w-xl mx-auto">
      {/* Top Header: < | 游戏厅 · 钢珠竞速  ···  我的注单(X) · ROLL10 */}
      <header className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label={isZh ? "返回上一页" : "Go back"}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#29363D] bg-[#10171B] text-[#F4F6F7] transition-colors hover:border-[#00D9DF] hover:text-[#00D9DF] active:scale-95"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="h-4 w-px bg-[#29363D]" aria-hidden="true" />
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#F4F6F7]">
              {isZh ? "游戏厅 · 钢珠竞速" : "Arcade · Steel Ball"}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* My Tickets Button */}
          <button
            type="button"
            onClick={() => setIsTicketsDrawerOpen(true)}
            className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl border border-[#29363D] bg-[#10171B] text-xs font-semibold text-[#00D9DF] hover:border-[#00D9DF] transition-all"
          >
            <History className="h-3.5 w-3.5" />
            <span>{isZh ? "我的注单" : "My Slips"}</span>
            {tickets.length > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#00D9DF] px-1 text-[10px] font-black text-[#070B0D]">
                {tickets.length}
              </span>
            )}
          </button>

          <SubpageCornerBranding />
        </div>
      </header>

      {/* CP Balance Quick Strip */}
      <div className="flex items-center justify-between rounded-xl border border-[#29363D] bg-[#10171B] px-3.5 py-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#E9C66B]/15 text-[#E9C66B]">
            <Coins className="h-3.5 w-3.5" />
          </div>
          <span className="text-[#829098]">{isZh ? "当前可用 CP 余额" : "Available CP"}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-mono text-sm font-bold text-[#FFE8A3]">
            {(cpBalanceCents / 100).toFixed(2)}
          </span>
          <span className="text-[11px] font-bold text-[#E9C66B]">CP</span>
        </div>
      </div>

      {/* Upper Section: 钢珠竞速直播 (Interactive 16:9 Race Cam & Radar) */}
      <RaceTrackPreview
        issueNo={formattedIssueNo}
        countdownSeconds={countdown}
        raceState={raceState}
        lastWinner={lastWinner}
        history={history}
        isZh={isZh}
      />

      {/* Main Betting Area: 3 Market Tabs (独赢/名次 · 双面盘 · 冠亚军) */}
      <section
        aria-label={isZh ? "钢珠竞速盘口" : "Steel Ball Markets"}
        className="r10-card-dark p-3.5 sm:p-4 space-y-3.5"
      >
        {/* Market Navigation Pills */}
        <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-[#29363D] bg-[#070B0D] p-1">
          <button
            type="button"
            onClick={() => {
              setActiveMarket("WIN_PLACE");
              setSelectedBets([]);
            }}
            className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-xs font-bold transition-all ${
              activeMarket === "WIN_PLACE"
                ? "bg-gradient-to-r from-[#FFE8A3] to-[#E9C66B] text-[#070B0D] shadow-[0_2px_10px_rgba(233,198,107,0.3)]"
                : "text-[#829098] hover:text-[#F4F6F7]"
            }`}
          >
            <Flag className="h-3.5 w-3.5" />
            <span>{isZh ? "独赢 / 名次" : "Win / Place"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMarket("SIDE_BETS");
              setSelectedBets([]);
            }}
            className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-xs font-bold transition-all ${
              activeMarket === "SIDE_BETS"
                ? "bg-gradient-to-r from-[#FFE8A3] to-[#E9C66B] text-[#070B0D] shadow-[0_2px_10px_rgba(233,198,107,0.3)]"
                : "text-[#829098] hover:text-[#F4F6F7]"
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            <span>{isZh ? "双面盘" : "Side Bets"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMarket("EXACTA");
              setSelectedBets([]);
            }}
            className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-xs font-bold transition-all ${
              activeMarket === "EXACTA"
                ? "bg-gradient-to-r from-[#FFE8A3] to-[#E9C66B] text-[#070B0D] shadow-[0_2px_10px_rgba(233,198,107,0.3)]"
                : "text-[#829098] hover:text-[#F4F6F7]"
            }`}
          >
            <Trophy className="h-3.5 w-3.5" />
            <span>{isZh ? "冠亚连赢" : "Exacta / Quin"}</span>
          </button>
        </div>

        {/* ==================== TAB 1: 独赢 / 名次 (Win & Place) ==================== */}
        {activeMarket === "WIN_PLACE" && (
          <div className="space-y-3 animate-in fade-in duration-200">
            {/* Sub-mode Switch: 冠军 (9.60x) vs 前三 (3.10x) */}
            <div className="flex items-center justify-between rounded-xl bg-[#070B0D] p-1 border border-[#29363D] text-xs">
              <button
                type="button"
                onClick={() => {
                  setWinPlaceMode("WIN");
                  setSelectedBets([]);
                }}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                  winPlaceMode === "WIN"
                    ? "bg-[#172126] text-[#FFE8A3] border border-[#E9C66B]/50 shadow-sm"
                    : "text-[#829098]"
                }`}
              >
                {isZh ? "🏆 冠军独赢" : "Win (1st)"}{" "}
                <span className="font-mono text-[#E9C66B]">9.60x</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setWinPlaceMode("PLACE");
                  setSelectedBets([]);
                }}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                  winPlaceMode === "PLACE"
                    ? "bg-[#172126] text-[#A5F6FF] border border-[#00D9DF]/50 shadow-sm"
                    : "text-[#829098]"
                }`}
              >
                {isZh ? "🎖️ 前三入围" : "Place (Top 3)"}{" "}
                <span className="font-mono text-[#00D9DF]">3.10x</span>
              </button>
            </div>

            {/* Hint */}
            <p className="text-[11px] text-[#829098] px-1">
              {winPlaceMode === "WIN"
                ? (isZh ? "选择 1 颗钢珠，预测率先冲过终点线获得第 1 名" : "Pick 1 ball to win 1st place")
                : (isZh ? "选择 1 颗钢珠，只要冲入前 3 名即可获胜入账" : "Pick 1 ball to finish in Top 3")}
            </p>

            {/* 10 Interactive Steel Balls (2 rows of 5) */}
            <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
              {STEEL_BALLS.map((ball) => {
                const betId = `BALL_${winPlaceMode}_${ball.num}`;
                const isSelected = selectedBets.some((b) => b.id === betId);
                const odds = winPlaceMode === "WIN" ? ball.winOdds : ball.placeOdds;

                return (
                  <button
                    key={ball.num}
                    type="button"
                    onClick={() => handleBallToggle(ball)}
                    className={`relative flex flex-col items-center justify-center rounded-xl p-2 sm:p-2.5 transition-all text-center border active:scale-95 ${
                      isSelected
                        ? "border-[#E9C66B] bg-gradient-to-b from-[#172126] to-[#10171B] shadow-[0_0_15px_rgba(233,198,107,0.35)] -translate-y-0.5"
                        : "border-[#29363D] bg-[#070B0D] hover:border-[#00D9DF]/60"
                    }`}
                  >
                    {/* Selected check pill */}
                    {isSelected && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#E9C66B] text-[#070B0D] text-[9px] font-black shadow-md">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    )}

                    {/* Realistic 3D Metallic Steel Ball Sphere */}
                    <div
                      className="relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.8)] border"
                      style={{
                        background: `radial-gradient(circle at 35% 30%, #FFFFFF 0%, ${ball.ringColor} 50%, #070B0D 100%)`,
                        borderColor: ball.ringColor,
                        boxShadow: isSelected ? `0 0 12px ${ball.ringColor}` : "none",
                      }}
                    >
                      <span className="font-mono text-sm sm:text-base font-black text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                        {ball.num}
                      </span>
                    </div>

                    {/* Ball Name */}
                    <span className="mt-1 text-[11px] font-semibold text-[#F4F6F7]">
                      {ball.nameZh}
                    </span>

                    {/* Odds */}
                    <span
                      className={`font-mono text-[10px] font-bold ${
                        isSelected ? "text-[#FFE8A3]" : "text-[#E9C66B]"
                      }`}
                    >
                      {odds.toFixed(2)}x
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== TAB 2: 双面盘 (Side Bets) ==================== */}
        {activeMarket === "SIDE_BETS" && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <p className="text-[11px] text-[#829098] px-1">
              {isZh
                ? "以冠军钢珠号码为基准，快速预测大小单双及前三和值"
                : "Predict Champion ball size, parity, and Top 3 total sum"}
            </p>

            {/* 4 Main Side Bet Cards: 大, 小, 单, 双 */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* 大 (6-10) */}
              {(() => {
                const isSelected = selectedBets.some((b) => b.id === "SIDE_BIG");
                return (
                  <button
                    type="button"
                    onClick={() =>
                      handleSideBetToggle("BIG", isZh ? "大 (6-10)" : "Big (6-10)", "大 (6-10号)", 1.96)
                    }
                    className={`rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
                      isSelected
                        ? "border-[#E9C66B] bg-[#172126] shadow-[0_0_15px_rgba(233,198,107,0.3)]"
                        : "border-[#29363D] bg-[#070B0D] hover:border-[#00D9DF]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base font-black text-[#F4F6F7]">{isZh ? "大" : "Big"}</span>
                      <span className="font-mono text-sm font-bold text-[#E9C66B]">1.96x</span>
                    </div>
                    <p className="mt-1 text-[11px] text-[#829098]">
                      {isZh ? "冠军球为 6, 7, 8, 9, 10" : "Winner is 6, 7, 8, 9, 10"}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-[#00D9DF]">
                      <span>{isZh ? "近20期开出率" : "Win Rate"}</span>
                      <span className="font-mono font-bold">52%</span>
                    </div>
                  </button>
                );
              })()}

              {/* 小 (1-5) */}
              {(() => {
                const isSelected = selectedBets.some((b) => b.id === "SIDE_SMALL");
                return (
                  <button
                    type="button"
                    onClick={() =>
                      handleSideBetToggle("SMALL", isZh ? "小 (1-5)" : "Small (1-5)", "小 (1-5号)", 1.96)
                    }
                    className={`rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
                      isSelected
                        ? "border-[#E9C66B] bg-[#172126] shadow-[0_0_15px_rgba(233,198,107,0.3)]"
                        : "border-[#29363D] bg-[#070B0D] hover:border-[#00D9DF]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base font-black text-[#F4F6F7]">{isZh ? "小" : "Small"}</span>
                      <span className="font-mono text-sm font-bold text-[#E9C66B]">1.96x</span>
                    </div>
                    <p className="mt-1 text-[11px] text-[#829098]">
                      {isZh ? "冠军球为 1, 2, 3, 4, 5" : "Winner is 1, 2, 3, 4, 5"}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-[#00D9DF]">
                      <span>{isZh ? "近20期开出率" : "Win Rate"}</span>
                      <span className="font-mono font-bold">48%</span>
                    </div>
                  </button>
                );
              })()}

              {/* 单 (1, 3, 5, 7, 9) */}
              {(() => {
                const isSelected = selectedBets.some((b) => b.id === "SIDE_ODD");
                return (
                  <button
                    type="button"
                    onClick={() =>
                      handleSideBetToggle(
                        "ODD",
                        isZh ? "单" : "Odd",
                        "单数 (1, 3, 5, 7, 9)",
                        1.96
                      )
                    }
                    className={`rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
                      isSelected
                        ? "border-[#E9C66B] bg-[#172126] shadow-[0_0_15px_rgba(233,198,107,0.3)]"
                        : "border-[#29363D] bg-[#070B0D] hover:border-[#00D9DF]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base font-black text-[#F4F6F7]">{isZh ? "单" : "Odd"}</span>
                      <span className="font-mono text-sm font-bold text-[#E9C66B]">1.96x</span>
                    </div>
                    <p className="mt-1 text-[11px] text-[#829098]">
                      {isZh ? "冠军球为 1, 3, 5, 7, 9" : "Winner is 1, 3, 5, 7, 9"}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-[#52C898]">
                      <span>{isZh ? "近20期开出率" : "Win Rate"}</span>
                      <span className="font-mono font-bold">50%</span>
                    </div>
                  </button>
                );
              })()}

              {/* 双 (2, 4, 6, 8, 10) */}
              {(() => {
                const isSelected = selectedBets.some((b) => b.id === "SIDE_EVEN");
                return (
                  <button
                    type="button"
                    onClick={() =>
                      handleSideBetToggle(
                        "EVEN",
                        isZh ? "双" : "Even",
                        "双数 (2, 4, 6, 8, 10)",
                        1.96
                      )
                    }
                    className={`rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
                      isSelected
                        ? "border-[#E9C66B] bg-[#172126] shadow-[0_0_15px_rgba(233,198,107,0.3)]"
                        : "border-[#29363D] bg-[#070B0D] hover:border-[#00D9DF]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base font-black text-[#F4F6F7]">{isZh ? "双" : "Even"}</span>
                      <span className="font-mono text-sm font-bold text-[#E9C66B]">1.96x</span>
                    </div>
                    <p className="mt-1 text-[11px] text-[#829098]">
                      {isZh ? "冠军球为 2, 4, 6, 8, 10" : "Winner is 2, 4, 6, 8, 10"}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-[#52C898]">
                      <span>{isZh ? "近20期开出率" : "Win Rate"}</span>
                      <span className="font-mono font-bold">50%</span>
                    </div>
                  </button>
                );
              })()}
            </div>

            {/* Extra: 前三和值 */}
            <div className="rounded-xl border border-[#29363D] bg-[#10171B] p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#F4F6F7]">
                  {isZh ? "前三球和值预测" : "Top 3 Sum"}
                </span>
                <span className="text-[10px] text-[#829098]">
                  {isZh ? "第1+2+3名球号累加" : "1st + 2nd + 3rd sum"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleSideBetToggle("SUM_BIG", "前三和值大 (≥17)", "和值大 (≥17)", 1.96)
                  }
                  className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-between ${
                    selectedBets.some((b) => b.id === "SIDE_SUM_BIG")
                      ? "border-[#E9C66B] bg-[#E9C66B]/15 text-[#FFE8A3]"
                      : "border-[#29363D] bg-[#070B0D] text-[#B0BBC2]"
                  }`}
                >
                  <span>{isZh ? "和值 大 (≥17)" : "Sum Big (≥17)"}</span>
                  <span className="font-mono text-[#E9C66B]">1.96x</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleSideBetToggle("SUM_SMALL", "前三和值小 (≤16)", "和值小 (≤16)", 1.96)
                  }
                  className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-between ${
                    selectedBets.some((b) => b.id === "SIDE_SUM_SMALL")
                      ? "border-[#E9C66B] bg-[#E9C66B]/15 text-[#FFE8A3]"
                      : "border-[#29363D] bg-[#070B0D] text-[#B0BBC2]"
                  }`}
                >
                  <span>{isZh ? "和值 小 (≤16)" : "Sum Small (≤16)"}</span>
                  <span className="font-mono text-[#E9C66B]">1.96x</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 3: 冠亚军组合 (Quinella & Exacta) ==================== */}
        {activeMarket === "EXACTA" && (
          <div className="space-y-3.5 animate-in fade-in duration-200">
            {/* Mode Switch: 连赢 (44.0x) vs 精准前二 (88.0x) */}
            <div className="flex items-center justify-between rounded-xl bg-[#070B0D] p-1 border border-[#29363D] text-xs">
              <button
                type="button"
                onClick={() => {
                  setExactaMode("QUINELLA");
                  setSelectedBets([]);
                }}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                  exactaMode === "QUINELLA"
                    ? "bg-[#172126] text-[#FFE8A3] border border-[#E9C66B]/50 shadow-sm"
                    : "text-[#829098]"
                }`}
              >
                {isZh ? "🏆 冠亚连赢 (任意顺序)" : "Quinella"}{" "}
                <span className="font-mono text-[#E9C66B]">44.00x</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setExactaMode("EXACTA");
                  setSelectedBets([]);
                }}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                  exactaMode === "EXACTA"
                    ? "bg-[#172126] text-[#A5F6FF] border border-[#00D9DF]/50 shadow-sm"
                    : "text-[#829098]"
                }`}
              >
                {isZh ? "⚡ 精准前二 (指定名次)" : "Exacta"}{" "}
                <span className="font-mono text-[#00D9DF]">88.00x</span>
              </button>
            </div>

            {/* Step 1: Pick 1st Ball */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[#829098]">
                <span className="font-semibold text-[#F4F6F7]">
                  {isZh ? "第一步：选择第一名钢珠" : "Step 1: Pick 1st Place Ball"}
                </span>
                <span className="font-mono text-[11px] text-[#00D9DF]">
                  {exactaPickFirst ? `${exactaPickFirst}号已选` : "请选择"}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {STEEL_BALLS.map((ball) => (
                  <button
                    key={ball.num}
                    type="button"
                    onClick={() => setExactaPickFirst(ball.num)}
                    className={`py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                      exactaPickFirst === ball.num
                        ? "border-[#E9C66B] bg-[#E9C66B] text-[#070B0D] shadow-[0_0_10px_rgba(233,198,107,0.4)]"
                        : "border-[#29363D] bg-[#070B0D] text-[#F4F6F7]"
                    }`}
                  >
                    {ball.num}号 {ball.nameZh}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Pick 2nd Ball */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[#829098]">
                <span className="font-semibold text-[#F4F6F7]">
                  {isZh ? "第二步：选择第二名钢珠" : "Step 2: Pick 2nd Place Ball"}
                </span>
                <span className="font-mono text-[11px] text-[#00D9DF]">
                  {exactaPickSecond ? `${exactaPickSecond}号已选` : "请选择"}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {STEEL_BALLS.map((ball) => {
                  const isDisabled = exactaPickFirst === ball.num;
                  const isSelected = exactaPickSecond === ball.num;

                  return (
                    <button
                      key={ball.num}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => setExactaPickSecond(ball.num)}
                      className={`py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                        isDisabled
                          ? "opacity-30 border-[#29363D] bg-neutral-900 cursor-not-allowed text-[#829098]"
                          : isSelected
                            ? "border-[#00D9DF] bg-[#00D9DF] text-[#070B0D] shadow-[0_0_10px_rgba(0,217,223,0.4)]"
                            : "border-[#29363D] bg-[#070B0D] text-[#F4F6F7]"
                      }`}
                    >
                      {ball.num}号 {ball.nameZh}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Add Combination to Bet Slip Button */}
            <button
              type="button"
              onClick={handleExactaSubmit}
              disabled={
                !exactaPickFirst ||
                !exactaPickSecond ||
                exactaPickFirst === exactaPickSecond
              }
              className="w-full py-2.5 rounded-xl border border-[#E9C66B]/50 bg-[#172126] text-xs font-bold text-[#FFE8A3] hover:border-[#E9C66B] flex items-center justify-center gap-1.5 transition-all disabled:opacity-40"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#E9C66B]" />
              <span>
                {isZh
                  ? `添加组合: ${exactaPickFirst}号 + ${exactaPickSecond}号 (@${
                      exactaMode === "EXACTA" ? "88.00x" : "44.00x"
                    })`
                  : `Add Combo (@${exactaMode === "EXACTA" ? "88.00x" : "44.00x"})`}
              </span>
            </button>
          </div>
        )}
      </section>

      {/* Floating Interactive Bet Slip Component */}
      <BetSlip
        selectedBets={selectedBets}
        onRemoveBet={(id) => setSelectedBets(selectedBets.filter((b) => b.id !== id))}
        onClearAll={() => setSelectedBets([])}
        onConfirmBet={handleConfirmBet}
        cpBalanceCents={cpBalanceCents}
        issueNo={formattedIssueNo}
        isZh={isZh}
      />

      {/* Placed Bet Ticket Receipt Modal */}
      <TicketReceiptModal
        ticket={activeReceipt}
        onClose={() => setActiveReceipt(null)}
        onViewMyTickets={() => {
          setActiveReceipt(null);
          setIsTicketsDrawerOpen(true);
        }}
        isZh={isZh}
      />

      {/* My Tickets Drawer */}
      <MyTicketsDrawer
        isOpen={isTicketsDrawerOpen}
        onClose={() => setIsTicketsDrawerOpen(false)}
        tickets={tickets}
        isZh={isZh}
      />
    </div>
  );
}
