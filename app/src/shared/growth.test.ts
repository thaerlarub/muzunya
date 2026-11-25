import { test } from "node:test";
import assert from "node:assert/strict";
import { growth } from "./growth.ts";
import type { Customer, Followup } from "./types.ts";

const cust = (o: Partial<Customer> = {}): Customer => ({
  user_id: "c", name: "", phone: "", status: "active", height: 160, w0: 50, start_date: "2026-11-01", track: "gain", goal_w: null,
  act: "1.375", sur: "400", man_kcal: null, mascot: null, wardrobe: {}, allergies: null, journey_finished_at: null, letter: null, ...o,
});
const fu = (weight: number): Followup => ({ id: "f", customer_id: "c", author: "customer", date: "2026-11-15", weight, updated_at: 1 });

test("growth", () => {
  assert.equal(growth(cust({ goal_w: 54 }), [fu(53)]), 0.75);
  assert.equal(growth(cust(), [fu(52.9)]), 2 / 6);
  assert.equal(growth(cust(), [fu(48)]), 0);
  assert.equal(growth(cust(), [fu(60)]), 1);
  assert.equal(growth(cust({ track: "loss" }), [fu(47)]), 0.5);
  assert.equal(growth(cust({ w0: null }), []), 0);
});
