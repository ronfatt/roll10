import type { Locale } from "./i18n";

export interface RolloverClockViewState {
  remainingMs: number;
  hhmmss: string;
  secondsPart: string;
  isUrgentAmber: boolean;
  isSettling: boolean;
}

/**
 * Pure deterministic calculator for the 00:00 SGT midnight BV rollover countdown.
 */
export function computeMidnightCountdownState(params: {
  serverNowIso: string;
  nextRolloverAtIso: string;
  elapsedClientMs: number;
  flushedBv: number;
}): RolloverClockViewState {
  const serverNowMs = new Date(params.serverNowIso).getTime();
  const rolloverMs = new Date(params.nextRolloverAtIso).getTime();
  const effectiveNowMs = serverNowMs + Math.max(0, params.elapsedClientMs);
  const remainingMs = Math.max(0, rolloverMs - effectiveNowMs);

  const isSettling = remainingMs <= 0;
  const totalSec = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  const secondsPart = pad(secs);
  const hhmmss = `${pad(hours)}:${pad(mins)}:${secondsPart}`;
  const isUrgentAmber =
    !isSettling && remainingMs < 15 * 60 * 1000 && params.flushedBv > 0;

  return {
    remainingMs,
    hhmmss,
    secondsPart,
    isUrgentAmber,
    isSettling,
  };
}

/**
 * Singular/plural formatting for team member headcounts ("1 member" vs "2 members", "N 人").
 */
export function formatMemberCountText(count: number, locale: Locale): string {
  if (locale === "zh-CN") {
    return `${count.toLocaleString("en-US")} 人`;
  }
  return count === 1
    ? "1 member"
    : `${count.toLocaleString("en-US")} members`;
}
