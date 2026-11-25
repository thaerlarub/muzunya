// Edit a customer's meal or exercise plan: data tab, pages tab, save as a new version or as a template.
import "./builder.css";
import { useEffect, useState } from "preact/hooks";
import type { AdminRow, Customer, ExBody, MealBody, PlanBody, PlanCtx, PlanType, PlanVersion, Template } from "../../shared/types";
import { clearManual } from "../../shared/portions";
import { todayMuscat } from "../../shared/dates";
import { api } from "../api";
import { Field, Sheet, fmtDate, toast } from "../ui";
import { Fit, PlanPages } from "../pages/PlanPages";
import { Builder, mapStrings } from "./Builder";
import { SlotEditor } from "./SlotEditor";
import { ExEditor } from "./ExEditor";

export const recalc = (b: PlanBody): PlanBody => mapStrings(b, clearManual);
const latest = (vs: PlanVersion[]) => vs.reduce<PlanVersion | null>((a, v) => (!a || v.created_at > a.created_at ? v : a), null);

/** Tabs "البيانات" and "الصفحات" for one plan body (also used by the template editor). */
export function BodyEditor(p: { type: PlanType; body: PlanBody; cycle_len: number; ctx: PlanCtx; onBody: (b: PlanBody) => void; onCycle: (n: number) => void }) {
  const [tab, setTab] = useState<"data" | "pages">("data");
  return <>
    <div class="ped-tabs" role="tablist">
      <button type="button" role="tab" aria-selected={tab === "data"} class={tab === "data" ? "on" : ""} onClick={() => setTab("data")}>البيانات</button>
      <button type="button" role="tab" aria-selected={tab === "pages"} class={tab === "pages" ? "on" : ""} onClick={() => setTab("pages")}>الصفحات</button>
    </div>
    {tab === "pages"
      ? <Builder type={p.type} body={p.body} cycle_len={p.cycle_len} ctx={p.ctx} onChange={p.onBody} />
      : p.type === "meal"
        ? <SlotEditor body={p.body as MealBody} cycle_len={p.cycle_len} onChange={p.onBody} onCycle={p.onCycle} />
        : <ExEditor body={p.body as ExBody} cycle_len={p.cycle_len} onChange={p.onBody} onCycle={p.onCycle} />}
  </>;
}

/** Template picker in a sheet. */
function PickTemplate(p: { type: PlanType; onPick: (t: Template) => void; onClose: () => void }) {
  const [list, setList] = useState<Template[] | null>(null);
  useEffect(() => { api.get<Template[]>("/api/admin/templates").then((l) => setList(l.filter((t) => t.type === p.type))).catch(() => { toast("تعذر تحميل القوالب"); setList([]); }); }, []);
  return <Sheet title="اختاري قالبا" onClose={p.onClose}>
    {!list ? <p class="note">جاري التحميل...</p> : !list.length ? <p class="empty">لا توجد قوالب.</p>
      : <div class="stack">{list.map((t) => <button type="button" class="btn g wide" onClick={() => p.onPick(t)}>{t.name}</button>)}</div>}
  </Sheet>;
}

/** Copy the plan of another customer. */
function PickCustomer(p: { type: PlanType; self: string; onPick: (v: PlanVersion) => void; onClose: () => void }) {
  const [rows, setRows] = useState<AdminRow[] | null>(null);
  useEffect(() => {
    api.get<{ rows: AdminRow[] }>("/api/admin/overview")
      .then((r) => setRows(r.rows.filter((x) => x.customer.user_id !== p.self && x.versions.some((v) => v.type === p.type))))
      .catch(() => { toast("تعذر تحميل الزبونات"); setRows([]); });
  }, []);
  return <Sheet title="نسخ من زبونة أخرى" onClose={p.onClose}>
    {!rows ? <p class="note">جاري التحميل...</p> : !rows.length ? <p class="empty">لا توجد زبونات لديها هذه الخطة.</p>
      : <div class="stack">{rows.map((r) => <button type="button" class="btn g wide" onClick={() => p.onPick(latest(r.versions.filter((v) => v.type === p.type))!)}>{r.customer.name}</button>)}</div>}
  </Sheet>;
}

export function PlanEditor(p: { customer: Customer; type: PlanType; versions: PlanVersion[]; ctx: PlanCtx; onSaved: () => void }) {
  const mine = p.versions.filter((v) => v.type === p.type).sort((a, b) => (a.start_date < b.start_date ? 1 : a.start_date > b.start_date ? -1 : b.created_at - a.created_at));
  const last = latest(mine);
  const [body, setBody] = useState<PlanBody | null>(last ? structuredClone(last.body) : null);
  const [cycle, setCycle] = useState(last?.cycle_len ?? 7);
  const [dirty, setDirty] = useState(false);
  const [start, setStart] = useState(todayMuscat());
  const [tplName, setTplName] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"tpl" | "copy" | null>(null);
  const [view, setView] = useState<PlanVersion | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    const f = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    addEventListener("beforeunload", f);
    return () => removeEventListener("beforeunload", f);
  }, [dirty]);

  const load = (b: PlanBody, n: number) => { setBody(structuredClone(b)); setCycle(n); setDirty(true); setSheet(null); };
  const onBody = (b: PlanBody) => { setBody(b); setDirty(true); };
  const run = async (f: () => Promise<void>) => { setBusy(true); try { await f(); } catch { toast("تعذر الحفظ، حاولي مرة أخرى"); } finally { setBusy(false); } };

  const saveVersion = () => run(async () => {
    await api.post<PlanVersion>(`/api/admin/customers/${encodeURIComponent(p.customer.user_id)}/plans`, { type: p.type, start_date: start, cycle_len: cycle, body });
    setDirty(false); toast("تم حفظ نسخة جديدة"); p.onSaved();
  });
  const saveTemplate = () => run(async () => {
    const name = (tplName ?? "").trim();
    if (!name) { toast("اكتبي اسم القالب"); return; }
    await api.post<Template>("/api/admin/templates", { type: p.type, track: p.customer.track, name, cycle_len: cycle, body });
    setTplName(null); toast("تم حفظ القالب");
  });

  const pickers = <>
    {sheet === "tpl" && <PickTemplate type={p.type} onPick={(t) => load(t.body, t.cycle_len)} onClose={() => setSheet(null)} />}
    {sheet === "copy" && <PickCustomer type={p.type} self={p.customer.user_id} onPick={(v) => load(v.body, v.cycle_len)} onClose={() => setSheet(null)} />}
  </>;

  if (!body) return <div class="card stack">
    <h3>{p.type === "meal" ? "لا توجد خطة غذائية بعد" : "لا يوجد برنامج رياضي بعد"}</h3>
    <p class="note">ابدئي من قالب أو انسخي خطة زبونة أخرى.</p>
    <div class="row"><button class="btn" onClick={() => setSheet("tpl")}>اختيار قالب</button><button class="btn g" onClick={() => setSheet("copy")}>نسخ من زبونة أخرى</button></div>
    {pickers}
  </div>;

  return (
    <div class="stack">
      {p.type === "meal" && p.customer.allergies && <div class="allergy" role="note">الحساسية وما لا تحبه: {p.customer.allergies}</div>}
      <div class="card stack">
        <div class="row">
          <Field label="تبدأ النسخة الجديدة من"><input type="date" value={start} onInput={(e) => setStart(e.currentTarget.value || todayMuscat())} /></Field>
          <button class="btn" disabled={busy} onClick={saveVersion}>حفظ كنسخة جديدة</button>
          {dirty && <span class="chip warn">تغييرات غير محفوظة</span>}
        </div>
        <div class="row">
          <button class="btn g sm" onClick={() => { onBody(recalc(body)); toast("رجعت الكميات للحساب التلقائي"); }}>إعادة حساب الكميات</button>
          <button class="btn g sm" onClick={() => setSheet("tpl")}>تحميل قالب</button>
          <button class="btn g sm" onClick={() => setSheet("copy")}>نسخ من زبونة أخرى</button>
          <button class="btn g sm" onClick={() => setTplName(tplName == null ? "" : null)}>حفظ كقالب</button>
          <a class="btn g sm" href={`#/print/plan/${encodeURIComponent(p.customer.user_id)}`} target="_blank" rel="noopener">معاينة PDF</a>
        </div>
        {tplName != null && <div class="row">
          <input class="grow" placeholder="اسم القالب" value={tplName} onInput={(e) => setTplName(e.currentTarget.value)} aria-label="اسم القالب" />
          <button class="btn" disabled={busy} onClick={saveTemplate}>حفظ القالب</button>
        </div>}
        <p class="note">معاينة PDF تعرض الخطة المحفوظة الفعالة اليوم، احفظي التعديلات أولا.</p>
      </div>

      <BodyEditor type={p.type} body={body} cycle_len={cycle} ctx={p.ctx} onBody={onBody} onCycle={(n) => { setCycle(n); setDirty(true); }} />

      {mine.length > 0 && <div class="card">
        <h3>النسخ السابقة</h3>
        <ul class="vers">{mine.map((v) => <li>
          <span class="grow">تبدأ {fmtDate(v.start_date)}{v.start_date > todayMuscat() ? " (قادمة)" : ""}</span>
          <button class="btn g sm" onClick={() => setView(v)}>عرض</button>
        </li>)}</ul>
      </div>}
      {view && <Sheet title={`نسخة تبدأ ${fmtDate(view.start_date)}`} onClose={() => setView(null)}>
        <Fit><PlanPages type={view.type} body={view.body} cycle_len={view.cycle_len} ctx={p.ctx} date={view.start_date} /></Fit>
      </Sheet>}
      {pickers}
    </div>
  );
}
