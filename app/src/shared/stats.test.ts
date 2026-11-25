import { test } from "node:test";
import assert from "node:assert/strict";
import { slotDone, dayMealPct, exDayFor, workoutDone, tickedOn, countsForStreak, streak, weekStats, lastTickDate } from "./stats.ts";
import type { DayLog, PlanVersion, Slot } from "./types.ts";

const at = (d: string, h = 12) => Date.parse(d + "T00:00:00Z") + (h - 4) * 3600e3; // h o'clock Muscat
const slots: Slot[] = [
  { id: "bf", name: "", icon: "", kind: "choose" },
  { id: "wa", name: "", icon: "", kind: "counter", target: 8 },
];
const meal: PlanVersion = { id: "m", customer_id: "c", type: "meal", start_date: "2026-11-01", cycle_len: 7, created_at: 1, body: { slots, pages: [], vars: { dt: "", hd: "" } } };
const ex: PlanVersion = {
  id: "e", customer_id: "c", type: "exercise", start_date: "2026-11-21", cycle_len: 2, created_at: 2,
  body: { days: [{ title: "a", ic: "low", items: [{ sets: 3, reps: "", rest: "" }, { sets: 3, reps: "", rest: "" }] }, { rest: true }], pages: [], vars: { dt: "", hd: "" } },
};

test("slotDone and dayMealPct", () => {
  assert.equal(slotDone({ "m:wa": [4, 1] }, slots[1]), 0.5);
  assert.equal(slotDone({ "m:wa": [10, 1] }, slots[1]), 1);
  assert.equal(slotDone({ "m:bf": [1, 1] }, slots[0]), 1);
  assert.equal(dayMealPct({ "m:bf": [1, 1], "m:wa": [4, 1] }, slots), 0.75);
  assert.equal(dayMealPct({}, []), 0);
});
test("exDayFor and workoutDone", () => {
  const d = exDayFor([meal, ex], "2026-11-23")!; // day 1 of 2
  assert.ok(!d.rest);
  assert.equal(exDayFor([meal, ex], "2026-11-22")!.rest, true);
  assert.equal(exDayFor([meal], "2026-11-22"), null);
  assert.equal(workoutDone({ "x:0": [1, 1] }, d), false);
  assert.equal(workoutDone({ "x:0": [1, 1], "x:1": [1, 1] }, d), true);
  assert.equal(workoutDone({}, { rest: true }), false);
});
test("tickedOn, countsForStreak", () => {
  assert.equal(tickedOn({ "m:bf": [0, 1] }), false);
  assert.equal(tickedOn({ "m:bf": [0, 1], "kg:0": [5, 1] }), true);
  assert.equal(countsForStreak("2026-11-20", at("2026-11-21", 23)), true);
  assert.equal(countsForStreak("2026-11-20", at("2026-11-22", 0)), false);
});
test("streak: late ticks do not count", () => {
  const tick = (date: string, made = date): DayLog => ({ date, body: { "m:bf": [1, at(made)] } });
  const logs = [tick("2026-11-18"), tick("2026-11-19"), tick("2026-11-20", "2026-11-23"), tick("2026-11-21"), tick("2026-11-22"), tick("2026-11-23", "2026-11-24"), tick("2026-11-24")];
  assert.deepEqual(streak(logs, "2026-11-24"), { cur: 4, best: 4 });
  assert.deepEqual(streak(logs, "2026-11-25"), { cur: 4, best: 4 }); // nothing today yet: counts from yesterday
  assert.deepEqual(streak(logs, "2026-11-26"), { cur: 0, best: 4 });
  assert.deepEqual(streak([], "2026-11-26"), { cur: 0, best: 0 });
});
test("weekStats and lastTickDate", () => {
  const logs: DayLog[] = [
    { date: "2026-11-21", body: { "m:bf": [1, 1], "m:wa": [8, 1] } },
    { date: "2026-11-23", body: { "m:bf": [1, 1], "x:0": [1, 1], "x:1": [1, 1] } },
    { date: "2026-11-20", body: { "m:bf": [1, 1] } },
  ];
  const w = weekStats([meal, ex], logs, "2026-11-25"); // Sat 21 .. Wed 25
  assert.ok(Math.abs(w.mealPct - 1.5 / 5) < 1e-9);
  assert.equal(w.workoutsPlanned, 3); // 21, 23, 25
  assert.equal(w.workoutsDone, 1);
  assert.equal(lastTickDate(logs), "2026-11-23");
  assert.equal(lastTickDate([]), null);
});
