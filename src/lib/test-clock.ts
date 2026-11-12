import { addDaysToSgtDate, getSgtDateString, makeSgtDate } from "./sgt";

/**
 * Deterministic, controllable test clock operating in Asia/Singapore (SGT)
 * without mutating OS/server system time.
 */
export class TestClock {
  private current: Date;

  constructor(initialSgtDate: string, initialSgtTime: string = "09:00:00") {
    this.current = makeSgtDate(initialSgtDate, initialSgtTime);
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  setSgt(dateStr: string, timeStr: string = "00:00:00"): Date {
    this.current = makeSgtDate(dateStr, timeStr);
    return this.now();
  }

  advanceSeconds(seconds: number): Date {
    this.current = new Date(this.current.getTime() + seconds * 1000);
    return this.now();
  }

  advanceDaysToSgtTime(days: number, timeStr: string = "00:00:00"): Date {
    const nextDate = addDaysToSgtDate(getSgtDateString(this.current), days);
    this.current = makeSgtDate(nextDate, timeStr);
    return this.now();
  }

  sgtDate(): string {
    return getSgtDateString(this.current);
  }
}
