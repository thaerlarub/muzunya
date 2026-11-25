// #/print/plan/<cid>: today's active meal pages, then exercise pages, printed with the browser (A4, no margins).
import { useEffect, useRef, useState } from "preact/hooks";
import type { AdminCustomer, Customer, Exercise, Followup, MeAdmin, MeCustomer, PlanVersion, Settings } from "../../shared/types";
import { api, photoUrl } from "../api";
import { activeOf, todayMuscat } from "../../shared/dates";
import { latestWeight } from "../../shared/badges";
import { Fit, PlanPages } from "./PlanPages";

interface Data { customer: Customer; versions: PlanVersion[]; followups: Followup[]; exercises: Exercise[]; settings: Settings }

export function Print(p: { cid: string; me: MeAdmin | MeCustomer }) {
  const [d, setD] = useState<Data | null | "no">(null);
  const printed = useRef(false);
  const admin = p.me.user.role === "admin";

  useEffect(() => {
    (async () => {
      if (admin) {
        const [a, ex] = await Promise.all([api.get<AdminCustomer>("/api/admin/customers/" + encodeURIComponent(p.cid)), api.get<Exercise[]>("/api/admin/exercises")]);
        setD({ customer: a.customer, versions: a.versions, followups: a.followups, exercises: ex, settings: p.me.settings });
      } else {
        const m = p.me as MeCustomer;
        setD(p.cid === m.customer.user_id ? { customer: m.customer, versions: m.versions, followups: m.followups, exercises: m.exercises, settings: m.settings } : "no");
      }
    })().catch(() => setD("no"));
  }, [p.cid]);

  const today = todayMuscat();
  const ok = d && d !== "no" ? d : null;
  const meal = ok ? activeOf(ok.versions, "meal", today) : null;
  const ex = ok ? activeOf(ok.versions, "exercise", today) : null;

  useEffect(() => {
    if (!ok) return;
    const t = document.title;
    document.title = "خطة مزيونة - " + ok.customer.name;
    return () => { document.title = t; };
  }, [ok?.customer.name]);

  useEffect(() => {
    if (!ok || printed.current || (!meal && !ex)) return;
    printed.current = true;
    (async () => {
      await document.fonts.ready;
      await Promise.all([...document.querySelectorAll<HTMLImageElement>(".page img")].map((i) => i.decode().catch(() => {})));
      requestAnimationFrame(() => window.print());
    })();
  }, [ok, meal, ex]);

  const back = (e: Event) => { if (history.length > 1) { e.preventDefault(); history.back(); } };
  const bar = (
    <div class="noprint" style="position:sticky;top:0;z-index:5;background:#fff;border-bottom:3px solid var(--a);padding:8px 14px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <a class="btn g" href={admin ? `#/c/${p.cid}/meal` : "#/"} onClick={back}>رجوع</a>
      {ok && (meal || ex) && <button class="btn" onClick={() => window.print()}>حفظ PDF</button>}
      <span class="note">اختاري «حفظ بصيغة PDF» من نافذة الطباعة.</span>
    </div>
  );
  if (d === null) return <>{bar}<div class="loading">مزيونة</div></>;
  if (!ok) return <>{bar}<p class="empty">تعذر فتح الخطة.</p></>;
  if (!meal && !ex) return <>{bar}<p class="empty">لا توجد خطة فعالة اليوم.</p></>;
  const ctx = { customer: ok.customer, weight: latestWeight(ok.customer, ok.followups), settings: ok.settings, exercises: ok.exercises, photoUrl };
  return (
    <>
      {bar}
      <div style="padding:14px" class="prt">
        <Fit>
          {meal && <PlanPages type="meal" body={meal.body} cycle_len={meal.cycle_len} ctx={ctx} date={meal.start_date} />}
          {ex && <PlanPages type="exercise" body={ex.body} cycle_len={ex.cycle_len} ctx={ctx} date={ex.start_date} />}
        </Fit>
      </div>
    </>
  );
}
