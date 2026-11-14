"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Award,
  ChevronRight,
  Clock,
  Eye,
  Flame,
  Radio,
  Sparkles,
  Trophy,
} from "lucide-react";
import { STEEL_BALLS } from "./data";
import type { IssueHistory, SteelBall } from "./types";

interface RaceTrackPreviewProps {
  issueNo: string;
  countdownSeconds: number;
  raceState: "BETTING" | "RACING" | "RESULT";
  lastWinner: SteelBall | null;
  history: IssueHistory[];
  isZh?: boolean;
}

export function RaceTrackPreview({
  issueNo,
  countdownSeconds,
  raceState,
  lastWinner,
  history,
  isZh = true,
}: RaceTrackPreviewProps) {
  const [viewMode, setViewMode] = useState<"CAM" | "RADAR">("CAM");
  const [radarSpeeds, setRadarSpeeds] = useState<{ [key: number]: number }>({});

  // Simulate subtle speed radar oscillations
  useEffect(() => {
    const interval = setInterval(() => {
      const speeds: { [key: number]: number } = {};
      STEEL_BALLS.forEach((b) => {
        const base = b.speedRating + 25;
        const jitter = Math.floor(Math.random() * 9) - 4;
        speeds[b.num] = base + jitter;
      });
      setRadarSpeeds(speeds);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <section
      aria-label={isZh ? "钢珠竞速直播与赛道雷达" : "Live Race & Track Radar"}
      className="r10-card-dark overflow-hidden p-3.5 sm:p-4 space-y-3"
    >
      {/* Upper Status & Issue Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="h-3.5 w-[2.5px] rounded-full bg-[#00D9DF] shadow-[0_0_8px_rgba(0,217,223,0.8)]"
            aria-hidden="true"
          />
          <h2 className="text-sm font-semibold tracking-tight text-[#F4F6F7]">
            {isZh ? "钢珠竞速直播" : "Steel Ball Live"}
          </h2>
          <span className="font-mono text-xs text-[#829098]">第 {issueNo} 期</span>
        </div>

        {/* Live Race State & Countdown */}
        <div className="flex items-center gap-2">
          {raceState === "BETTING" && (
            <div className="flex items-center gap-1.5 rounded-full border border-[#52C898]/40 bg-[#52C898]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#52C898] shadow-[0_0_10px_rgba(82,200,152,0.2)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#52C898] animate-pulse" />
              <span>{isZh ? "受注中" : "Betting"}</span>
              <span className="font-mono ml-0.5 text-[#F4F6F7]">
                {formatCountdown(countdownSeconds)}
              </span>
            </div>
          )}

          {raceState === "RACING" && (
            <div className="flex items-center gap-1.5 rounded-full border border-[#E9C66B]/50 bg-[#E9C66B]/20 px-2.5 py-0.5 text-[11px] font-black text-[#FFE8A3] shadow-[0_0_12px_rgba(233,198,107,0.4)] animate-pulse">
              <Flame className="h-3 w-3 text-[#E9C66B]" />
              <span>{isZh ? "竞速中" : "Racing"}</span>
            </div>
          )}

          {raceState === "RESULT" && (
            <div className="flex items-center gap-1.5 rounded-full border border-[#00D9DF]/50 bg-[#00D9DF]/20 px-2.5 py-0.5 text-[11px] font-black text-[#A5F6FF] shadow-[0_0_12px_rgba(0,217,223,0.4)]">
              <Trophy className="h-3 w-3 text-[#00D9DF]" />
              <span>{isZh ? "赛果已出" : "Settled"}</span>
            </div>
          )}

          {/* Toggle Cam / Radar */}
          <div className="flex rounded-lg border border-[#29363D] bg-[#070B0D] p-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => setViewMode("CAM")}
              className={`px-1.5 py-0.5 rounded font-medium transition-colors ${
                viewMode === "CAM" ? "bg-[#172126] text-[#00D9DF]" : "text-[#829098]"
              }`}
            >
              {isZh ? "实况" : "Cam"}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("RADAR")}
              className={`px-1.5 py-0.5 rounded font-medium transition-colors ${
                viewMode === "RADAR" ? "bg-[#172126] text-[#00D9DF]" : "text-[#829098]"
              }`}
            >
              {isZh ? "雷达" : "Radar"}
            </button>
          </div>
        </div>
      </div>

      {/* 16:9 Screen Viewport */}
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-[#29363D] bg-[#070B0D] shadow-[inset_0_2px_12px_rgba(0,0,0,0.85)]">
        {viewMode === "CAM" ? (
          <>
            {/* Cinematic Track Backdrop */}
            <img
              src="/posters/arcade-track-preview.jpg"
              alt="Track"
              className={`h-full w-full object-cover transition-all duration-700 ${
                raceState === "RACING"
                  ? "scale-110 filter brightness-110"
                  : "opacity-85 filter brightness-95"
              }`}
            />
            {/* Dark gradient & tech grid scan overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#070B0D]/95 via-black/20 to-[#070B0D]/60 pointer-events-none" />

            {/* Glowing Race Track Visual Markers */}
            <div className="absolute inset-x-0 bottom-4 px-4 flex items-center justify-between text-[10px] text-[#B0BBC2] pointer-events-none">
              <div className="flex items-center gap-1.5 bg-[#10171B]/80 backdrop-blur-sm border border-[#29363D] px-2 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00D9DF] animate-ping" />
                <span>ROLL10 HIGH-SPEED RING 01</span>
              </div>
              <span className="font-mono text-[#E9C66B]">LENGTH: 420m</span>
            </div>

            {/* In Betting State: Ball Lineup at Starting Blocks */}
            {raceState === "BETTING" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#E9C66B]/40 bg-[#10171B]/90 backdrop-blur-md px-3 py-1 shadow-lg">
                  <Clock className="h-3.5 w-3.5 text-[#E9C66B]" />
                  <span className="text-xs font-semibold text-[#F4F6F7]">
                    {isZh ? "10 珠蓄势待发 · 投注倒计时" : "10 Balls Ready · Countdown"}
                  </span>
                  <span className="font-mono text-xs font-bold text-[#FFE8A3]">
                    {formatCountdown(countdownSeconds)}
                  </span>
                </div>

                {/* Starting Grid Silhouette */}
                <div className="mt-3 flex items-center justify-center gap-1.5 sm:gap-2">
                  {STEEL_BALLS.map((ball) => (
                    <div
                      key={ball.num}
                      className="relative flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full shadow-md border border-white/20"
                      style={{
                        background: `linear-gradient(135deg, ${ball.ringColor} 0%, #10171B 100%)`,
                      }}
                      title={`${ball.num}号 ${ball.nameZh}`}
                    >
                      <span className="font-mono text-[9px] font-black text-white drop-shadow">
                        {ball.num}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* In Racing State: Animated Racing Simulation */}
            {raceState === "RACING" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px]">
                <div className="flex items-center gap-2 rounded-xl border border-[#E9C66B] bg-[#10171B]/95 px-4 py-2 shadow-[0_0_20px_rgba(233,198,107,0.4)]">
                  <Flame className="h-5 w-5 text-[#E9C66B] animate-bounce" />
                  <div>
                    <p className="text-xs font-black text-[#FFE8A3] tracking-wide">
                      {isZh ? "钢珠冲刺中！全速过弯中..." : "SPRINTING! DRIFTING CURVES..."}
                    </p>
                    <p className="text-[10px] text-[#829098]">
                      {isZh ? "实时超车计算中 · 即将冲线" : "Passing simulation in progress"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* In Result State: Champion Celebration Podium Banner */}
            {raceState === "RESULT" && lastWinner && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="relative flex flex-col items-center rounded-2xl border border-[#E9C66B] bg-[#10171B]/95 p-4 shadow-[0_0_30px_rgba(233,198,107,0.5)] max-w-xs w-full text-center">
                  <div
                    aria-hidden="true"
                    className="absolute -top-3 flex items-center gap-1 rounded-full bg-[#E9C66B] px-3 py-0.5 text-[10px] font-black text-[#070B0D] shadow-md"
                  >
                    <Trophy className="h-3 w-3" />
                    <span>CHAMPION</span>
                  </div>

                  <div
                    className="mt-2 flex h-14 w-14 items-center justify-center rounded-full border-2 border-white shadow-[0_0_15px_rgba(233,198,107,0.6)]"
                    style={{
                      background: `linear-gradient(135deg, ${lastWinner.ringColor} 0%, #070B0D 100%)`,
                    }}
                  >
                    <span className="font-mono text-2xl font-black text-white">
                      {lastWinner.num}
                    </span>
                  </div>

                  <h3 className="mt-2 text-sm font-black text-[#FFE8A3]">
                    {lastWinner.num}号 {lastWinner.nameZh} 钢珠
                  </h3>
                  <p className="text-[11px] text-[#829098]">
                    {isZh ? "率先冲过终点线 · 夺得冠军！" : "First across the line · Won 1st place!"}
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          /* RADAR VIEW: 10 Lanes Speed Telemetry */
          <div className="h-full w-full p-2.5 overflow-y-auto space-y-1 bg-[#070B0D]">
            <div className="flex items-center justify-between pb-1 border-b border-[#29363D] text-[10px] text-[#829098]">
              <span>{isZh ? "钢珠 / 赛道" : "Ball / Lane"}</span>
              <span>{isZh ? "实时测速" : "Speed"}</span>
            </div>
            {STEEL_BALLS.map((ball) => {
              const speed = radarSpeeds[ball.num] || ball.speedRating + 25;
              const percent = Math.min(100, Math.max(10, ((speed - 90) / 45) * 100));

              return (
                <div key={ball.num} className="flex items-center gap-2 text-[10px]">
                  <span
                    className="font-mono font-bold w-4 text-center rounded text-[9px] py-0.5"
                    style={{ backgroundColor: `${ball.ringColor}33`, color: ball.ringColor }}
                  >
                    {ball.num}
                  </span>
                  <span className="w-10 truncate text-[#F4F6F7]">{ball.nameZh}</span>

                  {/* Speed Bar */}
                  <div className="flex-1 h-2 rounded-full bg-[#172126] overflow-hidden border border-[#29363D]/50 relative">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${percent}%`,
                        backgroundColor: ball.ringColor,
                        boxShadow: `0 0 6px ${ball.ringColor}`,
                      }}
                    />
                  </div>

                  <span className="font-mono font-bold text-[#FFE8A3] w-12 text-right">
                    {speed} <span className="text-[8px] text-[#829098]">km/h</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historical Winning Balls Road Map */}
      <div className="space-y-1.5 pt-0.5">
        <div className="flex items-center justify-between text-[11px] text-[#829098]">
          <span className="flex items-center gap-1">
            <Award className="h-3.5 w-3.5 text-[#E9C66B]" />
            <span>{isZh ? "往期赛果走势" : "Winning Ball Trend"}</span>
          </span>
          <span className="text-[10px]">{isZh ? "近 7 期开奖" : "Last 7 races"}</span>
        </div>

        {/* Scrollable Road Map Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {history.map((item, idx) => {
            const ball = STEEL_BALLS.find((b) => b.num === item.winner) || STEEL_BALLS[0];
            return (
              <div
                key={idx}
                className="flex flex-col items-center rounded-lg border border-[#29363D] bg-[#070B0D] p-1.5 min-w-[56px] flex-shrink-0 shadow-sm"
              >
                <span className="text-[9px] font-mono text-[#829098]">#{item.issue}</span>
                <div
                  className="my-1 flex h-6 w-6 items-center justify-center rounded-full shadow-sm text-white font-mono text-xs font-black"
                  style={{
                    background: `linear-gradient(135deg, ${ball.ringColor} 0%, #172126 100%)`,
                    border: `1px solid ${ball.ringColor}`,
                  }}
                >
                  {item.winner}
                </div>
                <div className="flex items-center gap-0.5 text-[8px] font-medium text-[#B0BBC2]">
                  <span className={item.bigSmall === "大" ? "text-amber-400" : "text-cyan-400"}>
                    {item.bigSmall}
                  </span>
                  <span>/</span>
                  <span className={item.oddEven === "单" ? "text-rose-400" : "text-emerald-400"}>
                    {item.oddEven}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
