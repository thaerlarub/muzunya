// One customer: loads her data once and hands it to the tabs.
import { useEffect, useState } from "preact/hooks";
import { api, photoUrl } from "../api";
import { toast } from "../ui";
import type { AdminCustomer, Exercise, MeAdmin, PlanCtx, Photo, Settings } from "../../shared/types";
import { latestWeight } from "../../shared/badges";
import { Gallery } from "../Gallery";
import { uploadPhoto } from "../photo";
import { PlanEditor } from "./PlanEditor";
import { Profile } from "./Profile";
import { Ticks } from "./Ticks";
import { FollowupsAdmin } from "./FollowupsAdmin";
import { Notes } from "./Notes";
import { JourneyAdmin } from "./JourneyAdmin";

const TABS: [string, string][] = [["profile", "الملف"], ["meal", "الخطة الغذائية"], ["exercise", "الخطة الرياضية"], ["ticks", "التسجيل"], ["followups", "المتابعة"], ["photos", "الصور"], ["notes", "الملاحظات"], ["journey", "الرحلة"]];

/** What every tab gets: her data and a way to reload it after a change. */
export interface TabProps { d: AdminCustomer; reload: () => Promise<void>; settings: Settings; exercises: Exercise[] }

export function CustomerPage(p: { id: string; tab: string; me: MeAdmin }) {
  const [d, setD] = useState<AdminCustomer | null>(null), [ex, setEx] = useState<Exercise[]>([]), [err, setErr] = useState(false);
  const base = `/api/admin/customers/${encodeURIComponent(p.id)}`;
  const reload = () => api.get<AdminCustomer>(base).then(setD, () => { setErr(true); toast("تعذر تحميل بياناتها"); });
  useEffect(() => { reload(); api.get<Exercise[]>("/api/admin/exercises").then(setEx, () => {}); }, [p.id]);
  useEffect(() => { document.querySelector(".tabs a.on")?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [p.tab, !!d]);
  if (err && !d) return <p class="empty">تعذر تحميل الزبونة. <a href="#/">العودة للقائمة</a></p>;
  if (!d) return <p class="empty">جاري التحميل...</p>;

  const c = d.customer, t = p.tab;
  const ctx: PlanCtx = { customer: c, weight: latestWeight(c, d.followups), settings: p.me.settings, exercises: ex, photoUrl };
  const tp: TabProps = { d, reload, settings: p.me.settings, exercises: ex };
  return (
    <div class="stack">
      <div class="chead">
        <a class="back" href="#/" aria-label="القائمة">→</a>
        <h2>{c.name}</h2>
        {c.status === "archived" && <span class="chip">مؤرشفة</span>}
      </div>
      <nav class="tabs" aria-label="أقسام الزبونة">
        {TABS.map(([k, n]) => <a href={`#/c/${c.user_id}/${k}`} class={t === k ? "on" : ""} aria-current={t === k ? "page" : undefined}>{n}</a>)}
      </nav>
      {t === "profile" && <Profile {...tp} />}
      {(t === "meal" || t === "exercise") && <PlanEditor key={t} customer={c} type={t} versions={d.versions.filter((v) => v.type === t)} ctx={ctx} onSaved={reload} />}
      {t === "ticks" && <Ticks {...tp} />}
      {t === "followups" && <FollowupsAdmin {...tp} />}
      {t === "photos" && (
        <Gallery photos={d.photos} canDelete={() => true}
          onAdd={async (file, date, caption) => { await uploadPhoto({ file, date, caption, customer_id: c.user_id }); await reload(); }}
          onDelete={async (ph: Photo) => { await api.del(`/api/photos/${encodeURIComponent(ph.id)}`); await reload(); }} />
      )}
      {t === "notes" && <Notes {...tp} />}
      {t === "journey" && <JourneyAdmin {...tp} />}
    </div>
  );
}
