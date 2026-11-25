// Meal plan data: cycle length and slots (fixed, choose, rotation, counter).
import type { MealBody, Slot } from "../../shared/types";
import { ConfirmButton, Field } from "../ui";
import { CardsEditor, TOKEN_HINT, Tools, edit, move, uid } from "./Builder";

const KIND: Record<Slot["kind"], string> = { fixed: "ثابتة كل يوم", choose: "اختيار من بطاقات", rotation: "وجبة لكل يوم", counter: "عداد (مثل الماء)" };

const fit = (a: string[] | undefined, n: number) => Array.from({ length: n }, (_, i) => a?.[i] ?? "");

export function SlotEditor(p: { body: MealBody; cycle_len: number; onChange: (b: MealBody) => void; onCycle: (n: number) => void }) {
  const up = (fn: (b: MealBody) => void) => p.onChange(edit(p.body, fn));
  const setCycle = (n: number) => {
    n = Math.max(1, Math.min(60, Math.round(n) || 7));
    p.onCycle(n);
    up((b) => { b.slots.forEach((s) => { if (s.kind === "rotation") s.items = fit(s.items, n); }); });
  };
  const setKind = (i: number, k: Slot["kind"]) => up((b) => {
    const s = b.slots[i];
    s.kind = k;
    if (k === "choose" && !s.options) s.options = [];
    if (k === "rotation") s.items = fit(s.items, p.cycle_len);
    if (k === "counter" && !s.target) s.target = 8;
    if (k === "fixed" && s.text == null) s.text = "";
  });
  return (
    <div class="stack">
      <div class="card">
        <Field label="طول الدورة (أيام)"><input type="number" inputMode="numeric" min={1} max={60} value={p.cycle_len} onChange={(e) => setCycle(+e.currentTarget.value)} /></Field>
        <p class="note">الخطة تتكرر كل هذا العدد من الأيام، ووجبات الأيام تتبعه. {TOKEN_HINT}</p>
      </div>
      {p.body.slots.map((s, i) => (
        <details class="slot" key={s.id}>
          <summary><span>{s.icon}</span><span class="grow">{s.name || "بدون اسم"}</span><small>{KIND[s.kind]}</small></summary>
          <div class="stack">
            <div class="row">
              <Tools onUp={() => up((b) => move(b.slots, i, -1))} onDown={() => up((b) => move(b.slots, i, 1))} />
              <span class="grow" />
              <ConfirmButton class="btn r sm" label="حذف الخانة" confirm="اضغطي مرة ثانية للحذف" onConfirm={() => up((b) => { b.slots.splice(i, 1); })} />
            </div>
            <div class="g2">
              <Field label="الاسم"><input value={s.name} onInput={(e) => up((b) => { b.slots[i].name = e.currentTarget.value; })} /></Field>
              <Field label="الأيقونة"><input value={s.icon} onInput={(e) => up((b) => { b.slots[i].icon = e.currentTarget.value; })} /></Field>
            </div>
            <Field label="النوع"><select value={s.kind} onChange={(e) => setKind(i, e.currentTarget.value as Slot["kind"])}>
              {(Object.keys(KIND) as Slot["kind"][]).map((k) => <option value={k}>{KIND[k]}</option>)}
            </select></Field>
            {s.kind === "fixed" && <Field label="النص اليومي"><textarea value={s.text ?? ""} onInput={(e) => up((b) => { b.slots[i].text = e.currentTarget.value; })} /></Field>}
            {s.kind === "counter" && <Field label="العدد المطلوب يوميا"><input type="number" inputMode="numeric" min={1} max={30} value={s.target ?? 8} onInput={(e) => up((b) => { b.slots[i].target = Math.max(1, +e.currentTarget.value || 1); })} /></Field>}
            {s.kind === "choose" && <CardsEditor items={s.options ?? []} onChange={(v) => up((b) => { b.slots[i].options = v; })} />}
            {s.kind === "rotation" && fit(s.items, p.cycle_len).map((t, d) => (
              <Field label={`اليوم ${d + 1}`}><textarea rows={2} value={t} onInput={(e) => up((b) => { const it = fit(b.slots[i].items, p.cycle_len); it[d] = e.currentTarget.value; b.slots[i].items = it; })} /></Field>
            ))}
          </div>
        </details>
      ))}
      <button type="button" class="btn g" onClick={() => up((b) => { b.slots.push({ id: uid(), name: "خانة جديدة", icon: "🍽️", kind: "fixed", text: "" }); })}>+ خانة</button>
      <p class="note">الخانات هي ما تعلمه الزبونة كل يوم في التطبيق. حذف خانة يخفيها من الأيام القادمة.</p>
    </div>
  );
}
