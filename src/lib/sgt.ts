export const SGT_TIMEZONE = "Asia/Singapore";
const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * Converts any Date into its wall-clock fields in Asia/Singapore (UTC+8, no DST).
 */
export function getSgtParts(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dateString: string;
  timeString: string;
} {
  const sgt = new Date(date.getTime() + SGT_OFFSET_MS);
  const year = sgt.getUTCFullYear();
  const month = sgt.getUTCMonth() + 1;
  const day = sgt.getUTCDate();
  const hour = sgt.getUTCHours();
  const minute = sgt.getUTCMinutes();
  const second = sgt.getUTCSeconds();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateString = `${year}-${pad(month)}-${pad(day)}`;
  const timeString = `${pad(hour)}:${pad(minute)}:${pad(second)}`;
  return { year, month, day, hour, minute, second, dateString, timeString };
}

export function getSgtDateString(date: Date = new Date()): string {
  return getSgtParts(date).dateString;
}

export function addDaysToSgtDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d + days);
  const dt = new Date(utc);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/**
 * Computes the fixed D+2 00:01:00 SGT upgrade effective timestamp from the
 * server-recorded payment confirmation timestamp.
 */
export function getUpgradeEffectiveScheduleSgt(
  confirmedAt: Date = new Date(),
  daysOffset: number = 2,
  effectiveTimeSgt: string = "00:01:00"
): {
  confirmedSgtDate: string;
  confirmedSgtTime: string;
  effectiveSgtDate: string;
  effectiveAt: Date;
  effectiveSgtLabel: string;
} {
  const parts = getSgtParts(confirmedAt);
  const effectiveSgtDate = addDaysToSgtDate(parts.dateString, daysOffset);
  const effectiveAt = makeSgtDate(effectiveSgtDate, effectiveTimeSgt);
  return {
    confirmedSgtDate: parts.dateString,
    confirmedSgtTime: parts.timeString,
    effectiveSgtDate,
    effectiveAt,
    effectiveSgtLabel: `${effectiveSgtDate} ${effectiveTimeSgt} SGT`,
  };
}

export function formatSgtTimestamp(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const parts = getSgtParts(d);
  return `${parts.dateString} ${parts.timeString} SGT`;
}

/**
 * Constructs a Date from an explicit SGT date ('YYYY-MM-DD') and time ('HH:mm:ss').
 */
export function makeSgtDate(dateStr: string, timeStr: string = "00:00:00"): Date {
  return new Date(`${dateStr}T${timeStr}+08:00`);
}

const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function getSgtWeekdayLabel(date: Date, locale: string = "en"): string {
  const sgt = new Date(date.getTime() + SGT_OFFSET_MS);
  const dow = sgt.getUTCDay();
  return locale === "zh-CN" ? WEEKDAYS_ZH[dow] : WEEKDAYS_EN[dow];
}

/**
 * Formats natural weekday + SGT time schedule string, e.g.
 * "周一 17:00 确认付款，周三 00:01 SGT 生效" / "Mon 17:00 confirmed, Wed 00:01 SGT effective"
 */
export function formatSgtNaturalSchedule(
  confirmedAt: Date,
  effectiveAt: Date,
  locale: string = "en"
): string {
  const cParts = getSgtParts(confirmedAt);
  const eParts = getSgtParts(effectiveAt);
  const cDay = getSgtWeekdayLabel(confirmedAt, locale);
  const eDay = getSgtWeekdayLabel(effectiveAt, locale);
  const cTime = cParts.timeString.slice(0, 5);
  const eTime = eParts.timeString.slice(0, 5);
  if (locale === "zh-CN") {
    return `${cDay} ${cParts.dateString} ${cTime} SGT 确认付款，${eDay} ${eParts.dateString} ${eTime}:00 SGT 生效`;
  }
  return `${cDay} ${cParts.dateString} ${cTime} SGT confirmed, ${eDay} ${eParts.dateString} ${eTime}:00 SGT effective`;
}

const MONTHS_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Formats compact SGT effective label, e.g. "14 Nov · 00:01 SGT" or "11月14日 · 00:01 SGT".
 */
/**
 * Returns the next 00:00:00 Asia/Singapore rollover boundary strictly after `now`,
 * along with the SGT settlement date it closes out.
 */
export function getNextSgtRolloverAt(now: Date = new Date()): {
  currentSgtDate: string;
  nextRolloverAt: Date;
  remainingMs: number;
} {
  const currentSgtDate = getSgtDateString(now);
  const nextSgtDate = addDaysToSgtDate(currentSgtDate, 1);
  const nextRolloverAt = makeSgtDate(nextSgtDate, "00:00:00");
  const remainingMs = Math.max(0, nextRolloverAt.getTime() - now.getTime());
  return { currentSgtDate, nextRolloverAt, remainingMs };
}

export function formatSgtCompactDateTime(date: Date | string, locale: string = "en"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const parts = getSgtParts(d);
  const hhmm = parts.timeString.slice(0, 5);
  if (locale === "zh-CN") {
    return `${parts.month}月${parts.day}日 · ${hhmm} SGT`;
  }
  return `${parts.day} ${MONTHS_EN[parts.month - 1] ?? ""} · ${hhmm} SGT`;
}
