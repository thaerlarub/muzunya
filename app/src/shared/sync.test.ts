import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeDay, applyTick, versionStamp } from "./sync.ts";
import type { DayBody } from "./types.ts";

test("mergeDay: later time wins in both orders", () => {
  const a: DayBody = { "m:bf": [1, 100], "m:wa": [3, 50], "x:0": [1, 10] };
  const b: DayBody = { "m:bf": [0, 200], "m:wa": [5, 40], "m:lu": [1, 60] };
  const want = { "m:bf": [0, 200], "m:wa": [3, 50], "x:0": [1, 10], "m:lu": [1, 60] };
  assert.deepEqual(mergeDay(a, b), want);
  assert.deepEqual(mergeDay(b, a), want);
});
test("applyTick ignores an older change and does not mutate", () => {
  const body: DayBody = { "m:bf": [1, 100] };
  assert.deepEqual(applyTick(body, "m:bf", 0, 90), body);
  assert.deepEqual(applyTick(body, "m:bf", 0, 110), { "m:bf": [0, 110] });
  assert.deepEqual(body, { "m:bf": [1, 100] });
});

test("versionStamp changes when a version is added", () => {
  const a = [{ created_at: 5 }, { created_at: 9 }];
  assert.equal(versionStamp(a), versionStamp([...a]));
  assert.notEqual(versionStamp(a), versionStamp([...a, { created_at: 7 }]));
  assert.equal(versionStamp([]), "0:0");
});
