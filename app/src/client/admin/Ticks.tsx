// Tick grid: last 28 days (or since her start), meal slots of the version active that day, workout and meal %.
import { useState } from "preact/hooks";
import { api } from "../api";
import { Sheet, fmtDate, toast } from "../ui";
import type { DayBody, ExDay, MealBody, Slot } from "../../shared/types";
import { activeOf, addDays, todayMuscat, weekStart } from "../../shared/dates";
import { dayMealPct, exDayFor } from "../../shared/stats";
import type { TabProps } from "./Customer";

const val = (b: DayBody, k: string) => b[k]?.[0] ?? 0;
type Edit = { date: string; body: DayBody; slot?: Slot; ex?: ExDay & { rest?: false } };

export function Ticks({ d, reload, exercises }: TabProps) {
  const [edit, setEdit] = useState<Edit | null>(null);
  const c = d.customer, today = todayMuscat();
  const from = [addDays(today, -27), c.start_date].sort()[1];
  const logs = new Map(d.logs.map((l) => [l.date, l.body]));
  const exName = (it: { ex?: string; name?: string }, i: number) => exercises.find((e) => e.id === it.ex)?.name_ar ?? it.name ?? `تمرين ${i + 1}`;

  const put = async (date: string, ch: Record<string, number>) => {
    const t = Date.now(), body: DayBody = {};
    for (const k in ch) body[k] = [ch[k], t];
    if (!Object.keys(body).length) return;
    try { await api.put(`/api/admin/customers/${encodeURIComponent(c.user_id)}/logs/${date}`, { body }); await reload(); }
    catch { toast("تعذر الحفظ"); }
  };

  if (from > today) return <p class="empty">تبدأ خطتها في {fmtDate(c.start_date)}.</p>;
  const days: string[] = [];
  for (let x = today; x >= from; x = addDays(x, -1)) days.push(x);
  const weeks: string[][] = [];
  for (const x of days) { const w = weeks[weeks.length - 1]; w && weekStart(w[0]) === weekStart(x) ? w.push(x) : weeks.push([x]); }

  return (
    <div class="stack">
      <p class="note">اضغط على أي خانة لتصحيحها. الأحدث في الأعلى.</p>
      {weeks.map((w) => {
        let prev: string | undefined = "";
        return (
          <div class="card tk">
            <h3>أسبوع {fmtDate(weekStart(w[0]))}</h3>
            <div class="scroll">
              <table class="t tg">
                <tbody>
                  {w.flatMap((date) => {
                    const mv = activeOf(d.versions, "meal", date), slots = (mv?.body as MealBody | undefined)?.slots ?? [];
                    const body = logs.get(date) ?? {}, ex = exDayFor(d.versions, date);
                    const rows = [];
                    if (mv?.id !== prev) {
                      prev = mv?.id;
                      rows.push(<tr><th class="dd">اليوم</th><th>الوجبات</th><th>🏋️<small>التمرين</small></th>{slots.map((s) => <th title={s.name}>{s.icon}<small>{s.name}</small></th>)}</tr>);
                    }
                    const exN = ex && !ex.rest ? ex.items.filter((_, i) => val(body, "x:" + i) >= 1).length : 0;
                    rows.push(
                      <tr>
                        <td class="dd">{fmtDate(date)}</td>
                        <td>{mv ? Math.round(dayMealPct(body, slots) * 100) + "%" : "-"}</td>
                        <td>{ex && !ex.rest
                          ? <button class={"cell" + (exN === ex.items.length && exN ? " on" : "")} aria-label={`التمرين ${fmtDate(date)}`} onClick={() => setEdit({ date, body, ex })}>{exN}/{ex.items.length}</button>
                          : <span class="note">{ex ? "راحة" : "-"}</span>}</td>
                        {!mv && <td class="note">لا توجد خطة</td>}
                        {slots.map((s) => {
                          const v = val(body, "m:" + s.id);
                          return (
                            <td><button class={"cell" + (v ? " on" : "")} aria-label={`${s.name} ${fmtDate(date)}`}
                              onClick={() => s.kind === "counter" ? setEdit({ date, body, slot: s }) : put(date, { ["m:" + s.id]: v ? 0 : 1 })}>
                              {s.kind === "counter" ? `${v}/${s.target ?? 8}` : v ? "✓" : "·"}
                            </button></td>
                          );
                        })}
                      </tr>,
                    );
                    return rows;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      {edit?.slot && <CounterSheet e={edit} onClose={() => setEdit(null)} save={async (v) => { await put(edit.date, { ["m:" + edit.slot!.id]: v }); setEdit(null); }} />}
      {edit?.ex && <WorkoutSheet e={edit} name={exName} onClose={() => setEdit(null)} save={async (ch) => { await put(edit.date, ch); setEdit(null); }} />}
    </div>
  );
}

function CounterSheet(p: { e: Edit; onClose: () => void; save: (v: number) => Promise<void> }) {
  const s = p.e.slot!, [v, setV] = useState(val(p.e.body, "m:" + s.id));
  return (
    <Sheet title={`${s.name}: ${fmtDate(p.e.date)}`} onClose={p.onClose}>
      <div class="stack">
        <div class="row center">
          <button class="btn g" onClick={() => setV(Math.max(0, v - 1))} aria-label="أقل">−</button>
          <b class="big">{v} / {s.target ?? 8}</b>
          <button class="btn g" onClick={() => setV(Math.min(30, v + 1))} aria-label="أكثر">+</button>
        </div>
        <button class="btn wide" onClick={() => p.save(v)}>حفظ</button>
      </div>
    </Sheet>
  );
}

function WorkoutSheet(p: { e: Edit; name: (it: { ex?: string; name?: string }, i: number) => string; onClose: () => void; save: (ch: Record<string, number>) => Promise<void> }) {
  const items = p.e.ex!.items, b = p.e.body;
  const [x, setX] = useState(items.map((_, i) => val(b, "x:" + i) >= 1));
  const [kg, setKg] = useState(items.map((_, i) => (b["kg:" + i] ? String(b["kg:" + i][0]) : "")));
  const go = () => {
    const ch: Record<string, number> = {};
    items.forEach((_, i) => {
      if (x[i] !== (val(b, "x:" + i) >= 1)) ch["x:" + i] = x[i] ? 1 : 0;
      const k = kg[i].trim() === "" ? 0 : +kg[i];
      if (!isNaN(k) && k !== val(b, "kg:" + i)) ch["kg:" + i] = k;
    });
    p.save(ch);
  };
  return (
    <Sheet title={`${p.e.ex!.title}: ${fmtDate(p.e.date)}`} onClose={p.onClose}>
      <div class="stack">
        {items.map((it, i) => (
          <div class="row exr">
            <label class="grow row"><input type="checkbox" class="cb" checked={x[i]} onChange={(e) => setX(x.map((y, j) => (j === i ? e.currentTarget.checked : y)))} />
              <span>{p.name(it, i)} <small class="note">{it.sets} × {it.reps}</small></span></label>
            <input class="kg" type="number" inputMode="decimal" step="0.5" min="0" placeholder="كغ" aria-label="الوزن المستخدم" value={kg[i]}
              onInput={(e) => setKg(kg.map((y, j) => (j === i ? e.currentTarget.value : y)))} />
          </div>
        ))}
        <button class="btn wide" onClick={go}>حفظ</button>
      </div>
    </Sheet>
  );
}
