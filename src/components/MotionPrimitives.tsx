"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Lightweight concentric track contour SVG with a single restrained ice-blue
 * dot orbiting in ~9s. Automatically pauses when hidden, off-screen, or under reduced-motion.
 */
export function TrackWireframe({ className = "" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const [docVisible, setDocVisible] = useState(true);

  useEffect(() => {
    const onVis = () => setDocVisible(document.visibilityState === "visible");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        setInView(Boolean(entries[0]?.isIntersecting));
      },
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const paused = !inView || !docVisible;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    >
      <svg
        viewBox="0 0 156 116"
        className="h-full w-full overflow-visible"
        fill="none"
      >
        <defs>
          <radialGradient id="r10DotGlowCyan" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="45%" stopColor="#51E7FA" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#18C5DC" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer subtle contour */}
        <path
          d="M 10 86 C 8 44, 50 42, 72 24 C 92 8, 108 4, 128 9 C 148 14, 150 48, 126 65 C 102 82, 80 83, 60 100 C 40 116, 12 114, 10 86 Z"
          stroke="#2B3D4D"
          strokeOpacity="0.45"
          strokeWidth="1"
        />
        {/* Middle contour */}
        <path
          d="M 14 84 C 13 48, 52 46, 73 29 C 91 14, 103 7, 124 12 C 143 16, 145 45, 123 60 C 100 76, 78 78, 59 95 C 41 110, 15 109, 14 84 Z"
          stroke="#51E7FA"
          strokeOpacity="0.25"
          strokeWidth="1"
        />
        {/* Primary track path */}
        <path
          d="M 18 82 C 18 52, 54 50, 74 34 C 90 21, 98 10, 120 14 C 138 18, 140 42, 120 56 C 98 71, 76 74, 58 90 C 42 104, 18 104, 18 82 Z"
          stroke="#51E7FA"
          strokeOpacity="0.65"
          strokeWidth="1.25"
        />
        {/* Inner contour */}
        <path
          d="M 27 80 C 27 58, 58 55, 76 41 C 90 30, 96 20, 114 23 C 127 26, 128 42, 113 52 C 95 64, 75 67, 58 82 C 44 94, 27 94, 27 80 Z"
          stroke="#2B3D4D"
          strokeOpacity="0.4"
          strokeWidth="1"
        />

        {/* Single moving ice-blue light dot */}
        <g className={`r10-track-dot ${paused ? "r10-track-dot-paused" : ""}`}>
          <circle cx="0" cy="0" r="8" fill="url(#r10DotGlowCyan)" />
          <circle cx="0" cy="0" r="2.2" fill="#FFFFFF" />
        </g>
      </svg>
    </div>
  );
}

/**
 * Atmospheric 3D F1 racetrack sweep backdrop for the Hero telemetry card:
 * sweeping tarmac curve, apex curbs & electric cyan / ice-blue horizon streaks.
 */
export function HeroRacetrackBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      <svg
        viewBox="0 0 600 280"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full opacity-90"
        fill="none"
      >
        <defs>
          <linearGradient id="r10Tarmac" x1="120" y1="270" x2="580" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0A101A" stopOpacity="0" />
            <stop offset="32%" stopColor="#142130" stopOpacity="0.65" />
            <stop offset="72%" stopColor="#1C2E42" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#101B27" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="r10HorizonCyan" x1="40" y1="215" x2="585" y2="160" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#51E7FA" stopOpacity="0" />
            <stop offset="30%" stopColor="#A5F6FF" stopOpacity="0.8" />
            <stop offset="58%" stopColor="#51E7FA" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#18C5DC" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="r10TrackRim" x1="210" y1="280" x2="590" y2="170" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#51E7FA" stopOpacity="0" />
            <stop offset="45%" stopColor="#51E7FA" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#A5F6FF" stopOpacity="0.15" />
          </linearGradient>
          <radialGradient id="r10HeroLeftSpot" cx="22%" cy="82%" r="48%">
            <stop offset="0%" stopColor="#51E7FA" stopOpacity="0.22" />
            <stop offset="55%" stopColor="#101B27" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#0A101A" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Sweeping tarmac bend */}
        <path
          d="M 80 280 C 240 245, 435 196, 600 116 L 600 280 Z"
          fill="url(#r10Tarmac)"
        />
        {/* Inner shoulder groove */}
        <path
          d="M 155 280 C 315 252, 472 212, 600 150"
          stroke="url(#r10TrackRim)"
          strokeWidth="1.4"
        />
        {/* Red & silver sculpted apex rumble curbs */}
        <g opacity="0.85">
          <polygon points="365,268 390,258 403,264 377,274" fill="#C93232" />
          <polygon points="393,257 417,246 429,252 405,263" fill="#E8EEF5" />
          <polygon points="420,245 443,233 454,239 431,251" fill="#C93232" />
          <polygon points="446,232 468,219 478,225 456,238" fill="#E8EEF5" />
          <polygon points="471,218 492,204 501,209 480,223" fill="#C93232" />
          <polygon points="495,203 515,188 523,193 503,208" fill="#E8EEF5" />
          <polygon points="517,187 536,171 544,176 525,192" fill="#C93232" />
          <polygon points="538,170 556,154 563,159 546,175" fill="#E8EEF5" />
        </g>
        {/* Horizon cyan light streak + speed lines */}
        <path
          d="M 0 222 Q 255 206 600 138"
          stroke="url(#r10HorizonCyan)"
          strokeWidth="2.5"
        />
        <path
          d="M 40 238 Q 290 220 595 158"
          stroke="url(#r10HorizonCyan)"
          strokeWidth="1.2"
          opacity="0.65"
        />
        <rect x="0" y="110" width="600" height="170" fill="url(#r10HeroLeftSpot)" />
      </svg>
    </div>
  );
}

/**
 * 3D Illuminated Motorsport Tachometer Dial for the 00:00 SGT Countdown.
 * Brushed titanium bezel, radial tick marks, ice-blue illuminated arc.
 */
export function TachometerDial({
  progress = 0.72,
  isUrgentAmber = false,
  children,
}: {
  progress?: number;
  isUrgentAmber?: boolean;
  children: React.ReactNode;
}) {
  const clamped = Math.max(0.06, Math.min(0.98, progress));
  const cx = 92;
  const cy = 92;
  const rArc = 77;
  const startDeg = 135; // bottom-left
  const sweepDeg = 270; // 270-degree dial sweep clockwise to bottom-right
  const activeDeg = startDeg + sweepDeg * clamped;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const polar = (radius: number, deg: number) => ({
    x: cx + radius * Math.cos(toRad(deg)),
    y: cy + radius * Math.sin(toRad(deg)),
  });

  const arcStart = polar(rArc, startDeg);
  const arcTrackEnd = polar(rArc, startDeg + sweepDeg);
  const arcActiveEnd = polar(rArc, activeDeg);
  const activeLargeArc = sweepDeg * clamped > 180 ? 1 : 0;

  const trackPath = `M ${arcStart.x.toFixed(2)} ${arcStart.y.toFixed(2)} A ${rArc} ${rArc} 0 1 1 ${arcTrackEnd.x.toFixed(2)} ${arcTrackEnd.y.toFixed(2)}`;
  const activePath = `M ${arcStart.x.toFixed(2)} ${arcStart.y.toFixed(2)} A ${rArc} ${rArc} 0 ${activeLargeArc} 1 ${arcActiveEnd.x.toFixed(2)} ${arcActiveEnd.y.toFixed(2)}`;

  const totalTicks = 36;
  const ticks = Array.from({ length: totalTicks + 1 }).map((_, idx) => {
    const ratio = idx / totalTicks;
    const deg = startDeg + sweepDeg * ratio;
    const isMajor = idx % 6 === 0;
    const innerR = isMajor ? 65 : 68;
    const outerR = 73;
    const p1 = polar(innerR, deg);
    const p2 = polar(outerR, deg);
    const lit = ratio <= clamped;
    return { p1, p2, lit, isMajor, idx };
  });

  return (
    <div className="relative mx-auto flex h-[146px] w-[146px] sm:h-[160px] sm:w-[160px] items-center justify-center">
      <svg
        viewBox="0 0 184 184"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        fill="none"
      >
        <defs>
          <radialGradient id="r10DialFace" cx="50%" cy="45%" r="52%">
            <stop offset="0%" stopColor="#1A2737" stopOpacity="0.95" />
            <stop offset="70%" stopColor="#101B27" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#080E17" stopOpacity="1" />
          </radialGradient>
          <linearGradient id="r10TachCyan" x1="20" y1="158" x2="164" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={isUrgentAmber ? "#F59E0B" : "#18C5DC"} stopOpacity="0.4" />
            <stop offset="55%" stopColor={isUrgentAmber ? "#FBBF24" : "#51E7FA"} stopOpacity="0.95" />
            <stop offset="100%" stopColor={isUrgentAmber ? "#FEF3C7" : "#E2FBFF"} stopOpacity="1" />
          </linearGradient>
          <radialGradient id="r10TachOrbCyan" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="28%" stopColor={isUrgentAmber ? "#FDE68A" : "#A5F6FF"} stopOpacity="0.95" />
            <stop offset="65%" stopColor={isUrgentAmber ? "#F59E0B" : "#51E7FA"} stopOpacity="0.6" />
            <stop offset="100%" stopColor="#18C5DC" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Recessed 3D metallic titanium bezel */}
        <circle cx={cx} cy={cy} r="84" fill="url(#r10DialFace)" stroke="#2B3D4D" strokeWidth="1.2" />
        <circle cx={cx} cy={cy} r="61" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

        {/* 36 radial precision tick marks */}
        {ticks.map((tk) => (
          <line
            key={tk.idx}
            x1={tk.p1.x.toFixed(2)}
            y1={tk.p1.y.toFixed(2)}
            x2={tk.p2.x.toFixed(2)}
            y2={tk.p2.y.toFixed(2)}
            stroke={tk.lit ? (isUrgentAmber ? "#FBBF24" : "#51E7FA") : "#354A5E"}
            strokeOpacity={tk.lit ? (tk.isMajor ? 0.95 : 0.6) : 0.4}
            strokeWidth={tk.isMajor ? "1.4" : "0.9"}
            strokeLinecap="round"
          />
        ))}

        {/* Background arc */}
        <path
          d={trackPath}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />

        {/* Active illuminated ice-blue sweep */}
        <path
          d={activePath}
          stroke="url(#r10TachCyan)"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Glowing orb at sweep head */}
        <g className="r10-orb-pulse">
          <circle cx={arcActiveEnd.x} cy={arcActiveEnd.y} r="13" fill="url(#r10TachOrbCyan)" />
          <circle cx={arcActiveEnd.x} cy={arcActiveEnd.y} r="2.8" fill="#FFFFFF" />
        </g>
      </svg>

      <div className="relative z-10 flex flex-col items-center justify-center px-3 text-center">
        {children}
      </div>
    </div>
  );
}

/**
 * Checkered Racing Flag icon in titanium silver & ice-blue.
 */
export function CheckeredFlagIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
      <path d="M5 4V20" stroke="#CAD7E6" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M6.5 4.8C9.2 3.8 11.8 6.2 14.5 5.2C16.8 4.4 18.6 4.8 19.5 5.4V13.6C18.2 12.9 16.5 12.6 14.5 13.4C11.8 14.4 9.2 12 6.5 13V4.8Z"
        fill="#101B27"
        stroke="#51E7FA"
        strokeWidth="1.1"
      />
      <rect x="7" y="5.4" width="3" height="2.6" fill="#F4F8FC" />
      <rect x="13" y="5.6" width="3" height="2.6" fill="#F4F8FC" />
      <rect x="10" y="8" width="3" height="2.6" fill="#51E7FA" />
      <rect x="16" y="7.8" width="3" height="2.6" fill="#51E7FA" />
      <rect x="7" y="10.2" width="3" height="2.4" fill="#F4F8FC" />
      <rect x="13" y="10.4" width="3" height="2.4" fill="#F4F8FC" />
    </svg>
  );
}

/**
 * Subtle flowing contour lines for titanium card corners.
 */
export function ContourWaveOverlay({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 90"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
      fill="none"
    >
      <path
        d="M 10 82 C 55 48, 108 78, 152 44 C 180 22, 200 24, 220 12"
        stroke="#51E7FA"
        strokeOpacity="0.22"
        strokeWidth="1"
      />
      <path
        d="M 28 88 C 72 56, 122 84, 166 50 C 190 32, 208 32, 224 22"
        stroke="#CAD7E6"
        strokeOpacity="0.15"
        strokeWidth="1"
      />
      <path
        d="M 54 92 C 94 66, 138 90, 180 58 C 198 44, 212 44, 226 36"
        stroke="#51E7FA"
        strokeOpacity="0.1"
        strokeWidth="1"
      />
    </svg>
  );
}

/**
 * 10-segment slanted matching bonus progress gauge as in the visual specification:
 * 10 racing slanted capsules with ice-blue active fill and metallic borders.
 */
export function MatchingGauge({
  pairedCents,
  capCents,
}: {
  pairedCents: number;
  capCents: number;
}) {
  const ratio = capCents > 0 ? Math.max(0, Math.min(1, pairedCents / capCents)) : 0;
  const segments = 10;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={capCents}
      aria-valuenow={pairedCents}
      className="grid grid-cols-10 gap-1.5 sm:gap-2"
    >
      {Array.from({ length: segments }).map((_, idx) => {
        const segStart = idx / segments;
        const segEnd = (idx + 1) / segments;
        const fill =
          ratio >= segEnd
            ? 100
            : ratio <= segStart
              ? 0
              : Math.round(((ratio - segStart) / (segEnd - segStart)) * 100);

        return (
          <div
            key={idx}
            className={`h-3.5 sm:h-4 -skew-x-[20deg] overflow-hidden rounded-[3px] border transition-colors ${
              fill > 0
                ? "border-[#51E7FA]/80 bg-[#0F2231] shadow-[0_0_12px_rgba(81,231,250,0.4)]"
                : "border-[#2B3D4D] bg-[#0A111A] shadow-[inset_0_2px_4px_rgba(0,0,0,0.85)]"
            }`}
          >
            <div
              className="h-full bg-gradient-to-r from-[#51E7FA] via-[#7CF0FD] to-[#A5F6FF] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition-[width] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: `${fill}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Accessible Bottom Drawer with 240ms enter / 180ms exit transitions,
 * Escape key, focus management, browser Back (popstate) support, and internal scroll.
 */
export function BottomDrawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const pushedHistoryRef = useRef(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    } else {
      setVisible(false);
      const timer = setTimeout(() => setRendered(false), 180);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    // Focus close button cleanly for keyboard/screen-reader accessibility
    const focusTimer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 50);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    // Support browser back button closing the drawer cleanly
    try {
      window.history.pushState({ r10Drawer: true }, "");
      pushedHistoryRef.current = true;
    } catch {
      pushedHistoryRef.current = false;
    }

    const onPopState = () => {
      pushedHistoryRef.current = false;
      onClose();
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onPopState);
      if (pushedHistoryRef.current) {
        pushedHistoryRef.current = false;
        try {
          window.history.back();
        } catch {
          // ignore
        }
      }
    };
  }, [open, onClose]);

  if (!rendered || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity motion-reduce:transition-none ${
          visible ? "duration-[240ms] opacity-100" : "duration-[180ms] opacity-0"
        }`}
      />

      {/* Drawer Panel */}
      <div
        className={`relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl border border-[#2B3D4D] bg-[#101B27] shadow-2xl transition-transform ease-out motion-reduce:transition-none sm:rounded-3xl ${
          visible
            ? "duration-[240ms] translate-y-0 opacity-100"
            : "duration-[180ms] translate-y-6 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#2B3D4D] px-5 py-3.5">
          <h2 className="text-sm font-semibold text-[#F4F8FC]">{title}</h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#AAB8C7] transition hover:bg-white/5 hover:text-[#F4F8FC]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-[#F4F8FC]">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
