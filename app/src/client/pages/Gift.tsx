// Gift PDF: printable A4 keepsake at the end of the journey (browser print to PDF).
import { useEffect, useRef, useState } from "preact/hooks";
import type { AdminCustomer, MeAdmin, MeCustomer, WearItem } from "../../shared/types";
import { diffDays, todayMuscat } from "../../shared/dates";
import { BADGE_ITEM, latestWeight } from "../../shared/badges";
import { growth } from "../../shared/growth";
import { api, photoUrl } from "../api";
import { fmtDate } from "../ui";
import { Mascot, wornItems } from "../mascot/Mascot";
import { WeightChart, SizesCompare } from "../charts";
import { BadgeShelf } from "../game/Badges";
import "../customer/customer.css";

type Data = Pick<AdminCustomer, "customer" | "followups" | "photos" | "badges">;

export function Gift(p: { cid: string; me: MeAdmin | MeCustomer }) {
  const own = "customer" in p.me ? p.me : null;
  const [d, setD] = useState<Data | null>(own && own.customer.user_id === p.cid ? own : null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (d) return;
    if (p.me.user.role !== "admin") return setErr(true); // a customer only ever gets her own
    api.get<AdminCustomer>(`/api/admin/customers/${encodeURIComponent(p.cid)}`).then(setD, () => setErr(true));
  }, [p.cid]);
  const printed = useRef(false);
  useEffect(() => {
    if (!d || printed.current) return;
    printed.current = true;
    (async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
      setTimeout(() => print(), 300);
    })();
  }, [d]);
  const back = () => { if (history.length > 1) history.back(); else location.hash = "#/"; };
  if (err) return <div class="empty">تعذر تحميل الهدية. <button class="btn g" onClick={back}>رجوع</button></div>;
  if (!d) return <div class="loading">مزيونة</div>;

  const c = d.customer;
  const wear: WearItem[] = [...new Set([...wornItems(d.badges.map((b) => BADGE_ITEM[b.badge]), c.wardrobe), "crown" as WearItem])];
  const fus = [...d.followups].sort((a, b) => a.date.localeCompare(b.date));
  const pts = [...(c.w0 ? [{ d: c.start_date, w: c.w0 }] : []), ...fus.filter((f) => f.weight).map((f) => ({ d: f.date, w: f.weight! }))];
  const lw = latestWeight(c, d.followups);
  const total = lw != null && c.w0 != null ? Math.round((lw - c.w0) * 10) / 10 : null;
  const end = c.journey_finished_at ?? todayMuscat();
  const weeks = Math.max(1, Math.round(diffDays(end, c.start_date) / 7));
  const sized = fus.filter((f) => f.arm || f.chest || f.waist || f.hips || f.thigh);
  const photos = [...d.photos].sort((a, b) => a.date.localeCompare(b.date) || a.created_at - b.created_at);
  const groups: typeof photos[] = [];
  for (let i = 0; i < photos.length; i += 4) groups.push(photos.slice(i, i + 4));

  return (
    <div class="gift">
      <div class="gf-bar noprint">
        <button class="btn" onClick={() => print()}>حفظ PDF</button>
        <button class="btn g" onClick={back}>رجوع</button>
        <span class="note">اختاري "حفظ كملف PDF" من نافذة الطباعة.</span>
      </div>

      <section class="gf-page gf-cover">
        <div class="logo">مزيونة</div>
        <p class="gf-tl">رحلة</p>
        <h1>{c.name}</h1>
        <div class="gf-masc"><Mascot kind={c.mascot ?? "girl"} growth={growth(c, d.followups)} wear={wear} sleepy={false} size={300} /></div>
        <p class="gf-dates">من {fmtDate(c.start_date)} إلى {fmtDate(end)}</p>
      </section>

      <section class="gf-page">
        <h2 class="gf-h">رحلتك بالأرقام</h2>
        <div class="gf-kpis">
          <div><span>وزن البداية</span><b>{c.w0 ?? "-"} كجم</b></div>
          <div><span>الوزن الأخير</span><b>{lw ?? "-"} كجم</b></div>
          <div><span>المجموع</span><b>{total == null ? "-" : (total > 0 ? "+" : "") + total} كجم</b></div>
          <div><span>الأسابيع</span><b>{weeks}</b></div>
        </div>
        <div class="gf-chart"><WeightChart points={pts} goal={c.goal_w} /></div>
        <h2 class="gf-h">مقاساتك قبل وبعد</h2>
        <SizesCompare first={sized[0] ?? null} last={sized[sized.length - 1] ?? null} />
      </section>

      {groups.map((g, i) => (
        <section class="gf-page" key={i}>
          <h2 class="gf-h">لحظات من رحلتك</h2>
          <div class="gf-photos">
            {g.map((ph) => <figure key={ph.id}><img src={photoUrl(ph.id)} alt="" /><figcaption><b>{fmtDate(ph.date)}</b>{ph.caption && <span>{ph.caption}</span>}</figcaption></figure>)}
          </div>
        </section>
      ))}

      <section class="gf-page">
        <h2 class="gf-h">أوسمتك</h2>
        <BadgeShelf earned={d.badges} />
      </section>

      {c.letter && <section class="gf-page gf-letter">
        <h2 class="gf-h">رسالة لك</h2>
        <div class="gf-text">{c.letter}</div>
        <p class="gf-sign">مع حب، مزيونة</p>
      </section>}
    </div>
  );
}
