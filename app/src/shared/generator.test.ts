import { test } from "node:test";
import assert from "node:assert/strict";
import { generateExDays, EX, PLAN } from "./generator.ts";

test("generateExDays home level 0, 3 a week", () => {
  const d = generateExDays("home", 0, 3);
  assert.equal(d.length, 7);
  assert.deepEqual(d.map((x, i) => (x.rest ? -1 : i)).filter((i) => i >= 0), [0, 2, 4]);
  for (const x of d) if (!x.rest) for (const it of x.items) { assert.equal(it.sets, 3); assert.equal(it.reps, EX[it.ex!][2] === "s" ? "30 ث" : "12 إلى 15"); }
  const w0 = d[0];
  assert.ok(!w0.rest && w0.title === PLAN.LA.t && w0.items[0].reps === "12 إلى 15" && w0.items[0].rest === "60 ث");
  assert.deepEqual(d[1], { rest: true });
  assert.deepEqual(d[5], { rest: true, note: "أو مشي خفيف 20 دقيقة" });
  assert.equal(Object.keys(EX).length, 26);
});
test("generateExDays gym level 2, 4 a week", () => {
  const d = generateExDays("gym", 2, 4);
  assert.deepEqual(d.map((x) => (x.rest ? 0 : 1)), [1, 1, 0, 1, 1, 0, 0]);
  const up = d[1];
  assert.ok(!up.rest && up.items.find((i) => i.ex === "pl")!.reps === "60 ث");
});
