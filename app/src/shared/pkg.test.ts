import { test } from "node:test";
import assert from "node:assert/strict";
import { packageEnd, packageDue, packageDaysLeft } from "./pkg.ts";

test("packageEnd stacks renewals", () => {
  assert.equal(packageEnd([]), null);
  assert.equal(packageEnd([{ order_date: "2026-11-25", months: 2 }, { order_date: "2026-11-01", months: 1 }]), "2027-01-30");
  assert.equal(packageEnd([{ order_date: "2026-11-01", months: 1 }, { order_date: "2026-12-10", months: 1 }]), "2027-01-09");
});
test("packageDue", () => {
  assert.equal(packageDaysLeft("2026-12-01", "2026-11-25"), 6);
  assert.equal(packageDue("2026-12-01", "2026-11-25"), false);
  assert.equal(packageDue("2026-12-01", "2026-11-26"), true);
  assert.equal(packageDue("2026-11-01", "2026-11-26"), true);
  assert.equal(packageDue(null, "2026-11-26"), false);
});
