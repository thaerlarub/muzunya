import { test } from "node:test";
import assert from "node:assert/strict";
import { earnedBadges, latestWeight, progress, BADGE_ITEM, BADGE_NAME } from "./badges.ts";
import { addDays } from "./dates.ts";
import type { Customer, DayLog, Followup, PlanVersion } from "./types.ts";

const at = (d: string) => Date.parse(d + "T08:00:00Z");
const cust = (o: Partial<Customer> = {}): Customer => ({
  user_id: "c", name: "", phone: "", status: "active", height: 160, w0: 50, start_date: "2026-11-01", track: "gain", goal_w: null,
  act: "1.375", sur: "400", man_kcal: null, mascot: null, wardrobe: {}, allergies: null, journey_finished_at: null, letter: null, ...o,
});
const fu = (date: string, weight: number, updated_at = 1): Followup => ({ id: date, customer_id: "c", author: "customer", date, weight, updated_at });
const meal: PlanVersion = {
  id: "m", customer_id: "c", type: "meal", start_date: "2026-11-01", cycle_len: 7, created_at: 1,
  body: { slots: [{ id: "bf", name: "", icon: "", kind: "choose" }], pages: [], vars: { dt: "", hd: "" } },
};
const days = (from: string, n: number, made = (d: string) => d): DayLog[] =>
  Array.from({ length: n }, (_, i) => { const d = addDays(from, i); return { date: d, body: { "m:bf": [1, at(made(d))] } }; });
const ctx = (o: { customer?: Customer; logs?: DayLog[]; followups?: Followup[]; versions?: PlanVersion[]; today?: string }) =>
  earnedBadges({ customer: o.customer ?? cust(), versions: o.versions ?? [meal], logs: o.logs ?? [], followups: o.followups ?? [], today: o.today ?? "2026-11-25" });

test("names and items", () => {
  assert.equal(BADGE_ITEM.finish, "crown");
  assert.equal(BADGE_NAME.week1, "أول أسبوع");
});
test("week1 needs 5 counting tick days in the first 7 and 7 days passed", () => {
  assert.deepEqual(ctx({ logs: days("2026-11-01", 5) }), ["week1"]);
  assert.deepEqual(ctx({ logs: days("2026-11-01", 5), today: "2026-11-07" }), []);
  assert.deepEqual(ctx({ logs: days("2026-11-01", 5, (d) => addDays(d, 3)) }), []); // late ticks
});
test("streak7 and perfect", () => {
  const b = ctx({ logs: days("2026-11-10", 7) });
  assert.ok(b.includes("streak7") && b.includes("perfect"));
  assert.ok(!ctx({ logs: days("2026-11-10", 6) }).includes("streak7"));
  // a scheduled workout not done breaks the perfect week, but not the streak
  const ex: PlanVersion = { id: "e", customer_id: "c", type: "exercise", start_date: "2026-11-10", cycle_len: 7, created_at: 2,
    body: { days: [{ title: "a", ic: "low", items: [{ sets: 3, reps: "", rest: "" }] }, ...Array(6).fill({ rest: true })], pages: [], vars: { dt: "", hd: "" } } };
  const b2 = ctx({ logs: days("2026-11-10", 7), versions: [meal, ex] });
  assert.ok(b2.includes("streak7") && !b2.includes("perfect"));
});
test("kg1, half, finish, latestWeight, progress", () => {
  assert.ok(ctx({ followups: [fu("2026-11-08", 50.6), fu("2026-11-15", 51)] }).includes("kg1"));
  assert.ok(!ctx({ followups: [fu("2026-11-15", 49)] }).includes("kg1"));
  assert.ok(ctx({ customer: cust({ track: "loss" }), followups: [fu("2026-11-15", 49)] }).includes("kg1"));
  assert.equal(latestWeight(cust(), [fu("2026-11-15", 52), fu("2026-11-08", 55)]), 52);
  assert.equal(latestWeight(cust(), []), 50);
  const g = cust({ goal_w: 54 });
  assert.equal(progress(cust(), []), null);
  assert.equal(progress(g, [fu("2026-11-15", 52)]), 0.5);
  assert.equal(progress(g, [fu("2026-11-15", 48)]), 0);
  assert.deepEqual(ctx({ customer: g, followups: [fu("2026-11-15", 52)] }), ["kg1", "half"]);
  assert.ok(ctx({ customer: cust({ journey_finished_at: "2026-11-20" }) }).includes("finish"));
});
