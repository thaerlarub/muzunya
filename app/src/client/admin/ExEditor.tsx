// Exercise plan data: generator (place, level, days a week) and a day-by-day editor.
import { useEffect, useState } from "preact/hooks";
import type { ExBody, ExDay, ExItem, Exercise } from "../../shared/types";
import { generateExDays, EX } from "../../shared/generator";
import { LEVEL_NAME } from "../../shared/templates";
import { api } from "../api";
import { ConfirmButton, Field } from "../ui";
import { Tools, edit, move } from "./Builder";

type Work = Extract<ExDay, { title: string }>;
const IC: Record<Work["ic"], string> = { low: "الجزء السفلي", up: "الجزء العلوي", full: "الجسم كامل" };
const DN = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع"];
const dayName = (i: number) => "اليوم " + (DN[i] ?? i + 1);

export function ExEditor(p: { body: ExBody; cycle_len: number; onChange: (b: ExBody) => void; onCycle: (n: number) => void }) {
  const [lib, setLib] = useState<Exercise[]>([]);
  const [g, setG] = useState({ place: p.body.place ?? "home", level: p.body.level ?? 0, n: 3 as 3 | 4 });
  useEffect(() => { api.get<Exercise[]>("/api/admin/exercises").then(setLib).catch(() => {}); }, []);
  const up = (fn: (b: ExBody) => void) => p.onChange(edit(p.body, fn));
  const upDay = (i: number, fn: (d: Work) => void) => up((b) => fn(b.days[i] as Work));
  const names = lib.length ? lib : Object.entries(EX).map(([id, [name_ar]]) => ({ id, name_ar }) as Exercise);

  const generate = () => {
    p.onCycle(7);
    up((b) => { b.days = generateExDays(g.place, g.level, g.n); b.place = g.place; b.level = g.level; });
  };
  const setCycle = (n: number) => {
    n = Math.max(1, Math.min(28, Math.round(n) || 7));
    p.onCycle(n);
    up((b) => { b.days = Array.from({ length: n }, (_, i) => b.days[i] ?? { rest: true }); });
  };
  const setItem = (i: number, j: number, fn: (it: ExItem) => void) => upDay(i, (d) => fn(d.items[j]));

  return (
    <div class="stack">
      <div class="card stack">
        <h3>توليد من البرنامج الأساسي</h3>
        <div class="grid">
          <Field label="المكان"><select value={g.place} onChange={(e) => setG({ ...g, place: e.currentTarget.value as "home" | "gym" })}><option value="home">المنزل</option><option value="gym">النادي</option></select></Field>
          <Field label="المستوى"><select value={g.level} onChange={(e) => setG({ ...g, level: +e.currentTarget.value as 0 | 1 | 2 })}>{LEVEL_NAME.map((n, i) => <option value={i}>{n}</option>)}</select></Field>
          <Field label="أيام التمرين بالأسبوع"><select value={g.n} onChange={(e) => setG({ ...g, n: +e.currentTarget.value as 3 | 4 })}><option value={3}>3 أيام</option><option value={4}>4 أيام</option></select></Field>
        </div>
        <ConfirmButton class="btn" label="توليد الأيام" confirm="اضغطي مرة ثانية لاستبدال الأيام الحالية" onConfirm={generate} />
        <p class="note">التوليد يستبدل أيام الدورة فقط، والصفحات تبقى كما هي.</p>
      </div>
      <div class="card">
        <Field label="طول الدورة (أيام)"><input type="number" inputMode="numeric" min={1} max={28} value={p.cycle_len} onChange={(e) => setCycle(+e.currentTarget.value)} /></Field>
      </div>
      {p.body.days.map((d, i) => (
        <details class="exday" key={i}>
          <summary><span class="grow">{dayName(i)}</span><small>{d.rest ? "راحة" : d.title}</small></summary>
          <div class="stack">
            <Field label="نوع اليوم"><select value={d.rest ? "rest" : "work"} onChange={(e) => up((b) => {
              b.days[i] = e.currentTarget.value === "rest" ? { rest: true } : { title: "تمرين جديد", ic: "full", items: [] };
            })}><option value="work">تمرين</option><option value="rest">راحة</option></select></Field>
            {d.rest
              ? <Field label="ملاحظة (اختياري)"><input value={d.note ?? ""} onInput={(e) => up((b) => { b.days[i] = { rest: true, note: e.currentTarget.value || undefined }; })} /></Field>
              : <>
                <div class="g2">
                  <Field label="العنوان"><input value={d.title} onInput={(e) => upDay(i, (x) => { x.title = e.currentTarget.value; })} /></Field>
                  <Field label="الرسمة"><select value={d.ic} onChange={(e) => upDay(i, (x) => { x.ic = e.currentTarget.value as Work["ic"]; })}>
                    {(Object.keys(IC) as Work["ic"][]).map((k) => <option value={k}>{IC[k]}</option>)}
                  </select></Field>
                </div>
                {d.items.map((it, j) => (
                  <div class="sub-card">
                    <div class="row"><b class="grow">التمرين {j + 1}</b>
                      <Tools onUp={() => upDay(i, (x) => move(x.items, j, -1))} onDown={() => upDay(i, (x) => move(x.items, j, 1))} onDel={() => upDay(i, (x) => { x.items.splice(j, 1); })} /></div>
                    <Field label="التمرين"><select value={it.ex ?? ""} onChange={(e) => setItem(i, j, (x) => {
                      const v = e.currentTarget.value;
                      if (v) { x.ex = v; delete x.name; } else { delete x.ex; x.name = x.name ?? ""; }
                    })}>
                      {names.map((e) => <option value={e.id}>{e.name_ar}</option>)}
                      <option value="">اسم خاص</option>
                    </select></Field>
                    {!it.ex && <Field label="اسم التمرين"><input value={it.name ?? ""} onInput={(e) => setItem(i, j, (x) => { x.name = e.currentTarget.value; })} /></Field>}
                    <div class="grid">
                      <Field label="المجموعات"><input type="number" inputMode="numeric" min={1} max={10} value={it.sets} onInput={(e) => setItem(i, j, (x) => { x.sets = Math.max(1, +e.currentTarget.value || 1); })} /></Field>
                      <Field label="التكرار"><input value={it.reps} onInput={(e) => setItem(i, j, (x) => { x.reps = e.currentTarget.value; })} /></Field>
                      <Field label="الراحة"><input value={it.rest} onInput={(e) => setItem(i, j, (x) => { x.rest = e.currentTarget.value; })} /></Field>
                    </div>
                    <Field label="ملاحظة (اختياري)"><input value={it.note ?? ""} onInput={(e) => setItem(i, j, (x) => { x.note = e.currentTarget.value || undefined; })} /></Field>
                  </div>
                ))}
                <button type="button" class="btn g" onClick={() => upDay(i, (x) => {
                  const l = x.items[x.items.length - 1];
                  x.items.push({ ex: names[0]?.id, sets: l?.sets ?? 3, reps: l?.reps ?? "12 إلى 15", rest: l?.rest ?? "60 ث" });
                })}>+ تمرين</button>
              </>}
          </div>
        </details>
      ))}
    </div>
  );
}
