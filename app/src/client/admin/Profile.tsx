// Profile tab: details, computed targets, package orders, account actions.
import { useState } from "preact/hooks";
import { api, ApiError } from "../api";
import { ConfirmButton, Field, Sheet, fmtDate, toast } from "../ui";
import type { Order } from "../../shared/types";
import { todayMuscat } from "../../shared/dates";
import { normPhone } from "../../shared/phone";
import { targets } from "../../shared/portions";
import { latestWeight } from "../../shared/badges";
import { packageDaysLeft, packageEnd } from "../../shared/pkg";
import { ActSelect, SurSelect, TempPassword, num } from "./List";
import type { TabProps } from "./Customer";

const str = (v: number | null) => (v == null ? "" : String(v));

export function Profile({ d, reload, settings }: TabProps) {
  const c = d.customer, base = `/api/admin/customers/${encodeURIComponent(c.user_id)}`;
  const [f, setF] = useState({ name: c.name, phone: c.phone, height: str(c.height), w0: str(c.w0), start_date: c.start_date, act: c.act, sur: c.sur, man_kcal: str(c.man_kcal), goal_w: str(c.goal_w), allergies: c.allergies ?? "" });
  const [perr, setPerr] = useState(""), [busy, setBusy] = useState(false);
  const [pw, setPw] = useState(""), [del, setDel] = useState(false);
  const set = (k: keyof typeof f) => (e: { currentTarget: { value: string } }) => setF({ ...f, [k]: e.currentTarget.value });

  const w = latestWeight(c, d.followups);
  const t = targets({ w, h: num(f.height), act: f.act, sur: f.sur, man: num(f.man_kcal), muzunaKcal: settings.muzuna_kcal });

  const save = async (e: Event) => {
    e.preventDefault();
    const phone = normPhone(f.phone);
    if (!phone) return setPerr("رقم غير صحيح");
    setBusy(true);
    try {
      await api.put(base, { name: f.name.trim(), phone, height: num(f.height), w0: num(f.w0), start_date: f.start_date, act: f.act, sur: f.sur, man_kcal: num(f.man_kcal), goal_w: num(f.goal_w), allergies: f.allergies.trim() || null });
      toast("تم الحفظ"); await reload();
    } catch (x) { x instanceof ApiError && x.code === "exists" ? setPerr("هذا الرقم مسجل لزبونة أخرى") : toast("تعذر الحفظ"); }
    finally { setBusy(false); }
  };
  const act = async (path: string, body: unknown, ok: string) => {
    try { await api.post(base + path, body); toast(ok); await reload(); } catch { toast("تعذر تنفيذ الطلب"); }
  };
  const reset = async () => {
    try { setPw((await api.post<{ temp_password: string }>(base + "/reset")).temp_password); } catch { toast("تعذر إعادة التعيين"); }
  };

  return (
    <div class="stack">
      <form class="card stack" onSubmit={save}>
        <h3>البيانات</h3>
        <div class="two">
          <Field label="الاسم"><input value={f.name} onInput={set("name")} required /></Field>
          <Field label="رقم الهاتف">
            <input dir="ltr" inputMode="tel" value={f.phone} onInput={(e) => { set("phone")(e); setPerr(""); }} aria-invalid={!!perr} required />
            {perr && <span class="err" role="alert">{perr}</span>}
          </Field>
        </div>
        <div class="two">
          <Field label="الطول (سم)"><input type="number" inputMode="decimal" value={f.height} onInput={set("height")} /></Field>
          <Field label="الوزن عند البداية (كغ)"><input type="number" inputMode="decimal" step="0.1" value={f.w0} onInput={set("w0")} /></Field>
        </div>
        <div class="two">
          <Field label="تاريخ البداية"><input type="date" value={f.start_date} onInput={set("start_date")} required /></Field>
          <Field label="الوزن المستهدف"><input type="number" inputMode="decimal" step="0.1" value={f.goal_w} onInput={set("goal_w")} /></Field>
        </div>
        <div class="two">
          <Field label="النشاط"><ActSelect v={f.act} set={(v) => setF({ ...f, act: v })} /></Field>
          <Field label="الزيادة اليومية"><SurSelect v={f.sur} set={(v) => setF({ ...f, sur: v })} /></Field>
        </div>
        <div class="two">
          <Field label="سعرات يدوية (اختياري)"><input type="number" inputMode="numeric" value={f.man_kcal} onInput={set("man_kcal")} /></Field>
          <Field label="المسار"><input value="زيادة الوزن" readOnly /></Field>
        </div>
        <Field label="الحساسية وما لا تحبه"><textarea value={f.allergies} onInput={set("allergies")} /></Field>
        <div class="kpis">
          <span>السعرات <b>{t.kcal || "-"}</b></span>
          <span>البروتين <b>{t.prot || "-"} غ</b></span>
          <span>مؤشر الكتلة <b>{t.bmi ? t.bmi.toFixed(1) : "-"}</b></span>
          <span>الوزن الصحي <b>{t.lo} إلى {t.hi} كغ</b></span>
        </div>
        <p class="note">الحساب على آخر وزن مسجل ({w ?? "-"} كغ) وعمر 25 سنة ثابت.</p>
        {t.bmi >= 25 && <p class="chip warn">مؤشر الكتلة 25 أو أكثر، خطة زيادة الوزن قد لا تناسبها.</p>}
        {t.clamped && <p class="chip warn">السعرات خارج حدود تحجيم الخطة، الكميات عند الحد.</p>}
        <button class="btn" disabled={busy}>{busy ? "جاري الحفظ..." : "حفظ البيانات"}</button>
      </form>

      <Orders orders={d.orders} base={base} reload={reload} />

      <div class="card stack">
        <h3>الحساب</h3>
        <div class="row">
          <a class="btn g" href={`#/print/plan/${c.user_id}`} target="_blank" rel="noopener">فتح PDF الخطة</a>
          <button class="btn g" onClick={reset}>كلمة مرور مؤقتة جديدة</button>
          <button class="btn g" onClick={() => act("/signout", {}, "تم تسجيل خروجها من كل الأجهزة")}>تسجيل خروجها من كل الأجهزة</button>
          {c.status === "active"
            ? <ConfirmButton class="btn g" label="أرشفة" confirm="اضغط للتأكيد" onConfirm={() => act("/archive", { archived: true }, "تمت الأرشفة")} />
            : <button class="btn g" onClick={() => act("/archive", { archived: false }, "تم إلغاء الأرشفة")}>إلغاء الأرشفة</button>}
          <ConfirmButton label="حذف الزبونة" confirm="متأكد؟ اضغط مرة ثانية" onConfirm={() => setDel(true)} />
        </div>
      </div>
      {pw && <TempPassword name={c.name} phone={c.phone} pw={pw} onClose={() => setPw("")} />}
      {del && <DeleteSheet name={c.name} base={base} onClose={() => setDel(false)} />}
    </div>
  );
}

function Orders(p: { orders: Order[]; base: string; reload: () => Promise<void> }) {
  const [date, setDate] = useState(todayMuscat()), [months, setMonths] = useState("1");
  const today = todayMuscat(), end = packageEnd(p.orders), left = end ? packageDaysLeft(end, today) : null;
  const add = async (e: Event) => {
    e.preventDefault();
    try { await api.post(p.base + "/orders", { order_date: date, months: +months }); toast("تمت إضافة الطلب"); await p.reload(); } catch { toast("تعذر الحفظ"); }
  };
  const rm = async (id: string) => { try { await api.del(`/api/admin/orders/${encodeURIComponent(id)}`); await p.reload(); } catch { toast("تعذر الحذف"); } };
  return (
    <div class="card stack">
      <h3>الباقة</h3>
      {end ? <p>تنتهي في <b>{fmtDate(end)}</b>{left != null && (left >= 0 ? <>، باقي <b>{left}</b> يوم</> : <>، انتهت منذ <b>{-left}</b> يوم</>)}</p> : <p class="note">لا توجد طلبات بعد.</p>}
      {p.orders.length > 0 && (
        <ul class="plain">
          {[...p.orders].sort((a, b) => b.order_date.localeCompare(a.order_date)).map((o) => (
            <li class="row between"><span>{fmtDate(o.order_date)}: {o.months} {o.months === 1 ? "شهر" : "أشهر"}</span><ConfirmButton class="btn r sm" label="حذف" confirm="تأكيد" onConfirm={() => rm(o.id)} /></li>
          ))}
        </ul>
      )}
      <form class="row" onSubmit={add}>
        <input type="date" style="flex:1 1 150px;width:auto" value={date} onInput={(e) => setDate(e.currentTarget.value)} required aria-label="تاريخ الطلب" />
        <select value={months} onChange={(e) => setMonths(e.currentTarget.value)} aria-label="عدد الأشهر" style="width:auto">
          {Array.from({ length: 12 }, (_, i) => <option value={i + 1}>{i + 1} {i ? "أشهر" : "شهر"}</option>)}
        </select>
        <button class="btn">إضافة طلب</button>
      </form>
    </div>
  );
}

function DeleteSheet(p: { name: string; base: string; onClose: () => void }) {
  const [v, setV] = useState(""), [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { await api.del(p.base); toast("تم حذف الزبونة وكل بياناتها"); location.hash = "#/"; } catch { toast("تعذر الحذف"); setBusy(false); }
  };
  return (
    <Sheet title="حذف نهائي" onClose={p.onClose}>
      <div class="stack">
        <p>سيتم حذف كل بياناتها وصورها نهائيا. اكتب اسمها للتأكيد: <b>{p.name}</b></p>
        <input value={v} onInput={(e) => setV(e.currentTarget.value)} aria-label="اسمها" />
        <button class="btn r wide" disabled={busy || v.trim() !== p.name.trim()} onClick={go}>حذف نهائي</button>
      </div>
    </Sheet>
  );
}
