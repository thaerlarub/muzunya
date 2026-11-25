// Customer list: summary, search, flags, new customer.
import { useEffect, useState } from "preact/hooks";
import { api, ApiError } from "../api";
import { Field, Phone, Sheet, toast } from "../ui";
import type { AdminRow } from "../../shared/types";
import { activeOf, diffDays, todayMuscat } from "../../shared/dates";
import { normPhone } from "../../shared/phone";
import { lastTickDate, weekStats } from "../../shared/stats";
import { BADGE_ITEM, BADGE_NAME, latestWeight } from "../../shared/badges";
import type { WearItem } from "../../shared/types";
import { packageDue, packageEnd } from "../../shared/pkg";

type Flag = "call" | "tick" | "goal" | "old" | "pkg";
export const WEAR_ICON: Record<WearItem, string> = { bow: "🎀", necklace: "📿", scarf: "🧣", glasses: "🕶️", flower: "🌸", crown: "👑" };
const FLAG: Record<Flag, string> = { call: "موعد الاتصال", tick: "لا تسجل", goal: "وصلت للهدف", old: "الخطة قديمة", pkg: "الباقة تنتهي" };

function flagsOf(r: AdminRow, today: string): Flag[] {
  const c = r.customer, f: Flag[] = [];
  if (c.start_date > today) return f;
  if (diffDays(today, r.last_followup?.date ?? c.start_date) >= 7) f.push("call");
  if (diffDays(today, lastTickDate(r.logs) ?? c.start_date) >= 2) f.push("tick");
  const w = latestWeight(c, r.last_followup ? [r.last_followup] : []);
  if (c.goal_w && w != null && w >= c.goal_w && !c.journey_finished_at) f.push("goal");
  if ((["meal", "exercise"] as const).some((t) => { const v = activeOf(r.versions, t, today); return v && diffDays(today, v.start_date) >= 28; })) f.push("old");
  if (packageDue(packageEnd(r.orders), today)) f.push("pkg");
  return f;
}

export function List() {
  const [rows, setRows] = useState<AdminRow[] | null>(null);
  const [q, setQ] = useState(""), [only, setOnly] = useState<Flag | null>(null), [arch, setArch] = useState(false), [adding, setAdding] = useState(false);
  const [created, setCreated] = useState<{ name: string; phone: string; pw: string } | null>(null);
  const load = () => api.get<{ rows: AdminRow[] }>("/api/admin/overview").then((r) => setRows(r.rows), () => { setRows([]); toast("تعذر تحميل الزبونات"); });
  useEffect(() => { load(); }, []);
  if (!rows) return <p class="empty">جاري التحميل...</p>;

  const today = todayMuscat();
  const all = rows.map((r) => ({ r, f: flagsOf(r, today) }));
  const act = all.filter((x) => x.r.customer.status === "active");
  const count = (k: Flag) => act.filter((x) => x.f.includes(k)).length;
  const qd = q.replace(/\D/g, "");
  const shown = all
    .filter((x) => (arch ? true : x.r.customer.status === "active"))
    .filter((x) => !only || x.f.includes(only))
    .filter((x) => !q.trim() || x.r.customer.name.includes(q.trim()) || (qd.length > 2 && x.r.customer.phone.replace(/\D/g, "").includes(qd)))
    .sort((a, b) => b.f.length - a.f.length || a.r.customer.name.localeCompare(b.r.customer.name, "ar"));

  return (
    <div class="stack">
      <div class="sum">
        <div class="card"><b>{act.length}</b><span>زبونة نشطة</span></div>
        <div class="card"><b>{count("call")}</b><span>موعد الاتصال</span></div>
        <div class="card"><b>{count("pkg")}</b><span>الباقة تنتهي</span></div>
      </div>
      <div class="row">
        <input class="grow" type="search" placeholder="بحث بالاسم أو الرقم" value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label="بحث" />
        <button class="btn" onClick={() => setAdding(true)}>+ زبونة جديدة</button>
      </div>
      <div class="chips" role="group" aria-label="تصفية">
        {(Object.keys(FLAG) as Flag[]).map((k) => (
          <button class={"fchip" + (only === k ? " on" : "")} aria-pressed={only === k} onClick={() => setOnly(only === k ? null : k)}>{FLAG[k]} <b>{count(k)}</b></button>
        ))}
        <label class="fchip"><input type="checkbox" checked={arch} onChange={(e) => setArch(e.currentTarget.checked)} /> المؤرشفات</label>
      </div>
      {shown.length ? (
        <ul class="clist">
          {shown.map(({ r, f }) => <Row r={r} f={f} today={today} />)}
        </ul>
      ) : <p class="empty">{rows.length ? "لا توجد نتائج" : "لا توجد زبونات بعد، أضف أول زبونة"}</p>}
      {adding && <NewCustomer onClose={() => setAdding(false)} onDone={(c) => { setAdding(false); setCreated(c); load(); }} />}
      {created && <TempPassword {...created} onClose={() => setCreated(null)} />}
    </div>
  );
}

function Row(p: { r: AdminRow; f: Flag[]; today: string }) {
  const c = p.r.customer;
  const s = weekStats(p.r.versions, p.r.logs, p.today);
  return (
    <li>
      <a class={"crow card" + (c.status === "archived" ? " arch" : "")} href={`#/c/${c.user_id}/profile`}>
        <div class="cmain">
          <b>{c.name}</b>
          <span class="note"><Phone n={c.phone} /></span>
          {p.f.length > 0 && <div class="row">{p.f.map((k) => <span class={"chip" + (k === "goal" ? " ok" : " warn")}>{FLAG[k]}</span>)}</div>}
          {c.status === "archived" && <span class="chip">مؤرشفة</span>}
        </div>
        <div class="cstat">
          <span title="الوجبات هذا الأسبوع">🍽 {Math.round(s.mealPct * 100)}%</span>
          <span title="التمارين هذا الأسبوع">💪 {s.workoutsDone}/{s.workoutsPlanned}</span>
          {p.r.badges.length > 0 && <span class="bdg">{p.r.badges.map((b) => <span title={BADGE_NAME[b.badge]}>{WEAR_ICON[BADGE_ITEM[b.badge]]}</span>)}</span>}
        </div>
      </a>
    </li>
  );
}

const ACT: [string, string][] = [["1.2", "قليل الحركة"], ["1.375", "حركة خفيفة"], ["1.55", "حركة متوسطة"], ["1.725", "حركة عالية"]];
export const ActSelect = (p: { v: string; set: (v: string) => void }) => (
  <select value={p.v} onChange={(e) => p.set(e.currentTarget.value)}>{ACT.map(([v, t]) => <option value={v}>{t}</option>)}</select>
);
export const SurSelect = (p: { v: string; set: (v: string) => void }) => (
  <select value={p.v} onChange={(e) => p.set(e.currentTarget.value)}>{["300", "400", "500"].map((v) => <option value={v}>{v} سعرة</option>)}</select>
);
export const num = (s: string) => (s.trim() === "" ? null : +s);

function NewCustomer(p: { onClose: () => void; onDone: (c: { name: string; phone: string; pw: string }) => void }) {
  const [f, setF] = useState({ name: "", phone: "", height: "", w0: "", start_date: todayMuscat(), act: "1.375", sur: "400", goal_w: "", allergies: "" });
  const [perr, setPerr] = useState(""), [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { currentTarget: { value: string } }) => setF({ ...f, [k]: e.currentTarget.value });
  const go = async (e: Event) => {
    e.preventDefault();
    const phone = normPhone(f.phone);
    if (!phone) return setPerr("رقم غير صحيح، اكتب 8 أرقام أو الرقم مع رمز الدولة");
    setBusy(true);
    try {
      const r = await api.post<{ id: string; temp_password: string }>("/api/admin/customers", {
        name: f.name.trim(), phone, height: num(f.height), w0: num(f.w0), start_date: f.start_date, act: f.act, sur: f.sur, goal_w: num(f.goal_w), allergies: f.allergies.trim() || null,
      });
      p.onDone({ name: f.name.trim(), phone, pw: r.temp_password });
    } catch (x) {
      if (x instanceof ApiError && x.code === "phone") setPerr("رقم غير صحيح");
      else if (x instanceof ApiError && x.code === "exists") setPerr("هذا الرقم مسجل لزبونة أخرى");
      else toast("تعذر الحفظ، حاول مرة ثانية");
    } finally { setBusy(false); }
  };
  return (
    <Sheet title="زبونة جديدة" onClose={p.onClose}>
      <form class="stack" onSubmit={go}>
        <Field label="الاسم"><input value={f.name} onInput={set("name")} required /></Field>
        <Field label="رقم الهاتف">
          <input dir="ltr" inputMode="tel" value={f.phone} onInput={(e) => { set("phone")(e); setPerr(""); }} aria-invalid={!!perr} required />
          {perr && <span class="err" role="alert">{perr}</span>}
        </Field>
        <div class="two">
          <Field label="الطول (سم)"><input type="number" inputMode="decimal" min="120" max="220" value={f.height} onInput={set("height")} required /></Field>
          <Field label="الوزن عند البداية (كغ)"><input type="number" inputMode="decimal" step="0.1" min="25" max="200" value={f.w0} onInput={set("w0")} required /></Field>
        </div>
        <div class="two">
          <Field label="تاريخ البداية"><input type="date" value={f.start_date} onInput={set("start_date")} required /></Field>
          <Field label="الوزن المستهدف (اختياري)"><input type="number" inputMode="decimal" step="0.1" value={f.goal_w} onInput={set("goal_w")} /></Field>
        </div>
        <div class="two">
          <Field label="النشاط"><ActSelect v={f.act} set={(v) => setF({ ...f, act: v })} /></Field>
          <Field label="الزيادة اليومية"><SurSelect v={f.sur} set={(v) => setF({ ...f, sur: v })} /></Field>
        </div>
        <Field label="الحساسية وما لا تحبه"><textarea value={f.allergies} onInput={set("allergies")} /></Field>
        <button class="btn wide" disabled={busy}>{busy ? "جاري الحفظ..." : "حفظ وإنشاء الحساب"}</button>
      </form>
    </Sheet>
  );
}

/** Temporary password, shown once (after creation or reset). */
export function TempPassword(p: { name: string; phone: string; pw: string; onClose: () => void }) {
  const msg = `أهلا ${p.name}، حسابك في تطبيق مزيونة جاهز.\n\nالرابط:\n${location.origin}\n\nرقم الدخول: ${p.phone}\nكلمة المرور المؤقتة: ${p.pw}\n\nبعد أول دخول اختاري كلمة مرور جديدة.`;
  const copy = () => navigator.clipboard?.writeText(p.pw).then(() => toast("تم النسخ"), () => toast("تعذر النسخ، انسخها يدويا"));
  return (
    <Sheet title="كلمة المرور المؤقتة" onClose={p.onClose}>
      <div class="stack">
        <p>حساب <b>{p.name}</b>، رقم الدخول <Phone n={p.phone} /></p>
        <div class="pw" dir="ltr">{p.pw}</div>
        <div class="row">
          <button class="btn g" onClick={copy}>نسخ كلمة المرور</button>
          <a class="btn" href={`https://wa.me/${p.phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer">إرسال على واتساب</a>
        </div>
        <p class="chip warn">لن تظهر كلمة المرور مرة ثانية. أرسلها الآن.</p>
      </div>
    </Sheet>
  );
}
