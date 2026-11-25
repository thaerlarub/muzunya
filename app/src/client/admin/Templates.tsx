// Plan templates: list by type, rename, delete, edit with the same editors as a customer plan.
import "./builder.css";
import { useEffect, useState } from "preact/hooks";
import type { Customer, Exercise, PlanBody, PlanCtx, PlanType, Settings, Template } from "../../shared/types";
import { todayMuscat } from "../../shared/dates";
import { api, photoUrl } from "../api";
import { ConfirmButton, toast } from "../ui";
import { BodyEditor, recalc } from "./PlanEditor";

const SAMPLE: Customer = {
  user_id: "sample", name: "اسم الزبونة", phone: "", status: "active", height: 160, w0: 50, start_date: todayMuscat(), track: "gain", goal_w: null,
  act: "1.375", sur: "400", man_kcal: null, mascot: null, wardrobe: {}, allergies: null, journey_finished_at: null, letter: null,
};
const TYPE: Record<PlanType, string> = { meal: "خطط غذائية", exercise: "برامج رياضية" };

function Edit(p: { t: Template; ctx: PlanCtx; onDone: (saved: boolean) => void }) {
  const [body, setBody] = useState<PlanBody>(structuredClone(p.t.body));
  const [cycle, setCycle] = useState(p.t.cycle_len);
  const [name, setName] = useState(p.t.name);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const f = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    addEventListener("beforeunload", f);
    return () => removeEventListener("beforeunload", f);
  }, [dirty]);
  const save = async () => {
    try { await api.put(`/api/admin/templates/${encodeURIComponent(p.t.id)}`, { name: name.trim() || p.t.name, cycle_len: cycle, body }); setDirty(false); toast("تم حفظ القالب"); p.onDone(true); }
    catch { toast("تعذر الحفظ، حاولي مرة أخرى"); }
  };
  const onBody = (b: PlanBody) => { setBody(b); setDirty(true); };
  return <div class="stack">
    <div class="card stack">
      <div class="row">
        <input class="grow" value={name} onInput={(e) => { setName(e.currentTarget.value); setDirty(true); }} aria-label="اسم القالب" />
        <button class="btn" onClick={save}>حفظ</button>
        {dirty ? <ConfirmButton class="btn g" label="رجوع" confirm="اضغطي مرة ثانية للخروج بدون حفظ" onConfirm={() => p.onDone(false)} />
          : <button class="btn g" onClick={() => p.onDone(false)}>رجوع</button>}
      </div>
      <div class="row"><button class="btn g sm" onClick={() => { onBody(recalc(body)); toast("رجعت الكميات للحساب التلقائي"); }}>إعادة حساب الكميات</button>
        {dirty && <span class="chip warn">تغييرات غير محفوظة</span>}</div>
    </div>
    <BodyEditor type={p.t.type} body={body} cycle_len={cycle} ctx={p.ctx} onBody={onBody} onCycle={(n) => { setCycle(n); setDirty(true); }} />
  </div>;
}

export function Templates() {
  const [list, setList] = useState<Template[] | null>(null);
  const [ctx, setCtx] = useState<PlanCtx>({ customer: SAMPLE, weight: 50, settings: { whatsapp: "", accent: "", muzuna_kcal: null, muzuna_prot: null }, exercises: [], photoUrl });
  const [open, setOpen] = useState<Template | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const load = () => api.get<Template[]>("/api/admin/templates").then(setList).catch(() => { toast("تعذر تحميل القوالب"); setList([]); });
  useEffect(() => {
    load();
    Promise.all([api.get<Settings>("/api/admin/settings"), api.get<Exercise[]>("/api/admin/exercises")])
      .then(([settings, exercises]) => setCtx((c) => ({ ...c, settings, exercises }))).catch(() => {});
  }, []);

  if (open) return <Edit t={open} ctx={ctx} onDone={(s) => { setOpen(null); if (s) load(); }} />;
  if (!list) return <p class="note">جاري التحميل...</p>;
  const rename = async (t: Template) => {
    const n = (names[t.id] ?? t.name).trim();
    if (!n || n === t.name) return;
    try { await api.put(`/api/admin/templates/${encodeURIComponent(t.id)}`, { name: n }); toast("تم تغيير الاسم"); load(); } catch { toast("تعذر الحفظ"); }
  };
  const del = async (t: Template) => {
    try { await api.del(`/api/admin/templates/${encodeURIComponent(t.id)}`); toast("تم حذف القالب"); load(); } catch { toast("تعذر الحذف"); }
  };
  return <div class="stack">
    <h2>القوالب</h2>
    {(["meal", "exercise"] as PlanType[]).map((ty) => <div class="card">
      <h3>{TYPE[ty]}</h3>
      {list.filter((t) => t.type === ty).map((t) => <div class="tpl">
        <input value={names[t.id] ?? t.name} onInput={(e) => setNames({ ...names, [t.id]: e.currentTarget.value })} onBlur={() => rename(t)} aria-label="اسم القالب" />
        <button class="btn g sm" onClick={() => setOpen(t)}>تعديل</button>
        <ConfirmButton class="btn r sm" label="حذف" confirm="اضغطي مرة ثانية للحذف" onConfirm={() => del(t)} />
      </div>)}
      {!list.some((t) => t.type === ty) && <p class="note">لا توجد قوالب من هذا النوع. احفظي أي خطة كقالب من صفحة الزبونة.</p>}
    </div>)}
  </div>;
}
