// More: plans and PDF, recipes, notes, wardrobe, mascot, gift, sign out.
import { useState } from "preact/hooks";
import type { PlanCtx, PlanVersion, Wardrobe as W } from "../../shared/types";
import { activeOf, todayMuscat } from "../../shared/dates";
import { latestWeight } from "../../shared/badges";
import { growth } from "../../shared/growth";
import { Fit, PlanPages } from "../pages/PlanPages";
import { Wardrobe } from "../game/Wardrobe";
import { MascotPicker } from "../game/MascotPicker";
import { api, photoUrl } from "../api";
import { Sheet, fmtDate, toast } from "../ui";
import { store, useMe } from "../store";
import { itemsOf, pickMascot, waLink } from "./App";

const TYPE_AR = { meal: "الخطة الغذائية", exercise: "خطة التمارين" } as const;

export function More() {
  const me = useMe(), c = me.customer, today = todayMuscat();
  const [view, setView] = useState<PlanVersion | null>(null), [pick, setPick] = useState(false);
  const active = (["meal", "exercise"] as const).map((t) => activeOf(me.versions, t, today)).filter((v): v is PlanVersion => !!v);
  const old = me.versions.filter((v) => v.start_date <= today && !active.includes(v)).sort((a, b) => b.start_date.localeCompare(a.start_date));
  const notes = [...me.notes].sort((a, b) => b.date.localeCompare(a.date));
  const ctx: PlanCtx = { customer: c, weight: latestWeight(c, me.followups), settings: me.settings, exercises: me.exercises, photoUrl };
  const setWardrobe = async (w: W) => {
    const prev = c.wardrobe;
    store.patchCustomer({ wardrobe: w });
    try { await api.put("/api/me/wardrobe", { wardrobe: w }); } catch { store.patchCustomer({ wardrobe: prev }); toast("تعذر الحفظ، تأكدي من الإنترنت"); }
  };
  const logout = async () => {
    await store.flush();
    if (store.pending()) return toast("انتظري الاتصال بالإنترنت حتى نحفظ تغييراتك");
    try { await api.post("/api/auth/logout"); } catch { return toast("تعذر الاتصال، حاولي مرة ثانية"); }
    await store.clear();
    location.hash = "#/"; location.reload();
  };

  return (
    <div class="stack">
      <section class="card">
        <h3>خططي</h3>
        {!active.length ? <p class="empty">خططك في الطريق، ستظهر هنا قريبا.</p> : (
          <ul class="mo-list">
            {active.map((v) => <li key={v.id}><button class="mo-it" onClick={() => setView(v)}><b>{TYPE_AR[v.type]}</b><span class="note">من {fmtDate(v.start_date)}</span><span class="mo-go" aria-hidden="true">‹</span></button></li>)}
          </ul>
        )}
        {active.length > 0 && <button class="btn wide" onClick={() => { location.hash = "#/print/plan/" + c.user_id; }}>حفظ PDF</button>}
        {old.length > 0 && <details class="mo-old"><summary>خطط سابقة</summary>
          <ul class="mo-list">{old.map((v) => <li key={v.id}><button class="mo-it" onClick={() => setView(v)}><b>{TYPE_AR[v.type]}</b><span class="note">من {fmtDate(v.start_date)}</span><span class="mo-go" aria-hidden="true">‹</span></button></li>)}</ul>
        </details>}
      </section>

      <a class="card mo-link" href="#/recipes"><span aria-hidden="true">📖</span><b>كتاب الوصفات</b><span class="mo-go" aria-hidden="true">‹</span></a>
      {c.journey_finished_at && <a class="card mo-link mo-gift" href={"#/print/gift/" + c.user_id}><span aria-hidden="true">🎁</span><b>هديتك: كتاب رحلتك</b><span class="mo-go" aria-hidden="true">‹</span></a>}

      {notes.length > 0 && <section class="card">
        <h3>رسائل من مزيونة</h3>
        <ul class="mo-notes">{notes.map((n) => <li key={n.id}><span class="note">{fmtDate(n.date)}</span><p>{n.text}</p></li>)}</ul>
      </section>}

      <section class="card">
        <h3>خزانة الملابس</h3>
        <Wardrobe kind={c.mascot!} growth={growth(c, me.followups)} earned={itemsOf(me)} wardrobe={c.wardrobe} onChange={setWardrobe} />
        <button class="btn g wide" onClick={() => setPick(true)}>تغيير الرفيقة</button>
      </section>

      {me.settings.whatsapp && <a class="btn g wide" href={waLink(me.settings.whatsapp)} target="_blank" rel="noopener noreferrer">تواصلي معنا عبر واتساب</a>}
      <button class="btn r wide" onClick={logout}>تسجيل الخروج</button>

      {view && <Sheet title={TYPE_AR[view.type] + " من " + fmtDate(view.start_date)} onClose={() => setView(null)}>
        <Fit><PlanPages type={view.type} body={view.body} cycle_len={view.cycle_len} ctx={ctx} /></Fit>
      </Sheet>}
      {pick && <Sheet title="اختاري رفيقتك" onClose={() => setPick(false)}>
        <MascotPicker current={c.mascot} onPick={async (k) => { await pickMascot(k); setPick(false); }} />
      </Sheet>}
    </div>
  );
}
