// Follow-up: weight and sizes entries, charts. Her entries are editable, admin entries are locked.
import { useState } from "preact/hooks";
import type { Followup as Fu, FollowupInput } from "../../shared/types";
import { todayMuscat } from "../../shared/dates";
import { store, useMe } from "../store";
import { ConfirmButton, Field, Sheet, fmtDate, toast } from "../ui";
import { SizesCompare, WeightChart } from "../charts";

const NUMS: [keyof FollowupInput, string][] = [["weight", "الوزن (كجم)"], ["arm", "الذراع"], ["chest", "الصدر"], ["waist", "الخصر"], ["hips", "الأرداف"], ["thigh", "الفخذ"]];
const hasSize = (f: Fu) => !!(f.arm || f.chest || f.waist || f.hips || f.thigh);

export function Followup() {
  const me = useMe(), c = me.customer;
  const [edit, setEdit] = useState<Fu | "new" | null>(null);
  const list = [...me.followups].sort((a, b) => b.date.localeCompare(a.date) || b.updated_at - a.updated_at);
  const pts = [...(c.w0 ? [{ d: c.start_date, w: c.w0 }] : []), ...list.filter((f) => f.weight).map((f) => ({ d: f.date, w: f.weight! }))];
  const sized = list.filter(hasSize);
  return (
    <div class="stack">
      <button class="btn wide" onClick={() => setEdit("new")}>+ تسجيل متابعة جديدة</button>
      <section class="card"><h3>وزني</h3><WeightChart points={pts} goal={c.goal_w} /></section>
      <section class="card"><h3>مقاساتي</h3><SizesCompare first={sized[sized.length - 1] ?? null} last={sized[0] ?? null} /></section>
      <section class="card">
        <h3>السجل</h3>
        {!list.length ? <p class="empty">لا توجد متابعات بعد.</p> : (
          <ul class="fu-list">
            {list.map((f) => {
              const mine = f.author === "customer";
              return (
                <li key={f.id}>
                  <button class="fu-it" disabled={!mine} onClick={() => setEdit(f)}>
                    <span class="fu-d">{fmtDate(f.date)}</span>
                    <span class="fu-v">{f.weight ? <b>{f.weight} كجم</b> : null}{hasSize(f) && <span class="note">مقاسات</span>}{f.appetite ? <span class="note">الشهية {f.appetite} من 5</span> : null}</span>
                    {!mine && <span class="chip fu-lock" aria-label="سجلته مزيونة">🔒 من مزيونة</span>}
                  </button>
                  {f.note && <p class="note fu-n">{f.note}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {edit && <Entry f={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function Entry(p: { f: Fu | null; onClose: () => void }) {
  const [v, setV] = useState<FollowupInput>(p.f ?? { date: todayMuscat() });
  const num = (k: keyof FollowupInput) => (e: Event) => { const x = (e.currentTarget as HTMLInputElement).value; setV({ ...v, [k]: x === "" ? null : +x }); };
  const save = (e: Event) => {
    e.preventDefault();
    const { date, weight, arm, chest, waist, hips, thigh, appetite, note } = v;
    store.saveFollowup(p.f?.id ?? null, { date, weight, arm, chest, waist, hips, thigh, appetite, note: note?.trim() || null });
    toast("تم الحفظ");
    p.onClose();
  };
  return (
    <Sheet title={p.f ? "تعديل المتابعة" : "متابعة جديدة"} onClose={p.onClose}>
      <form class="stack" onSubmit={save}>
        <Field label="التاريخ"><input type="date" required value={v.date} max={todayMuscat()} onInput={(e) => setV({ ...v, date: e.currentTarget.value })} /></Field>
        <div class="fu-grid">
          {NUMS.map(([k, n]) => (
            <Field key={k} label={k === "weight" ? n : n + " (سم)"}>
              <input type="number" inputMode="decimal" step="0.1" min="0" value={(v[k] as number | null | undefined) ?? ""} onInput={num(k)} />
            </Field>
          ))}
        </div>
        <div class="field">الشهية
          <div class="fu-dots" role="radiogroup" aria-label="الشهية من 1 إلى 5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} role="radio" aria-checked={v.appetite === n} aria-label={String(n)}
                class={"fu-dot" + ((v.appetite ?? 0) >= n ? " on" : "")} onClick={() => setV({ ...v, appetite: v.appetite === n ? null : n })}>{n}</button>
            ))}
          </div>
        </div>
        <Field label="كيف كان أسبوعك؟"><textarea value={v.note ?? ""} maxLength={1000} onInput={(e) => setV({ ...v, note: e.currentTarget.value })} /></Field>
        <button class="btn wide">حفظ</button>
        {p.f && <ConfirmButton class="btn r wide" label="حذف" confirm="اضغطي مرة ثانية للحذف" onConfirm={() => { store.deleteFollowup(p.f!.id); toast("تم الحذف"); p.onClose(); }} />}
      </form>
    </Sheet>
  );
}
