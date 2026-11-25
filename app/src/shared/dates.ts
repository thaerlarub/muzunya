import type { PlanVersion, PlanType } from "./types.ts";

const DAY = 864e5;
const ms = (d: string) => Date.parse(d + "T00:00:00Z");
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** YYYY-MM-DD in Asia/Muscat (UTC+4, no DST). */
export const muscatDate = (t: number = Date.now()): string => iso(t + 4 * 3600e3);
export const todayMuscat = (): string => muscatDate(Date.now());
export const addDays = (d: string, n: number): string => iso(ms(d) + n * DAY);
/** a minus b in whole days. */
export const diffDays = (a: string, b: string): number => Math.round((ms(a) - ms(b)) / DAY);
/** The Saturday on or before d. */
export const weekStart = (d: string): string => addDays(d, -((new Date(ms(d)).getUTCDay() + 1) % 7));

/** Latest start_date <= date; ties broken by larger created_at. */
export function activeVersion<T extends { start_date: string; created_at?: number }>(vs: T[], date: string): T | null {
  let best: T | null = null;
  for (const v of vs) {
    if (v.start_date > date) continue;
    if (!best || v.start_date > best.start_date || (v.start_date === best.start_date && (v.created_at ?? 0) > (best.created_at ?? 0))) best = v;
  }
  return best;
}

export const activeOf = (versions: PlanVersion[], type: PlanType, date: string): PlanVersion | null =>
  activeVersion(versions.filter((v) => v.type === type), date);

/** 1-based day of the plan cycle. */
export function planDay(v: { start_date: string; cycle_len: number }, date: string): number {
  const n = v.cycle_len || 1;
  return ((diffDays(date, v.start_date) % n) + n) % n + 1;
}

/** `m:*` keys use meal versions, `x:*` and `kg:*` exercise. Only past days of the version active today. */
export function canTick(versions: PlanVersion[], key: string, date: string, today: string): boolean {
  const v = activeOf(versions, key.startsWith("m:") ? "meal" : "exercise", today);
  return date <= today && !!v && date >= v.start_date;
}
