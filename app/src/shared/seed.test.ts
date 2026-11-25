import { test } from "node:test";
import assert from "node:assert/strict";
import { seedExercises, seedRecipes, defaultMealSlots, MEAL_DATA } from "./seed.ts";

test("seed counts", () => {
  const ex = seedExercises();
  assert.equal(ex.length, 26);
  assert.deepEqual(ex.find((e) => e.id === "gb")!.places, ["home"]);
  assert.deepEqual(ex.find((e) => e.id === "sp")!.places, ["home", "gym"]);
  const r = seedRecipes();
  assert.equal(r.length, 17); // the source file has 17 recipes (6 m, 3 b, 5 l, 3 n)
  assert.equal(r[0].id, "r1");
  const s = defaultMealSlots();
  assert.deepEqual(s.map((x) => x.id), ["bf", "s1", "lu", "s2", "di", "mz", "wa"]);
  assert.equal(s[0].options!.length, 6);
  assert.equal(s[1].options!.length, 10);
  assert.equal(s[2].items!.length, 7);
  assert.equal(MEAL_DATA.shop.length, 2);
});
