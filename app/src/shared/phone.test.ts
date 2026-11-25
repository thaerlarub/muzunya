import { test } from "node:test";
import assert from "node:assert/strict";
import { normPhone } from "./phone.ts";

test("normPhone", () => {
  for (const s of ["9123 4567", "0096891234567", "+968 9123-4567", "96891234567", "(968) 9123.4567", "٩١٢٣٤٥٦٧"]) assert.equal(normPhone(s), "+96891234567", s);
  assert.equal(normPhone("+966 50 123 4567"), "+966501234567");
  assert.equal(normPhone("abc"), null);
  assert.equal(normPhone("123"), null);
});
