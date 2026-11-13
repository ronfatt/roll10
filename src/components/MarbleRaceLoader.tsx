"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Flag, Sparkles } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { Roll10Logo } from "@/components/Roll10Logo";

interface SteelBallSpec {
  id: number;
  label: string;
  baseHex: string;
  highlightHex: string;
  shadowHex: string;
  glowRgba: string;
}

const STEEL_BALLS: SteelBallSpec[] = [
  { id: 1, label: "#01", baseHex: "#DC2626", highlightHex: "#FCA5A5", shadowHex: "#450A0A", glowRgba: "rgba(239,68,68,0.45)" },
  { id: 2, label: "#02", baseHex: "#2563EB", highlightHex: "#93C5FD", shadowHex: "#172554", glowRgba: "rgba(59,130,246,0.45)" },
  { id: 3, label: "#03", baseHex: "#D4AF63", highlightHex: "#FEF3C7", shadowHex: "#4A320C", glowRgba: "rgba(231,201,142,0.55)" },
  { id: 4, label: "#04", baseHex: "#059669", highlightHex: "#6EE7B7", shadowHex: "#022C22", glowRgba: "rgba(16,185,129,0.45)" },
  { id: 5, label: "#05", baseHex: "#9333EA", highlightHex: "#D8B4FE", shadowHex: "#3B0764", glowRgba: "rgba(168,85,247,0.45)" },
  { id: 6, label: "#06", baseHex: "#EA580C", highlightHex: "#FDBA74", shadowHex: "#431407", glowRgba: "rgba(249,115,22,0.45)" },
  { id: 7, label: "#07", baseHex: "#0891B2", highlightHex: "#A5F3FC", shadowHex: "#083344", glowRgba: "rgba(34,211,238,0.45)" },
  { id: 8, label: "#08", baseHex: "#DB2777", highlightHex: "#F9A8D4", shadowHex: "#500724", glowRgba: "rgba(236,72,153,0.45)" },
  { id: 9, label: "#09", baseHex: "#94A3B8", highlightHex: "#F8FAFC", shadowHex: "#1E293B", glowRgba: "rgba(226,232,240,0.45)" },
  { id: 10, label: "#10", baseHex: "#D97706", highlightHex: "#FDE68A", shadowHex: "#291803", glowRgba: "rgba(251,191,36,0.5)" },
];

interface BallSimState {
  progress: number; // 0..1
  baseSpeed: number;
  freq1: number;
  phase1: number;
  freq2: number;
  phase2: number;
  spinAngle: number;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

export function MarbleRaceLoader({
  locale = "en",
  targetHref = "/dashboard",
  durationMs = 1400,
  onComplete,
}: {
  locale?: Locale;
  targetHref?: string;
  durationMs?: number;
  onComplete?: () => void;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const completedRef = useRef(false);

  const [pct, setPct] = useState(0);
  const [podiumIds, setPodiumIds] = useState<number[]>([3, 1, 7]);
  const [winnerId, setWinnerId] = useState<number | null>(null);

  const isZh = locale === "zh-CN";

  const finishTransition = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (onComplete) {
      onComplete();
    } else {
      router.replace(targetHref);
    }
  }, [onComplete, router, targetHref]);

  useEffect(() => {
    // Eagerly prefetch the destination page while the marble competition is running in parallel
    if (targetHref) {
      try {
        router.prefetch(targetHref);
      } catch {
        // no-op if prefetch not supported in environment
      }
    }

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      setPct(100);
      setWinnerId(3);
      const t = setTimeout(finishTransition, 250);
      return () => clearTimeout(t);
    }

    // Randomized deterministic-feel per-visit race speeds & surge waves
    const winnerSeed = Math.floor(Math.random() * 10);
    const balls: BallSimState[] = STEEL_BALLS.map((_, idx) => ({
      progress: 0.02,
      baseSpeed: idx === winnerSeed ? 1.07 : 0.91 + Math.random() * 0.14,
      freq1: 3.2 + Math.random() * 2.5,
      phase1: Math.random() * Math.PI * 2,
      freq2: 6.5 + Math.random() * 3.0,
      phase2: Math.random() * Math.PI * 2,
      spinAngle: Math.random() * Math.PI * 2,
    }));

    const sparks: SparkParticle[] = [];
    let rafId = 0;
    const startTs = performance.now();
    let prevTs = startTs;
    let finishHoldTimer: ReturnType<typeof setTimeout> | null = null;
    let lastUiUpdate = 0;

    const drawFrame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.004, (now - prevTs) / 1000));
      prevTs = now;
      const elapsed = now - startTs;
      const normalizedTime = Math.min(1, elapsed / durationMs);

      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const rect = canvas.getBoundingClientRect();
        const w = Math.max(320, rect.width);
        const h = Math.max(260, rect.height);
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
        }

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);

          // 1. Deep Obsidian Track Background + Warm Champagne Top Spotlight
          ctx.fillStyle = "#060709";
          ctx.fillRect(0, 0, w, h);

          const spot = ctx.createRadialGradient(w * 0.55, h * 0.15, 10, w * 0.55, h * 0.45, w * 0.7);
          spot.addColorStop(0, "rgba(231, 201, 142, 0.12)");
          spot.addColorStop(0.5, "rgba(201, 166, 107, 0.04)");
          spot.addColorStop(1, "rgba(6, 7, 9, 0)");
          ctx.fillStyle = spot;
          ctx.fillRect(0, 0, w, h);

          const padX = Math.max(22, w * 0.055);
          const startX = padX;
          const finishX = w - padX - 10;
          const trackSpan = finishX - startX;
          const topY = 18;
          const bottomY = h - 18;
          const laneCount = STEEL_BALLS.length;
          const laneStep = (bottomY - topY) / laneCount;
          const ballRadius = Math.min(13.5, Math.max(8.5, laneStep * 0.36));

          // 2. Render 10 3D Perspective Carbon-Gold Track Lanes
          for (let i = 0; i < laneCount; i++) {
            const cy = topY + laneStep * (i + 0.5);
            // Dark recessed lane trough
            const laneGrad = ctx.createLinearGradient(0, cy - laneStep * 0.42, 0, cy + laneStep * 0.42);
            laneGrad.addColorStop(0, "rgba(255, 255, 255, 0.035)");
            laneGrad.addColorStop(0.5, "rgba(18, 21, 27, 0.92)");
            laneGrad.addColorStop(1, "rgba(0, 0, 0, 0.85)");
            ctx.fillStyle = laneGrad;
            ctx.beginPath();
            ctx.roundRect(startX - 8, cy - laneStep * 0.36, trackSpan + 24, laneStep * 0.72, 6);
            ctx.fill();

            // Subtle metallic guide rail
            ctx.strokeStyle = "rgba(231, 201, 142, 0.11)";
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(startX - 6, cy + laneStep * 0.35);
            ctx.lineTo(finishX + 14, cy + laneStep * 0.35);
            ctx.stroke();

            // Lane number watermark on left
            ctx.fillStyle = "rgba(231, 201, 142, 0.38)";
            ctx.font = "600 9px ui-monospace, SFMono-Regular, monospace";
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.fillText(String(i + 1).padStart(2, "0"), startX - 11, cy);
          }

          // 3. Illuminated Checkered Finish Gate
          const gateWidth = 10;
          const cellSize = 6;
          const rows = Math.ceil((bottomY - topY) / cellSize);
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < 2; c++) {
              ctx.fillStyle = (r + c) % 2 === 0 ? "rgba(245, 231, 196, 0.85)" : "rgba(18, 20, 24, 0.92)";
              ctx.fillRect(
                finishX + c * (gateWidth / 2),
                topY + r * cellSize,
                gateWidth / 2,
                Math.min(cellSize, bottomY - (topY + r * cellSize))
              );
            }
          }
          const laserGrad = ctx.createLinearGradient(finishX - 12, 0, finishX + 14, 0);
          laserGrad.addColorStop(0, "rgba(231, 201, 142, 0)");
          laserGrad.addColorStop(0.5, "rgba(231, 201, 142, 0.25)");
          laserGrad.addColorStop(1, "rgba(231, 201, 142, 0)");
          ctx.fillStyle = laserGrad;
          ctx.fillRect(finishX - 12, topY - 4, 26, bottomY - topY + 8);

          // 4. Advance Simulation & Draw 3D Specular Metallic Steel Balls
          let maxProgress = 0;
          let leadIdx = 0;

          for (let i = 0; i < laneCount; i++) {
            const b = balls[i];
            const spec = STEEL_BALLS[i];

            if (normalizedTime < 1) {
              const surge =
                1 +
                0.24 * Math.sin(normalizedTime * Math.PI * b.freq1 + b.phase1) +
                0.15 * Math.cos(normalizedTime * Math.PI * b.freq2 + b.phase2);
              const finishBoost = i === winnerSeed && normalizedTime > 0.62 ? 1.18 : 1.0;
              const v = (dt / (durationMs / 1000)) * b.baseSpeed * surge * finishBoost * 0.98;
              b.progress = Math.min(1, Math.max(b.progress, b.progress + v));
              b.spinAngle += v * 28;
            } else {
              b.progress = Math.min(1, b.progress + (i === winnerSeed ? 0.04 : 0.02));
            }

            if (b.progress > maxProgress) {
              maxProgress = b.progress;
              leadIdx = i;
            }

            const cy = topY + laneStep * (i + 0.5);
            const bx = startX + b.progress * trackSpan;

            // Emit subtle golden speed sparks from leading balls
            if (normalizedTime < 0.98 && Math.random() < (i === leadIdx ? 0.48 : 0.14)) {
              sparks.push({
                x: bx - ballRadius * 0.7,
                y: cy + (Math.random() - 0.5) * ballRadius * 0.7,
                vx: -40 - Math.random() * 65,
                vy: (Math.random() - 0.5) * 22,
                life: 0,
                maxLife: 0.25 + Math.random() * 0.2,
                color: i === leadIdx ? "#FDE68A" : spec.highlightHex,
              });
            }

            // Motion slipstream ribbon behind ball
            const tailLen = Math.min(bx - startX, 46 + b.baseSpeed * 22);
            if (tailLen > 4) {
              const trailGrad = ctx.createLinearGradient(bx - tailLen, cy, bx, cy);
              trailGrad.addColorStop(0, "rgba(0,0,0,0)");
              trailGrad.addColorStop(1, spec.glowRgba);
              ctx.fillStyle = trailGrad;
              ctx.beginPath();
              ctx.moveTo(bx - tailLen, cy);
              ctx.lineTo(bx, cy - ballRadius * 0.55);
              ctx.lineTo(bx, cy + ballRadius * 0.55);
              ctx.closePath();
              ctx.fill();
            }

            // Cast elliptical shadow on carbon track
            ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
            ctx.beginPath();
            ctx.ellipse(bx + 2, cy + ballRadius * 0.68, ballRadius * 0.92, ballRadius * 0.36, 0, 0, Math.PI * 2);
            ctx.fill();

            // Colored neon lane underglow
            const glowGrad = ctx.createRadialGradient(bx, cy + ballRadius * 0.3, 1, bx, cy, ballRadius * 2.1);
            glowGrad.addColorStop(0, spec.glowRgba);
            glowGrad.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.arc(bx, cy, ballRadius * 2.1, 0, Math.PI * 2);
            ctx.fill();

            // 3D Anodized Steel Sphere Shading (off-center specular + Fresnel rim)
            const sphereGrad = ctx.createRadialGradient(
              bx - ballRadius * 0.36,
              cy - ballRadius * 0.38,
              ballRadius * 0.08,
              bx + ballRadius * 0.1,
              cy + ballRadius * 0.1,
              ballRadius * 1.08
            );
            sphereGrad.addColorStop(0, "#FFFFFF");
            sphereGrad.addColorStop(0.18, spec.highlightHex);
            sphereGrad.addColorStop(0.55, spec.baseHex);
            sphereGrad.addColorStop(0.9, spec.shadowHex);
            sphereGrad.addColorStop(1, "#050608");

            ctx.fillStyle = sphereGrad;
            ctx.beginPath();
            ctx.arc(bx, cy, ballRadius, 0, Math.PI * 2);
            ctx.fill();

            // Bottom-right metallic rim bounce light (gives intense 3D depth)
            ctx.strokeStyle = "rgba(255, 255, 255, 0.26)";
            ctx.lineWidth = 0.85;
            ctx.beginPath();
            ctx.arc(bx, cy, ballRadius - 0.5, 0.15, Math.PI * 0.72);
            ctx.stroke();

            // Rotating specular meridian stripe / steel ball number badge
            const stripeOffset = Math.sin(b.spinAngle) * ballRadius * 0.38;
            ctx.save();
            ctx.beginPath();
            ctx.arc(bx, cy, ballRadius * 0.94, 0, Math.PI * 2);
            ctx.clip();
            ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
            ctx.beginPath();
            ctx.ellipse(bx + stripeOffset, cy, ballRadius * 0.28, ballRadius * 0.9, 0.25, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Crisp micro-specular white glint
            ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
            ctx.beginPath();
            ctx.ellipse(
              bx - ballRadius * 0.34,
              cy - ballRadius * 0.35,
              ballRadius * 0.24,
              ballRadius * 0.14,
              -0.55,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }

          // 5. Render & Update Sparks
          for (let s = sparks.length - 1; s >= 0; s--) {
            const sp = sparks[s];
            sp.life += dt;
            if (sp.life >= sp.maxLife) {
              sparks.splice(s, 1);
              continue;
            }
            sp.x += sp.vx * dt;
            sp.y += sp.vy * dt;
            const alpha = 1 - sp.life / sp.maxLife;
            ctx.fillStyle = sp.color;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, 1.35, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }

          ctx.restore();
        }
      }

      // Throttle React podium/progress state updates (~15Hz) while keeping Canvas 60fps
      if (now - lastUiUpdate > 65 || normalizedTime >= 1) {
        lastUiUpdate = now;
        const ranked = balls
          .map((b, i) => ({ id: STEEL_BALLS[i].id, p: b.progress }))
          .sort((a, b) => b.p - a.p)
          .slice(0, 3)
          .map((item) => item.id);
        setPodiumIds(ranked);
        setPct(Math.min(100, Math.round(normalizedTime * 100)));
      }

      if (normalizedTime < 1) {
        rafId = requestAnimationFrame(drawFrame);
      } else {
        const rankedTop = balls
          .map((b, i) => ({ id: STEEL_BALLS[i].id, p: b.progress }))
          .sort((a, b) => b.p - a.p)[0]?.id;
        setWinnerId(rankedTop ?? 3);
        setPct(100);
        finishHoldTimer = setTimeout(finishTransition, 180);
      }
    };

    rafId = requestAnimationFrame(drawFrame);

    return () => {
      cancelAnimationFrame(rafId);
      if (finishHoldTimer) clearTimeout(finishHoldTimer);
    };
  }, [durationMs, finishTransition]);

  const getBall = (id: number) => STEEL_BALLS.find((b) => b.id === id) ?? STEEL_BALLS[0];

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[90] flex flex-col justify-between overflow-hidden bg-[#050608] text-[#F2F0EB]"
    >
      {/* Ambient Radial Gold Backlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(75%_45%_at_50%_18%,rgba(231,201,142,0.11),transparent_70%)]"
      />

      {/* Top Telemetry Bar */}
      <header className="relative z-10 mx-auto flex w-full max-w-4xl items-center justify-between px-5 pt-5 pb-3 sm:px-8">
        <div className="flex items-center gap-3">
          <Roll10Logo className="h-6 w-auto" />
          <span className="hidden h-4 w-px bg-white/15 sm:inline-block" />
          <span className="hidden font-mono-sgt text-[11px] uppercase tracking-widest text-[#C9A66B] sm:inline-block">
            {isZh ? "10 珠竞速 · 正在载入会员中心" : "10-BALL GRAND PRIX · SYNCING TELEMETRY"}
          </span>
        </div>

        <button
          type="button"
          onClick={finishTransition}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[#E7C98E]/35 bg-[#12151B]/90 px-3.5 text-xs font-medium text-[#E7C98E] transition hover:border-[#E7C98E] hover:bg-[#E7C98E]/10"
        >
          <span>{isZh ? "跳过动画" : "Enter Now"}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </header>

      {/* Center 3D 10-Steel-Ball Race Track Arena */}
      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 sm:px-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#E7C98E]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>
                {isZh ? "ROLL10 会员专属通道已认证" : "ROLL10 MEMBER TELEMETRY AUTHENTICATED"}
              </span>
            </div>
            <h1 className="mt-1 text-lg font-bold tracking-tight text-[#F7F5F0] sm:text-2xl">
              {winnerId
                ? isZh
                  ? `#${String(winnerId).padStart(2, "0")} 号钢珠率先冲线 · 正在进入仪表盘`
                  : `Steel Ball #${String(winnerId).padStart(2, "0")} Crosses First · Entering Dashboard`
                : isZh
                  ? "10 粒不同色 3D 钢珠竞速冲刺中..."
                  : "10-Color 3D Steel Ball Grand Prix Sprint"}
            </h1>
          </div>

          <div className="flex items-center gap-1.5">
            {podiumIds.map((id, rank) => {
              const b = getBall(id);
              return (
                <div
                  key={`${rank}-${id}`}
                  className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#111419] px-2.5 py-1 text-[11px] font-medium"
                >
                  <span className="font-mono-sgt text-[10px] text-[#9DA4B0]">
                    {rank === 0 ? "1ST" : rank === 1 ? "2ND" : "3RD"}
                  </span>
                  <span
                    className="h-2.5 w-2.5 rounded-full shadow-sm"
                    style={{
                      background: `radial-gradient(circle at 32% 30%, ${b.highlightHex}, ${b.baseHex} 65%, ${b.shadowHex})`,
                    }}
                  />
                  <span className="font-mono-sgt font-semibold text-[#F2F0EB]">{b.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Framed 3D Track Canvas */}
        <div className="r10-hero-3d relative overflow-hidden rounded-2xl border border-[#E7C98E]/30 bg-[#060709] p-1 shadow-[0_24px_60px_rgba(0,0,0,0.9)]">
          <canvas
            ref={canvasRef}
            aria-label="10-color 3D steel ball race loading animation"
            className="block h-[290px] w-full rounded-xl sm:h-[360px]"
          />
        </div>

        {/* 10-Color Ball Legend + Progress Bar */}
        <div className="mt-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-[#A9AFBC]">
              <Flag className="h-3.5 w-3.5 text-[#E7C98E]" />
              <span>
                {isZh
                  ? "正在同步实时团队积分、直推奖励与 00:00 SGT 倒数..."
                  : "Syncing live team points, referral rewards & 00:00 SGT rollover..."}
              </span>
            </span>
            <span className="font-mono-sgt font-bold text-[#E7C98E]">{pct}%</span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full border border-white/10 bg-[#0E1116] p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#B58A44] via-[#E7C98E] to-[#FFF2CE] shadow-[0_0_12px_rgba(231,201,142,0.55)] transition-[width] duration-75"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {STEEL_BALLS.map((b) => (
              <div
                key={b.id}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono-sgt transition ${
                  winnerId === b.id
                    ? "border-[#E7C98E] bg-[#E7C98E]/15 text-[#F7E5BA]"
                    : "border-white/[0.07] bg-[#0D1015] text-[#9DA4B0]"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${b.highlightHex}, ${b.baseHex} 65%, ${b.shadowHex})`,
                  }}
                />
                <span>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="relative z-10 pb-5 text-center font-mono-sgt text-[10px] tracking-widest text-[#687080]">
        ROLL10 · INTERNATIONAL STEEL BALL RACING &amp; BINARY SETTLEMENT
      </footer>
    </div>
  );
}
