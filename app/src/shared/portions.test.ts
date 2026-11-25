import { test } from "node:test";
import assert from "node:assert/strict";
import { fmt, scale, targets, renderTokens, setManual, clearManual, stripTokens } from "./portions.ts";

test("fmt rounding", () => {
  assert.equal(fmt(47, "g"), 45);
  assert.equal(fmt(183, "g"), 180);
  assert.equal(fmt(30, "ml"), 50);
  assert.equal(fmt(1.3, "hf"), "1½");
  assert.equal(fmt(0.2, "hf"), "½");
  assert.equal(fmt(2, "hf"), 2);
  assert.equal(fmt(0.4, "pc"), 1);
  assert.equal(fmt(2.6, "sp"), 3);
});
test("scale", () => {
  assert.ok(Math.abs(scale(2600, 0) - 1.1818) < 1e-4);
  assert.equal(scale(1500, null), 0.75);
  assert.equal(scale(2300, 100), 1);
});
test("targets", () => {
  // bmr = 490 + 987.5 - 125 - 161 = 1191.5; *1.375 = 1638.3; +400 = 2038.3 -> 2050
  const t = targets({ w: 49, h: 158, act: "1.375", sur: "400", man: null, muzunaKcal: null });
  assert.equal(t.kcal, 2050);
  assert.equal(t.prot, 75);
  assert.ok(Math.abs(t.bmi - 19.63) < 0.01);
  assert.equal(t.lo, 46.2);
  assert.equal(t.hi, 62.2);
  assert.ok(Math.abs(t.f - 2050 / 2200) < 1e-9);
  assert.equal(t.clamped, false);
  const m = targets({ w: 49, h: 158, act: "1.2", sur: "300", man: 4000, muzunaKcal: null });
  assert.equal(m.kcal, 4000);
  assert.equal(m.f, 1.5);
  assert.equal(m.clamped, true);
});
test("tokens", () => {
  const s = "{3|pc} بيض + {250|ml} مل حليب + {20|g|كوب} مكسرات";
  assert.equal(stripTokens(s, 1), "3 بيض + 250 مل حليب + كوب مكسرات");
  assert.equal(stripTokens(s, 1.5), "5 بيض + 375 مل حليب + كوب مكسرات");
  assert.equal(renderTokens(s, 1, (v, i, m) => `[${i}:${v}${m ? "*" : ""}]`), "[0:3] بيض + [1:250] مل حليب + [2:كوب*] مكسرات");
  assert.equal(setManual(s, 1, "كوب كبير"), "{3|pc} بيض + {250|ml|كوب كبير} مل حليب + {20|g|كوب} مكسرات");
  assert.equal(setManual(s, 2, ""), "{3|pc} بيض + {250|ml} مل حليب + {20|g} مكسرات");
  assert.equal(clearManual(s), "{3|pc} بيض + {250|ml} مل حليب + {20|g} مكسرات");
  assert.equal(stripTokens("25 غ مزيونة", 1.5), "25 غ مزيونة");
});
