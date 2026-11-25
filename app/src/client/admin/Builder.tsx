// Free page builder: page list, block list and forms on one side, live A4 preview on the other.
import "./builder.css";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Block, Card, MealBody, Page, PlanBody, PlanCtx, PlanType } from "../../shared/types";
import { setManual } from "../../shared/portions";
import { sanitize } from "../../shared/sanitize";
import { MEAL_DATA } from "../../shared/seed";
import { defaultExPages, defaultMealPages } from "../../shared/templates";
import { todayMuscat } from "../../shared/dates";
import { ConfirmButton, Field, toast } from "../ui";
import { uploadPhoto } from "../photo";
import { BLOCK_LABEL } from "../pages/blocks";
import { Fit, PlanPages } from "../pages/PlanPages";

// ---------- small helpers shared by the plan editors ----------
export const edit = <T,>(x: T, fn: (c: T) => void): T => { const c = structuredClone(x); fn(c); return c; };
export const uid = () => Math.random().toString(36).slice(2, 10);
export function move<T>(a: T[], i: number, d: number) { const j = i + d; if (j >= 0 && j < a.length) [a[i], a[j]] = [a[j], a[i]]; }
/** Apply fn to the string at a dotted path like `slots.0.options.2.lines.1`. */
export function setAt(obj: unknown, path: string, fn: (s: string) => string) {
  const k = path.split(".");
  let o: any = obj;
  for (const x of k.slice(0, -1)) { o = o?.[x]; if (o == null) return; }
  const last = k[k.length - 1];
  if (typeof o[last] === "string") o[last] = fn(o[last]);
}
/** Every string in a plan body through fn (used for "recalculate portions"). */
export function mapStrings<T>(x: T, fn: (s: string) => string): T {
  if (typeof x === "string") return fn(x) as T;
  if (Array.isArray(x)) return x.map((v) => mapStrings(v, fn)) as T;
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, mapStrings(v, fn)])) as T;
  return x;
}
const plain = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\{([\d.]+)\|\w+(?:\|([^}]*))?\}/g, (_m, b, m) => m ?? b).replace(/\s+/g, " ").trim();

export const TOKEN_HINT = "الأرقام بين الأقواس مثل {3|pc} تتغير حسب سعرات الزبونة. اكتبي رقما عاديا إذا أردتِ كمية ثابتة.";

// ---------- inputs ----------
/** Small rich-text editor: bold, accent colour, bullet list. Output always goes through sanitize. */
export function RichText(p: { value: string; onChange: (v: string) => void; label?: string }) {
  const r = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = r.current, v = sanitize(p.value); if (el && document.activeElement !== el && el.innerHTML !== v) el.innerHTML = v; }, [p.value]);
  const out = () => p.onChange(sanitize(r.current!.innerHTML));
  const cmd = (c: string, v?: string) => { r.current!.focus(); document.execCommand(c, false, v); out(); };
  const acc = () => {
    const s = getSelection(), el = r.current!;
    if (!s || s.isCollapsed || !el.contains(s.anchorNode)) { toast("حددي النص أولا"); return; }
    const rg = s.getRangeAt(0), sp = document.createElement("span");
    sp.className = "acc"; sp.appendChild(rg.extractContents()); rg.insertNode(sp); s.removeAllRanges();
    out();
  };
  const keep = (e: Event) => e.preventDefault();
  return (
    <div class="rt">
      {p.label && <span class="note">{p.label}</span>}
      <div class="rtb">
        <button type="button" class="ib" onMouseDown={keep} onClick={() => cmd("bold")} aria-label="خط عريض"><b>ع</b></button>
        <button type="button" class="ib acc" onMouseDown={keep} onClick={acc} aria-label="لون مميز">لون</button>
        <button type="button" class="ib" onMouseDown={keep} onClick={() => cmd("insertUnorderedList")} aria-label="قائمة نقاط">• قائمة</button>
      </div>
      <div ref={r} class="rte" contentEditable onInput={out} />
    </div>
  );
}

export function Lines(p: { value: string[]; onChange: (v: string[]) => void; rows?: number }) {
  return <textarea rows={p.rows ?? Math.max(3, p.value.length + 1)} value={p.value.join("\n")} onInput={(e) => p.onChange(e.currentTarget.value.split("\n"))} />;
}

/** Row tools: move up, move down, delete. */
export function Tools(p: { onUp: () => void; onDown: () => void; onDel?: () => void }) {
  return <span class="tools">
    <button type="button" class="ib" onClick={p.onUp} aria-label="لأعلى">↑</button>
    <button type="button" class="ib" onClick={p.onDown} aria-label="لأسفل">↓</button>
    {p.onDel && <button type="button" class="ib del" onClick={p.onDel} aria-label="حذف">×</button>}
  </span>;
}

/** Cards (icon, lines, note, tag), used for card blocks and choose slots. */
export function CardsEditor(p: { items: Card[]; onChange: (c: Card[]) => void }) {
  const up = (fn: (c: Card[]) => void) => p.onChange(edit(p.items, fn));
  return (
    <div class="stack">
      {p.items.map((c, j) => (
        <div class="sub-card" key={j}>
          <div class="row"><b class="grow">بطاقة {j + 1}</b><Tools onUp={() => up((a) => move(a, j, -1))} onDown={() => up((a) => move(a, j, 1))} onDel={() => up((a) => { a.splice(j, 1); })} /></div>
          <div class="g2">
            <Field label="الأيقونة"><input value={c.icon} onInput={(e) => up((a) => { a[j].icon = e.currentTarget.value; })} /></Field>
            <Field label="شارة (اختياري)"><input value={c.tag ?? ""} onInput={(e) => up((a) => { a[j].tag = e.currentTarget.value || undefined; })} /></Field>
          </div>
          <Field label="الأسطر (سطر لكل بند)"><Lines value={c.lines} onChange={(v) => up((a) => { a[j].lines = v; })} /></Field>
          <Field label="ملاحظة (اختياري)"><input value={c.note ?? ""} onInput={(e) => up((a) => { a[j].note = e.currentTarget.value || undefined; })} /></Field>
        </div>
      ))}
      <button type="button" class="btn g" onClick={() => up((a) => { a.push({ icon: "⭐", lines: ["سطر جديد"] }); })}>+ بطاقة</button>
    </div>
  );
}

// ---------- blocks ----------
const NEW: Record<Block["t"], (b: PlanBody) => Block> = {
  bar: () => ({ t: "bar", text: "عنوان" }),
  sub: () => ({ t: "sub", text: "عنوان فرعي" }),
  text: () => ({ t: "text", html: "<p>نص جديد</p>" }),
  table: () => ({ t: "table", head: ["العمود 1", "العمود 2"], rows: [["", ""]] }),
  image: () => ({ t: "image", src: "product", h: 60 }),
  spacer: () => ({ t: "spacer", h: 10 }),
  divider: () => ({ t: "divider" }),
  cols: () => ({ t: "cols", a: "<p>عنوان</p><ul><li>بند</li></ul>", b: "<p>عنوان</p><ul><li>بند</li></ul>" }),
  points: () => ({ t: "points", items: [{ badge: "نقطة", html: "نص النقطة" }] }),
  cards: () => ({ t: "cards", style: "cards", items: [{ icon: "⭐", lines: ["سطر"] }] }),
  slotCards: (b) => ({ t: "slotCards", slot: (b as MealBody).slots?.find((s) => s.kind === "choose")?.id ?? "", style: "cards" }),
  rotation: (b) => ({ t: "rotation", slots: ((b as MealBody).slots ?? []).filter((s) => s.kind === "rotation").map((s) => s.id) }),
  dose: () => ({ t: "dose" }),
  mzWeek: () => ({ t: "mzWeek", rows: [...MEAL_DATA.mzWeek] }),
  customer: () => ({ t: "customer" }),
  tracker: () => ({ t: "tracker" }),
  signoff: () => ({ t: "signoff" }),
  exWeek: () => ({ t: "exWeek" }),
  exDays: () => ({ t: "exDays" }),
  exLog: () => ({ t: "exLog" }),
};
const ONLY: Partial<Record<Block["t"], PlanType>> = { slotCards: "meal", rotation: "meal", exWeek: "exercise", exDays: "exercise", exLog: "exercise" };

function snippet(b: Block): string {
  const s = b.t === "bar" || b.t === "sub" ? b.text : b.t === "text" ? b.html : b.t === "cols" ? b.a : b.t === "table" ? (b.head[0] ?? b.rows[0]?.[0] ?? "") : "";
  const t = plain(s);
  return t.length > 30 ? t.slice(0, 30) + "..." : t;
}

function BlockForm(p: { b: Block; body: PlanBody; ctx: PlanCtx; on: (fn: (x: any) => void) => void }) {
  const { b, on } = p;
  const set = (k: string, v: unknown) => on((x) => { x[k] = v; });
  const slots = (p.body as MealBody).slots ?? [];
  switch (b.t) {
    case "bar": return <>
      <Field label="العنوان"><input value={b.text} onInput={(e) => set("text", e.currentTarget.value)} /></Field>
      <Field label="سطر صغير (اختياري)"><input value={b.small ?? ""} onInput={(e) => set("small", e.currentTarget.value || undefined)} /></Field>
    </>;
    case "sub": return <Field label="النص"><input value={b.text} onInput={(e) => set("text", e.currentTarget.value)} /></Field>;
    case "text": return <><RichText value={b.html} onChange={(v) => set("html", v)} /><p class="note">{TOKEN_HINT}</p></>;
    case "cols": return <div class="g2">
      <RichText label="العمود الأيمن" value={b.a} onChange={(v) => set("a", v)} />
      <RichText label="العمود الأيسر" value={b.b} onChange={(v) => set("b", v)} />
    </div>;
    case "table": {
      const n = Math.max(b.head.length, ...b.rows.map((r) => r.length), 1);
      const cols = `repeat(${n}, minmax(110px, 1fr)) 44px`;
      return <>
        <div class="row">
          <label class="ck"><input type="checkbox" checked={b.head.length > 0} onChange={(e) => set("head", e.currentTarget.checked ? Array(n).fill("") : [])} /> صف عناوين</label>
          <label class="ck"><input type="checkbox" checked={!!b.check} onChange={(e) => set("check", e.currentTarget.checked || undefined)} /> عمود علامة صح</label>
        </div>
        <div class="scroll"><div class="tbed" style={{ gridTemplateColumns: cols }}>
          {Array.from({ length: n }, (_, j) => <button type="button" class="ib del" aria-label={`حذف العمود ${j + 1}`} onClick={() => on((x) => { if (x.head.length) x.head.splice(j, 1); x.rows.forEach((r: string[]) => r.splice(j, 1)); })}>× عمود</button>)}<span />
          {b.head.length > 0 && <>{b.head.map((h, j) => <input class="th" value={h} onInput={(e) => on((x) => { x.head[j] = e.currentTarget.value; })} />)}<span /></>}
          {b.rows.map((r, i) => <>
            {Array.from({ length: n }, (_, j) => <input value={r[j] ?? ""} onInput={(e) => on((x) => { x.rows[i][j] = e.currentTarget.value; })} />)}
            <button type="button" class="ib del" aria-label={`حذف الصف ${i + 1}`} onClick={() => on((x) => { x.rows.splice(i, 1); })}>×</button>
          </>)}
        </div></div>
        <div class="row">
          <button type="button" class="btn g sm" onClick={() => on((x) => { x.rows.push(Array(n).fill("")); })}>+ صف</button>
          <button type="button" class="btn g sm" onClick={() => on((x) => { if (x.head.length) x.head.push(""); x.rows.forEach((r: string[]) => { while (r.length < n) r.push(""); r.push(""); }); })}>+ عمود</button>
        </div>
        <p class="note">{TOKEN_HINT}</p>
      </>;
    }
    case "image": {
      const real = p.ctx.customer.user_id !== "sample";
      const pick = async (f?: File) => {
        if (!f) return;
        try { const ph = await uploadPhoto({ file: f, date: todayMuscat(), caption: "", customer_id: p.ctx.customer.user_id }); set("src", ph.id); }
        catch (e) { toast(e instanceof Error && e.message.includes("اتصال") ? e.message : "تعذر رفع الصورة"); }
      };
      return <>
        <div class="row">
          <label class="ck"><input type="radio" checked={b.src === "product"} onChange={() => set("src", "product")} /> صورة المنتج</label>
          {real && <label class="btn g sm">رفع صورة<input type="file" accept="image/*" hidden onChange={(e) => pick(e.currentTarget.files?.[0])} /></label>}
        </div>
        {!real && <p class="note">رفع الصور متاح داخل خطة الزبونة فقط.</p>}
        <Field label="الارتفاع (مم)"><input type="number" inputMode="numeric" min={10} max={250} value={b.h ?? 60} onInput={(e) => set("h", +e.currentTarget.value || 60)} /></Field>
      </>;
    }
    case "spacer": return <Field label="الارتفاع (مم)"><input type="number" inputMode="numeric" min={1} max={200} value={b.h} onInput={(e) => set("h", +e.currentTarget.value || 0)} /></Field>;
    case "points": return <div class="stack">
      {b.items.map((it, j) => <div class="sub-card">
        <div class="row"><Field label="الشارة"><input value={it.badge} onInput={(e) => on((x) => { x.items[j].badge = e.currentTarget.value; })} /></Field>
          <Tools onUp={() => on((x) => move(x.items, j, -1))} onDown={() => on((x) => move(x.items, j, 1))} onDel={() => on((x) => { x.items.splice(j, 1); })} /></div>
        <RichText value={it.html} onChange={(v) => on((x) => { x.items[j].html = v; })} />
      </div>)}
      <button type="button" class="btn g" onClick={() => on((x) => { x.items.push({ badge: "نقطة", html: "نص النقطة" }); })}>+ نقطة</button>
    </div>;
    case "cards": return <>
      <Field label="الشكل"><select value={b.style} onChange={(e) => set("style", e.currentTarget.value)}><option value="cards">بطاقات كبيرة</option><option value="tiles">أيقونات صغيرة</option><option value="ways">طرق التحضير</option></select></Field>
      <CardsEditor items={b.items} onChange={(v) => set("items", v)} />
    </>;
    case "slotCards": return <>
      <Field label="الخانة"><select value={b.slot} onChange={(e) => set("slot", e.currentTarget.value)}>
        <option value="">اختاري خانة</option>
        {slots.filter((s) => s.kind === "choose").map((s) => <option value={s.id}>{s.name}</option>)}
      </select></Field>
      <Field label="الشكل"><select value={b.style} onChange={(e) => set("style", e.currentTarget.value)}><option value="cards">بطاقات كبيرة</option><option value="tiles">أيقونات صغيرة</option></select></Field>
      <p class="note">تعديل البطاقات نفسها من تبويب البيانات.</p>
    </>;
    case "rotation": return <>
      {slots.filter((s) => s.kind === "rotation").map((s) => <label class="ck"><input type="checkbox" checked={b.slots.includes(s.id)}
        onChange={(e) => on((x) => { x.slots = e.currentTarget.checked ? slots.filter((y) => y.id === s.id || x.slots.includes(y.id)).map((y) => y.id) : x.slots.filter((y: string) => y !== s.id); })} /> {s.name}</label>)}
      <p class="note">الجدول يأخذ 7 أيام في كل صفحة، والوجبات نفسها تعدل من تبويب البيانات.</p>
    </>;
    case "mzWeek": return <Field label="طريقة التناول لكل يوم (سطر لكل يوم)"><Lines value={b.rows} onChange={(v) => set("rows", v)} /></Field>;
    default: return <p class="note">هذا العنصر يأخذ بياناته من الخطة تلقائيا.</p>;
  }
}

// ---------- builder ----------
export function Builder(p: { type: PlanType; body: PlanBody; cycle_len: number; ctx: PlanCtx; onChange: (body: PlanBody) => void }) {
  const [sel, setSel] = useState<[number, number | null]>([0, null]);
  const [over, setOver] = useState<number[]>([]);
  const [add, setAdd] = useState<Block["t"]>("text");
  const prev = useRef<HTMLDivElement>(null);
  const pages = p.body.pages;
  const pi = Math.max(0, Math.min(sel[0], pages.length - 1));
  const pg: Page | undefined = pages[pi];
  const bi = pg && sel[1] != null && sel[1] < pg.blocks.length ? sel[1] : null;
  const up = (fn: (b: PlanBody) => void) => p.onChange(edit(p.body, fn));
  const onB = (fn: (x: any) => void) => up((b) => fn(b.pages[pi].blocks[bi!]));

  const wide = () => matchMedia("(min-width: 900px)").matches;
  const scroll = (el: Element | null | undefined) => el?.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  const goPage = (i: number) => {
    setSel([i, null]);
    if (wide()) requestAnimationFrame(() => scroll(prev.current?.querySelector(`.page[data-p="${i}"]`)));
  };
  const insertPage = (np: Page, at: number) => { up((b) => { b.pages.splice(at, 0, np); }); setSel([at, null]); };
  const cover = () => {
    const c = (p.type === "meal" ? defaultMealPages() : defaultExPages())[0];
    insertPage({ ...c, id: uid() }, 0);
  };
  const moveLast = (i: number) => {
    up((b) => { const blk = b.pages[i].blocks.pop(); if (blk) b.pages.splice(i + 1, 0, { id: uid(), blocks: [blk] }); });
    setSel([i + 1, 0]);
  };
  const palette = (Object.keys(BLOCK_LABEL) as Block["t"][]).filter((t) => !ONLY[t] || ONLY[t] === p.type);

  return (
    <div class="bld">
      <div class="bpanel">
        <details class="card">
          <summary>بيانات عامة للخطة</summary>
          <div class="stack">
            <Field label="اسم الأخصائية"><input value={p.body.vars?.dt ?? ""} onInput={(e) => up((b) => { b.vars = { ...b.vars, dt: e.currentTarget.value }; })} /></Field>
            <Field label="نص التذييل"><input value={p.body.vars?.hd ?? ""} onInput={(e) => up((b) => { b.vars = { ...b.vars, hd: e.currentTarget.value }; })} /></Field>
            {p.type === "meal" && <Field label="عنوان الغلاف"><input value={p.body.vars?.title ?? ""} onInput={(e) => up((b) => { b.vars = { ...b.vars, title: e.currentTarget.value || undefined }; })} /></Field>}
          </div>
        </details>

        <div class="card">
          <h3>الصفحات</h3>
          <div class="bpages">
            {pages.map((x, i) => <button type="button" class={"bpg" + (i === pi ? " on" : "")} aria-pressed={i === pi} onClick={() => goPage(i)}>
              {i + 1}{x.cover || x.solid ? " غلاف" : ""}{over.includes(i) ? " !" : ""}
            </button>)}
          </div>
          <div class="row">
            <button type="button" class="btn g sm" onClick={() => insertPage({ id: uid(), blocks: [] }, pages.length ? pi + 1 : 0)}>+ صفحة</button>
            <button type="button" class="btn g sm" onClick={cover}>+ غلاف</button>
            {pg && <>
              <button type="button" class="btn g sm" onClick={() => insertPage({ ...structuredClone(pg), id: uid() }, pi + 1)}>تكرار</button>
              <button type="button" class="btn g sm" aria-label="تقديم الصفحة" onClick={() => { up((b) => move(b.pages, pi, -1)); setSel([Math.max(0, pi - 1), null]); }}>↑ تقديم</button>
              <button type="button" class="btn g sm" aria-label="تأخير الصفحة" onClick={() => { up((b) => move(b.pages, pi, 1)); setSel([Math.min(pages.length - 1, pi + 1), null]); }}>↓ تأخير</button>
              <ConfirmButton class="btn r sm" label="حذف الصفحة" confirm="اضغطي مرة ثانية للحذف" onConfirm={() => { up((b) => { b.pages.splice(pi, 1); }); setSel([Math.max(0, pi - 1), null]); }} />
            </>}
          </div>
        </div>

        {pg && <div class="card">
          <h3>عناصر الصفحة {pi + 1}</h3>
          {pg.blocks.length === 0 && <p class="note">الصفحة فارغة، أضيفي عنصرا من القائمة.</p>}
          <ul class="blist">
            {pg.blocks.map((b, j) => <li class={j === bi ? "on" : ""}>
              <button type="button" class="bname" onClick={() => setSel([pi, j === bi ? null : j])} aria-expanded={j === bi}>{BLOCK_LABEL[b.t]}<small>{snippet(b)}</small></button>
              <Tools onUp={() => { up((x) => move(x.pages[pi].blocks, j, -1)); setSel([pi, Math.max(0, j - 1)]); }}
                onDown={() => { up((x) => move(x.pages[pi].blocks, j, 1)); setSel([pi, Math.min(pg.blocks.length - 1, j + 1)]); }}
                onDel={() => { up((x) => { x.pages[pi].blocks.splice(j, 1); }); setSel([pi, null]); }} />
            </li>)}
          </ul>
          <div class="row">
            <select class="grow" value={add} onChange={(e) => setAdd(e.currentTarget.value as Block["t"])} aria-label="نوع العنصر">
              {palette.map((t) => <option value={t}>{BLOCK_LABEL[t]}</option>)}
            </select>
            <button type="button" class="btn" onClick={() => { const at = bi != null ? bi + 1 : pg.blocks.length; up((x) => { x.pages[pi].blocks.splice(at, 0, NEW[add](x)); }); setSel([pi, at]); }}>إضافة</button>
          </div>
        </div>}

        {pg && bi != null && <div class="card bform">
          <h3>{BLOCK_LABEL[pg.blocks[bi].t]}</h3>
          <BlockForm key={`${pg.id}:${bi}`} b={pg.blocks[bi]} body={p.body} ctx={p.ctx} on={onB} />
        </div>}
      </div>

      <div class="bprev" ref={prev}>
        {over.map((i) => <div class="bover" role="status">
          <span>الصفحة {i + 1}: المحتوى أطول من الصفحة وسيقص في PDF.</span>
          {pages[i]?.blocks.length > 1 && <button type="button" class="btn sm" onClick={() => moveLast(i)}>نقل آخر عنصر لصفحة جديدة</button>}
        </div>)}
        <p class="note">اضغطي على أي عنصر في المعاينة لتعديله. الأرقام المنقطة تعدل مباشرة، والمعدلة يدويا تظهر بالأصفر.</p>
        <Fit>
          <PlanPages type={p.type} body={p.body} cycle_len={p.cycle_len} ctx={p.ctx} editable selected={bi != null ? [pi, bi] : null}
            onPick={(a, b) => { setSel([a, b]); if (!wide()) requestAnimationFrame(() => scroll(document.querySelector(".bform"))); }} onOverflow={setOver}
            onTokenEdit={(path, i, v) => up((b) => setAt(b, path, (s) => setManual(s, i, v)))} />
        </Fit>
      </div>
    </div>
  );
}
