// Follow-up tab: charts and every entry (hers and his), add, edit, delete.
import { useState } from "preact/hooks";
import { api } from "../api";
import { ConfirmButton, Field, Sheet, fmtDate, toast } from "../ui";
import type { Followup, FollowupInput } from "../../shared/types";
import { todayMuscat } from "../../shared/dates";
import { SizesCompare, WeightChart } from "../charts";
import { num } from "./List";
import type { TabProps } from "./Customer";

const NUMS: [keyof FollowupInput, string][] = [["weight", "الوزن (كغ)"], ["arm", "الذراع"], ["chest", "الصدر"], ["waist", "الخصر"], ["hips", "الأرداف"], ["thigh", "الفخذ"]];
const APP = ["", "ضعيفة جدا", "ضعيفة", "متوسطة", "جيدة", "ممتازة"];

export function FollowupsAdmin({ d, reload }: TabProps) {
  const [ed, setEd] = useState<Followup | "new" | null>(null);
  const c = d.customer;
  const asc = [...d.followups].sort((a, b) => a.date.localeCompare(b.date) || a.updated_at - b.updated_at);
  const pts = [...(c.w0 != null ? [{ d: c.start_date, w: c.w0 }] : []), ...asc.filter((f) => f.weight != null).map((f) => ({ d: f.date, w: f.weight! }))];
  const sized = asc.filter((f) => NUMS.slice(1).some(([k]) => f[k] != null));
  const del = async (f: Followup) => { try { await api.del(`/api/admin/followups/${encodeURIComponent(f.id)}`); await reload(); } catch { toast("تعذر الحذف"); } };

  return (
    <div class="stack">
      <button class="btn" onClick={() => setEd("new")}>+ متابعة جديدة</button>
      <div class="two">
        <div class="card"><h3>الوزن</h3><WeightChart points={pts} goal={c.goal_w} /></div>
        <div class="card"><h3>المقاسات</h3><SizesCompare first={sized[0] ?? null} last={sized[sized.length - 1] ?? null} /></div>
      </div>
      {asc.length === 0 && <p class="empty">لا توجد متابعات بعد.</p>}
      {[...asc].reverse().map((f) => (
        <div class="card fu">
          <div class="row between">
            <b>{fmtDate(f.date)}</b>
            <span class="chip">{f.author === "admin" ? "من الإدارة" : "سجلتها هي"}</span>
          </div>
          <div class="kpis">
            {NUMS.map(([k, n]) => f[k] != null && <span>{n} <b>{f[k] as number}</b></span>)}
            {f.appetite != null && <span>الشهية <b>{APP[f.appetite] ?? f.appetite}</b></span>}
          </div>
          {f.note && <blockquote class={f.author === "customer" ? "wk" : ""}>{f.author === "customer" && <small>كيف كان أسبوعك</small>}{f.note}</blockquote>}
          <div class="row">
            <button class="btn g sm" onClick={() => setEd(f)}>تعديل</button>
            <ConfirmButton class="btn r sm" label="حذف" confirm="تأكيد الحذف" onConfirm={() => del(f)} />
          </div>
        </div>
      ))}
      {ed && <FuSheet f={ed === "new" ? null : ed} cid={c.user_id} onClose={() => setEd(null)} done={async () => { setEd(null); await reload(); }} />}
    </div>
  );
}

function FuSheet(p: { f: Followup | null; cid: string; onClose: () => void; done: () => Promise<void> }) {
  const s = (v: number | null | undefined) => (v == null ? "" : String(v));
  const [v, setV] = useState<Record<string, string>>({
    date: p.f?.date ?? todayMuscat(), note: p.f?.note ?? "", appetite: s(p.f?.appetite),
    ...Object.fromEntries(NUMS.map(([k]) => [k, s(p.f?.[k] as number | null)])),
  });
  const [busy, setBusy] = useState(false);
  const go = async (e: Event) => {
    e.preventDefault(); setBusy(true);
    const body: FollowupInput = { date: v.date, note: v.note.trim() || null, appetite: num(v.appetite) };
    for (const [k] of NUMS) (body as unknown as Record<string, number | null>)[k] = num(v[k]);
    try {
      p.f ? await api.put(`/api/admin/followups/${encodeURIComponent(p.f.id)}`, body) : await api.post(`/api/admin/customers/${encodeURIComponent(p.cid)}/followups`, body);
      toast("تم الحفظ"); await p.done();
    } catch { toast("تعذر الحفظ"); setBusy(false); }
  };
  return (
    <Sheet title={p.f ? "تعديل المتابعة" : "متابعة جديدة"} onClose={p.onClose}>
      <form class="stack" onSubmit={go}>
        <Field label="التاريخ"><input type="date" value={v.date} onInput={(e) => setV({ ...v, date: e.currentTarget.value })} required /></Field>
        <div class="grid3">
          {NUMS.map(([k, n]) => (
            <Field label={n}><input type="number" inputMode="decimal" step="0.1" min="0" value={v[k]} onInput={(e) => setV({ ...v, [k]: e.currentTarget.value })} /></Field>
          ))}
        </div>
        <Field label="الشهية">
          <select value={v.appetite} onChange={(e) => setV({ ...v, appetite: e.currentTarget.value })}>
            <option value="">بدون</option>{APP.slice(1).map((t, i) => <option value={i + 1}>{i + 1}: {t}</option>)}
          </select>
        </Field>
        <Field label="ملاحظة"><textarea value={v.note} onInput={(e) => setV({ ...v, note: e.currentTarget.value })} /></Field>
        <button class="btn wide" disabled={busy}>حفظ</button>
      </form>
    </Sheet>
  );
}
