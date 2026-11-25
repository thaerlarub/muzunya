import type { Slot, ExDay, ExBody, MealBody, DayLog, DayBody, PlanVersion } from "./types.ts";
import { activeOf, addDays, muscatDate, planDay, weekStart } from "./dates.ts";

const val = (body: DayBody, k: string) => body[k]?.[0] ?? 0;

/** 0..1. Counter slots: glasses / target; others: ticked or not. */
export function slotDone(body: DayBody, slot: Slot): number {
  const v = val(body, "m:" + slot.id);
  return slot.kind === "counter" ? Math.min(1, v / (slot.target || 1)) : v >= 1 ? 1 : 0;
}

export const dayMealPct = (body: DayBody, slots: Slot[]): number =>
  slots.length ? slots.reduce((s, x) => s + slotDone(body, x), 0) / slots.length : 0;

export function exDayFor(versions: PlanVersion[], date: string): ExDay | null {
  const v = activeOf(versions, "exercise", date);
  return v ? (v.body as ExBody).days?.[planDay(v, date) - 1] ?? null : null;
}

export const workoutDone = (body: DayBody, day: ExDay | null): boolean =>
  !!day && !day.rest && day.items.every((_, i) => val(body, "x:" + i) >= 1);

export const tickedOn = (body: DayBody): boolean => Object.values(body).some(([v]) => v > 0);

/** A tick counts for streaks and badges only when made on its day or the next (Muscat). */
export const countsForStreak = (date: string, t: number): boolean => muscatDate(t) <= addDays(date, 1);

/** The day body with late ticks removed. */
export function onTimeBody(date: string, body: DayBody): DayBody {
  const out: DayBody = {};
  for (const k in body) if (countsForStreak(date, body[k][1])) out[k] = body[k];
  return out;
}

/** Longest run of consecutive dates in a set. */
export function longestRun(dates: Set<string>): number {
  let best = 0;
  for (const d of dates) {
    if (dates.has(addDays(d, -1))) continue;
    let n = 1;
    while (dates.has(addDays(d, n))) n++;
    best = Math.max(best, n);
  }
  return best;
}

export function streak(logs: DayLog[], today: string): { cur: number; best: number } {
  const days = new Set(logs.filter((l) => l.date <= today && tickedOn(onTimeBody(l.date, l.body))).map((l) => l.date));
  let d = days.has(today) ? today : addDays(today, -1), cur = 0;
  while (days.has(d)) { cur++; d = addDays(d, -1); }
  return { cur, best: longestRun(days) };
}

export function weekStats(versions: PlanVersion[], logs: DayLog[], today: string) {
  const by = new Map(logs.map((l) => [l.date, l.body]));
  const pcts: number[] = [];
  let workoutsDone = 0, workoutsPlanned = 0;
  for (let d = weekStart(today); d <= today; d = addDays(d, 1)) {
    const body = by.get(d) ?? {};
    const mv = activeOf(versions, "meal", d);
    if (mv) pcts.push(dayMealPct(body, (mv.body as MealBody).slots ?? []));
    const ex = exDayFor(versions, d);
    if (ex && !ex.rest) { workoutsPlanned++; if (workoutDone(body, ex)) workoutsDone++; }
  }
  return { mealPct: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0, workoutsDone, workoutsPlanned };
}

export function lastTickDate(logs: DayLog[]): string | null {
  let last: string | null = null;
  for (const l of logs) if (tickedOn(l.body) && (!last || l.date > last)) last = l.date;
  return last;
}
