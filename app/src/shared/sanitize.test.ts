import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitize } from "./sanitize.ts";

test("keeps allowed tags, drops attributes", () => {
  assert.equal(sanitize('<b onclick="x()">a</b><br/><ul><li class="z">1</li></ul>'), "<b>a</b><br><ul><li>1</li></ul>");
  assert.equal(sanitize('<p style="color:red">x</p><div id=a>y</div>'), "<p>x</p><div>y</div>");
});
test("script tags are stripped, text escaped", () => {
  assert.equal(sanitize("<script>alert(1)</script>ok"), "alert(1)ok");
  assert.equal(sanitize("<SCRIPT src=//x></SCRIPT>"), "");
});
test("event attributes on images are gone", () => {
  assert.equal(sanitize('<img src=x onerror="alert(1)">hi'), "hi");
  assert.equal(sanitize('<b onmouseover=alert(1)>t</b>'), "<b>t</b>");
});
test("span keeps only class acc", () => {
  assert.equal(sanitize('<span class="acc" style="x:y">a</span>'), '<span class="acc">a</span>');
  assert.equal(sanitize("<span class='acc'>a</span>"), '<span class="acc">a</span>');
  assert.equal(sanitize('<span class="acc2" onclick=x>a</span>'), "<span>a</span>");
});
test("escapes stray markup, keeps entities and tokens, idempotent", () => {
  assert.equal(sanitize('a < b & "c" > d'), "a &lt; b &amp; &quot;c&quot; &gt; d");
  assert.equal(sanitize("x&nbsp;y &amp; {3|pc} بيض"), "x&nbsp;y &amp; {3|pc} بيض");
  assert.equal(sanitize("<!-- <b>x</b> -->"), "&lt;!-- <b>x</b> --&gt;");
  const s = '<span class="acc">a</span> <i>b</i> & <x>';
  assert.equal(sanitize(sanitize(s)), sanitize(s));
});
test("tag smuggled inside attribute quotes cannot open a tag", () => {
  assert.equal(sanitize('<b title="<script>">x</b>'), "<b>&quot;&gt;x</b>");
});
