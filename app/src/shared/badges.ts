import type { BadgeId, Customer, DayLog, Followup, MealBody, PlanVersion, WearItem } from "./types.ts";
import { activeOf, addDays } from "./dates.ts";
import { dayMealPct, exDayFor, longestRun, onTimeBody, streak, tickedOn, workoutDone } from "./stats.ts";

export const BADGE_ITEM: Record<BadgeId, WearItem> = {
  week1: "bow", kg1: "necklace", streak7: "scarf", perfect: "glasses", half: "flower", finish: "crown",
};
export const BADGE_NAME: Record<BadgeId, string> = {
  week1: "أول أسبوع", kg1: "أول كيلو", streak7: "سلسلة 7 أيام", perfect: "أسبوع مثالي", half: "نصف الطريق", finish: "اكتملت الرحلة",
};

/** Latest followup weight by date, else w0. */
export function latestWeight(customer: Customer, followups: Followup[]): number | null {
  let best: Followup | null = null;
  for (const f of followups) {
    if (f.weight == null) continue;
    if (!best || f.date > best.date || (f.date === best.date && f.updated_at > best.updated_at)) best = f;
  }
  return best ? best.weight! : customer.w0;
}

/** Share of the way from w0 to goal_w, 0..1; null without a goal. */
export function progress(customer: Customer, followups: Followup[]): number | null {
  const { w0, goal_w } = customer;
  if (goal_w == null || w0 == null) return null;
  if (goal_w === w0) return 1;
  const lw = latestWeight(customer, followups) ?? w0;
  return Math.min(1, Math.max(0, (lw - w0) / (goal_w - w0)));
}

export function earnedBadges(ctx: { customer: Customer; versions: PlanVersion[]; logs: DayLog[]; followups: Followup[]; today: string }): BadgeId[] {
  const { customer: c, versions, logs, followups, today } = ctx;
  const on = logs.filter((l) => l.date <= today).map((l) => ({ date: l.date, body: onTimeBody(l.date, l.body) }));
  const out: BadgeId[] = [];

  const start = c.start_date, end = addDays(start, 6);
  if (today >= addDays(start, 7) && on.filter((l) => l.date >= start && l.date <= end && tickedOn(l.body)).length >= 5) out.push("week1");

  const lw = latestWeight(c, followups);
  if (lw != null && c.w0 != null && (lw - c.w0) * (c.track === "loss" ? -1 : 1) >= 1 - 1e-9) out.push("kg1");

  if (streak(logs, today).best >= 7) out.push("streak7");

  const perfect = new Set(on.filter(({ date, body }) => {
    const mv = activeOf(versions, "meal", date);
    const slots = mv ? (mv.body as MealBody).slots ?? [] : [];
    const ex = exDayFor(versions, date);
    return slots.length > 0 && dayMealPct(body, slots) === 1 && (!ex || ex.rest || workoutDone(body, ex));
  }).map((l) => l.date));
  if (longestRun(perfect) >= 7) out.push("perfect");

  const p = progress(c, followups);
  if (p != null && p >= 0.5) out.push("half");
  if (c.journey_finished_at) out.push("finish");
  return out;
}
