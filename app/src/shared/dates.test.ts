import { test } from "node:test";
import assert from "node:assert/strict";
import { muscatDate, addDays, diffDays, weekStart, activeVersion, planDay, canTick } from "./dates.ts";
import type { PlanVersion } from "./types.ts";

test("muscatDate is UTC+4", () => {
  assert.equal(muscatDate(Date.parse("2026-11-24T19:59:00Z")), "2026-11-24");
  assert.equal(muscatDate(Date.parse("2026-11-24T20:00:00Z")), "2026-11-25");
});
test("addDays, diffDays, weekStart", () => {
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(diffDays("2026-12-01", "2026-11-25"), 6);
  assert.equal(weekStart("2026-11-25"), "2026-11-21"); // Wednesday -> Saturday
  assert.equal(weekStart("2026-11-21"), "2026-11-21");
  assert.equal(weekStart("2026-11-27"), "2026-11-21"); // Friday
});
test("activeVersion picks latest start, ties by created_at", () => {
  const vs = [{ start_date: "2026-11-01", created_at: 1 }, { start_date: "2026-11-10", created_at: 2 }, { start_date: "2026-11-10", created_at: 5 }, { start_date: "2026-12-01", created_at: 9 }];
  assert.equal(activeVersion(vs, "2026-11-15")?.created_at, 5);
  assert.equal(activeVersion(vs, "2026-11-05")?.created_at, 1);
  assert.equal(activeVersion(vs, "2026-10-01"), null);
});
test("planDay", () => {
  assert.equal(planDay({ start_date: "2026-11-20", cycle_len: 7 }, "2026-11-27"), 1);
  assert.equal(planDay({ start_date: "2026-11-20", cycle_len: 7 }, "2026-11-21"), 2);
  assert.equal(planDay({ start_date: "2026-11-20", cycle_len: 7 }, "2026-11-19"), 7);
});
test("canTick", () => {
  const v = (type: "meal" | "exercise", start_date: string, created_at: number) => ({ id: "v" + created_at, customer_id: "c", type, start_date, cycle_len: 7, body: {} as any, created_at }) as PlanVersion;
  const vs = [v("meal", "2026-11-01", 1), v("meal", "2026-11-20", 2), v("exercise", "2026-11-10", 3)];
  const today = "2026-11-25";
  assert.equal(canTick(vs, "m:bf", "2026-11-22", today), true);
  assert.equal(canTick(vs, "m:bf", "2026-11-19", today), false); // older version
  assert.equal(canTick(vs, "m:bf", "2026-11-26", today), false); // future
  assert.equal(canTick(vs, "x:0", "2026-11-12", today), true);
  assert.equal(canTick(vs, "kg:0", "2026-11-09", today), false);
  assert.equal(canTick([vs[0]], "x:0", today, today), false); // no exercise version
});
