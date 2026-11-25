// Today: mascot, rings, streak, week stats, meal and exercise checklists for a chosen day.
import { useRef, useState } from "preact/hooks";
import type { DayBody, ExDay, MealBody, Slot } from "../../shared/types";
import { activeOf, addDays, canTick, diffDays, planDay, todayMuscat } from "../../shared/dates";
import { targets, stripTokens } from "../../shared/portions";
import { dayMealPct, lastTickDate, streak, weekStats, workoutDone } from "../../shared/stats";
import { latestWeight } from "../../shared/badges";
import { growth } from "../../shared/growth";
import { packageDaysLeft, packageDue, packageEnd } from "../../shared/pkg";
import { Mascot, type MascotApi } from "../mascot/Mascot";
import { Rings } from "../game/Rings";
import { store, useMe } from "../store";
import { fmtDate } from "../ui";
import { days, waLink, wearOf } from "./App";

const val = (b: DayBody, k: string) => b[k]?.[0] ?? 0;

export function Today() {
  const me = useMe(), c = me.customer, today = todayMuscat();
  const [d, setD] = useState(today);
  const mascot = useRef<MascotApi | null>(null);

  const mv = activeOf(me.versions, "meal", d), xv = activeOf(me.versions, "exercise", d);
  const starts = (["meal", "exercise"] as const).map((t) => activeOf(me.versions, t, today)?.start_date).filter(Boolean) as string[];
  const min = starts.length ? starts.sort()[0] : today;
  const body = me.logs.find((l) => l.date === d)?.body ?? {};
  const mealOk = canTick(me.versions, "m:x", d, today), exOk = canTick(me.versions, "x:0", d, today);

  const slots: Slot[] = mv ? (mv.body as MealBody).slots ?? [] : [];
  const { f } = targets({ w: latestWeight(c, me.followups), h: c.height, act: c.act, sur: c.sur, man: c.man_kcal, muzunaKcal: me.settings.muzuna_kcal });
  const pday = mv ? planDay(mv, d) : 1;
  const exDay: ExDay | null = xv ? (xv.body as { days: ExDay[] }).days?.[planDay(xv, d) - 1] ?? null : null;
  const items = exDay && !exDay.rest ? exDay.items : [];
  const mealPct = dayMealPct(body, slots);
  const wkPct = items.length ? items.filter((_, i) => val(body, "x:" + i) >= 1).length / items.length : null;

  const st = streak(me.logs, today), wk = weekStats(me.versions, me.logs, today);
  const last = lastTickDate(me.logs);
  const sleepy = diffDays(today, last ?? c.start_date) >= 2;
  const end = packageEnd(me.orders);

  const tick = (key: string, v: number) => store.tick(d, key, v);
  const toggleSlot = (s: Slot, el: HTMLElement) => {
    const on = val(body, "m:" + s.id) >= 1;
    tick("m:" + s.id, on ? 0 : 1);
    if (!on) {
      mascot.current?.feed(el, s.icon);
      if (dayMealPct(store.me.logs.find((l) => l.date === d)!.body, slots) === 1) setTimeout(() => mascot.current?.hop(), 900);
    }
  };
  const toggleEx = (i: number) => {
    const on = val(body, "x:" + i) >= 1;
    tick("x:" + i, on ? 0 : 1);
    if (!on) {
      if (workoutDone(store.me.logs.find((l) => l.date === d)!.body, exDay)) mascot.current?.hop();
      else mascot.current?.flex();
    }
  };

  return (
    <div class="stack">
      {packageDue(end, today) && <PkgBanner left={packageDaysLeft(end!, today)} wa={me.settings.whatsapp} />}

      <section class="cu-hero card">
        <Mascot kind={c.mascot!} growth={growth(c, me.followups)} wear={wearOf(me)} sleepy={sleepy} size={140} apiRef={mascot} />
        <Rings meals={mealPct} workout={wkPct} />
      </section>

      <section class="cu-stats">
        <div class="card cu-stat">
          <b>{st.cur ? "سلسلة " + days(st.cur) : "ابدئي سلسلة جديدة اليوم"}</b>
          {st.best > 0 && <span class="note">أفضل سلسلة: {days(st.best)}</span>}
        </div>
        <div class="card cu-stat">
          <b>وجبات الأسبوع <bdo dir="ltr">{Math.round(wk.mealPct * 100)}%</bdo></b>
          <span class="note">{wk.workoutsPlanned ? `تمارين ${wk.workoutsDone} من ${wk.workoutsPlanned}` : "لا تمارين هذا الأسبوع"}</span>
        </div>
      </section>

      <div class="cu-date card" role="group" aria-label="اختيار اليوم">
        <button class="cu-arr" aria-label="اليوم السابق" disabled={d <= min} onClick={() => setD(addDays(d, -1))}>‹</button>
        <div class="cu-dl"><b>{d === today ? "اليوم" : d === addDays(today, -1) ? "أمس" : fmtDate(d)}</b><span class="note">{fmtDate(d)}</span></div>
        <button class="cu-arr" aria-label="اليوم التالي" disabled={d >= today} onClick={() => setD(addDays(d, 1))}>›</button>
        {d !== today && <button class="btn g sm" onClick={() => setD(today)}>اليوم</button>}
      </div>

      <section class="card">
        <h3>وجباتي</h3>
        {!mv ? <p class="empty">خطتك الغذائية في الطريق، ستظهر هنا قريبا.</p> : (
          <>
            {!mealOk && <p class="note cu-ro">هذا اليوم من خطة سابقة، للعرض فقط.</p>}
            <ul class="cu-list">
              {slots.map((s) => s.kind === "counter"
                ? <Water key={s.id} s={s} n={val(body, "m:" + s.id)} ro={!mealOk} set={(n) => tick("m:" + s.id, n)} />
                : <SlotRow key={s.id} s={s} on={val(body, "m:" + s.id) >= 1} ro={!mealOk} sub={slotText(s, pday, f)} toggle={toggleSlot} />)}
            </ul>
          </>
        )}
      </section>

      <section class="card">
        <h3>{exDay && !exDay.rest ? exDay.title : "تماريني"}</h3>
        {!xv ? <p class="empty">خطة التمارين في الطريق.</p>
          : !exDay || exDay.rest ? (
            <div class="cu-rest"><span aria-hidden="true">🌙</span><div><b>يوم راحة</b><p class="note">{exDay?.rest && exDay.note ? exDay.note : "العضلات تكبر وقت الراحة، استمتعي بيومك."}</p></div></div>
          ) : (
            <>
              {!exOk && <p class="note cu-ro">هذا اليوم من خطة سابقة، للعرض فقط.</p>}
              <ul class="cu-list">
                {items.map((it, i) => {
                  const lib = it.ex ? me.exercises.find((e) => e.id === it.ex) : undefined;
                  const on = val(body, "x:" + i) >= 1;
                  return (
                    <li key={i} class={"cu-ex" + (on ? " on" : "")}>
                      <button class="cu-row" disabled={!exOk} aria-pressed={on} onClick={() => toggleEx(i)}>
                        <Check on={on} />
                        <span class="cu-txt">
                          <b>{lib?.name_ar ?? it.name ?? "تمرين"}</b>
                          {lib?.name_en && <span class="cu-en" dir="ltr" lang="en">{lib.name_en}</span>}
                          <span class="note">{it.sets} مجموعات × {it.reps}، راحة {it.rest}</span>
                          {it.note && <span class="note">{it.note}</span>}
                        </span>
                      </button>
                      <div class="cu-exf">
                        {lib?.video_url && <a class="btn g sm" href={lib.video_url} target="_blank" rel="noopener noreferrer">شاهدي الفيديو</a>}
                        <label class="cu-kg">
                          <input type="number" inputMode="decimal" min="0" step="0.5" disabled={!exOk} value={val(body, "kg:" + i) || ""} placeholder="0"
                            onChange={(e) => tick("kg:" + i, Math.min(500, Math.max(0, +e.currentTarget.value || 0)))} aria-label="الوزن المستخدم بالكيلو" />
                          <span>كجم</span>
                        </label>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
      </section>
    </div>
  );
}

function slotText(s: Slot, pday: number, f: number): string {
  if (s.kind === "rotation") return stripTokens(s.items?.[pday - 1] ?? "", f);
  if (s.kind === "fixed") return stripTokens(s.text ?? "", f);
  return ""; // choose: the slot name says it, the options are in her plan
}

const Check = (p: { on: boolean }) => (
  <span class={"cu-chk" + (p.on ? " on" : "")} aria-hidden="true">
    <svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg>
  </span>
);

function SlotRow(p: { s: Slot; on: boolean; ro: boolean; sub: string; toggle: (s: Slot, el: HTMLElement) => void }) {
  return (
    <li class={"cu-slot" + (p.on ? " on" : "")}>
      <button class="cu-row" disabled={p.ro} aria-pressed={p.on} onClick={(e) => p.toggle(p.s, e.currentTarget)}>
        <span class="cu-ic" aria-hidden="true">{p.s.icon}</span>
        <span class="cu-txt"><b>{p.s.name}</b>{p.sub && <span class="note">{p.sub}</span>}</span>
        <Check on={p.on} />
      </button>
    </li>
  );
}

function Water(p: { s: Slot; n: number; ro: boolean; set: (n: number) => void }) {
  const t = p.s.target || 8;
  return (
    <li class="cu-water">
      <div class="cu-wh"><span class="cu-ic" aria-hidden="true">{p.s.icon}</span><b>{p.s.name}</b><span class="note">{p.n} من {t}</span></div>
      <div class="cu-glasses">
        {Array.from({ length: t }, (_, i) => {
          const full = i < p.n;
          return <button key={i} class={"cu-gl" + (full ? " on" : "")} disabled={p.ro} aria-label={`كوب ${i + 1}`} aria-pressed={full}
            onClick={() => p.set(i + 1 === p.n ? p.n - 1 : i + 1)}>
            <svg viewBox="0 0 24 30" width="22" height="28" aria-hidden="true"><path d="M3 3h18l-2.2 23.5a2 2 0 0 1-2 1.5H7.2a2 2 0 0 1-2-1.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" /><path class="cu-wf" d="M5.2 11h13.6l-1.5 15.2a1 1 0 0 1-1 .8H7.7a1 1 0 0 1-1-.8z" /></svg>
          </button>;
        })}
      </div>
    </li>
  );
}

function PkgBanner(p: { left: number; wa: string }) {
  const msg = p.left > 0 ? `باقتك تنتهي خلال ${days(p.left)}` : p.left === 0 ? "باقتك تنتهي اليوم" : "انتهت باقتك، نحب نكمل رحلتك معنا";
  return (
    <div class="cu-pkg card">
      <span>{msg}</span>
      {p.wa && <a class="btn sm" href={waLink(p.wa, "أرغب في تجديد باقة مزيونة")} target="_blank" rel="noopener noreferrer">جددي عبر واتساب</a>}
    </div>
  );
}
