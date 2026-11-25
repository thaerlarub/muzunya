// Journey tab: goal, progress, badges, finish with a letter, gift PDF.
import { useState } from "preact/hooks";
import { api } from "../api";
import { ConfirmButton, Field, fmtDate, toast } from "../ui";
import { latestWeight, progress } from "../../shared/badges";
import { BadgeShelf } from "../game/Badges";
import { num } from "./List";
import type { TabProps } from "./Customer";

export function JourneyAdmin({ d, reload }: TabProps) {
  const c = d.customer, base = `/api/admin/customers/${encodeURIComponent(c.user_id)}`;
  const [goal, setGoal] = useState(c.goal_w == null ? "" : String(c.goal_w)), [letter, setLetter] = useState(c.letter ?? ""), [busy, setBusy] = useState(false);
  const w = latestWeight(c, d.followups), pr = progress(c, d.followups);
  const reached = c.goal_w != null && w != null && w >= c.goal_w;
  const run = async (f: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await f(); toast(ok); await reload(); } catch { toast("تعذر تنفيذ الطلب"); } finally { setBusy(false); }
  };
  return (
    <div class="stack">
      <div class="card stack">
        <h3>الهدف</h3>
        <form class="row" onSubmit={(e) => { e.preventDefault(); run(() => api.put(base, { goal_w: num(goal) }), "تم حفظ الهدف"); }}>
          <input class="grow" type="number" inputMode="decimal" step="0.1" placeholder="الوزن المستهدف (كغ)" aria-label="الوزن المستهدف" value={goal} onInput={(e) => setGoal(e.currentTarget.value)} />
          <button class="btn" disabled={busy}>حفظ</button>
        </form>
        <div class="kpis">
          <span>البداية <b>{c.w0 ?? "-"} كغ</b></span>
          <span>الآن <b>{w ?? "-"} كغ</b></span>
          <span>التغير <b>{w != null && c.w0 != null ? (w - c.w0 > 0 ? "+" : "") + (Math.round((w - c.w0) * 10) / 10) : "-"} كغ</b></span>
        </div>
        {pr != null && (
          <div class="prog" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pr * 100)}>
            <i style={{ width: pr * 100 + "%" }} /><span>{Math.round(pr * 100)}%</span>
          </div>
        )}
        {reached && !c.journey_finished_at && <p class="chip ok">وصلت للهدف 🎉 يمكنك إنهاء الرحلة الآن.</p>}
      </div>

      <div class="card"><h3>الأوسمة</h3><BadgeShelf earned={d.badges} /></div>

      <div class="card stack">
        <h3>نهاية الرحلة</h3>
        {c.journey_finished_at ? (
          <>
            <p>انتهت الرحلة في <b>{fmtDate(c.journey_finished_at)}</b>.</p>
            {c.letter && <div class="letter pre">{c.letter}</div>}
            <div class="row">
              <a class="btn" href={`#/print/gift/${c.user_id}`} target="_blank" rel="noopener">فتح PDF الهدية</a>
              <ConfirmButton class="btn g" label="التراجع عن الإنهاء" confirm="اضغط للتأكيد" onConfirm={() => run(() => api.post(base + "/unfinish"), "تم التراجع")} />
            </div>
          </>
        ) : (
          <>
            <Field label="رسالة الختام (تظهر في آخر صفحة من الهدية)"><textarea rows={6} value={letter} onInput={(e) => setLetter(e.currentTarget.value)} /></Field>
            {letter.trim() && <><p class="note">معاينة</p><div class="letter pre">{letter}</div></>}
            <ConfirmButton class="btn" label="إنهاء الرحلة" confirm="متأكد؟ اضغط مرة ثانية" onConfirm={() => run(() => api.post(base + "/finish", { letter: letter.trim() }), "انتهت الرحلة، مبروك لها")} />
          </>
        )}
      </div>
    </div>
  );
}
