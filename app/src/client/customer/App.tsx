// Customer shell: header, bottom tabs, first-run mascot picker, badge reveal.
import { useMemo } from "preact/hooks";
import type { MeCustomer, MascotKind } from "../../shared/types";
import { api } from "../api";
import { toast } from "../ui";
import { store, useMe } from "../store";
import { growth } from "../../shared/growth";
import { BADGE_ITEM } from "../../shared/badges";
import { wornItems } from "../mascot/Mascot";
import { MascotPicker } from "../game/MascotPicker";
import { BadgeReveal } from "../game/Badges";
import { Today } from "./Today";
import { Followup } from "./Followup";
import { Journey } from "./Journey";
import { More } from "./More";
import { RecipeBook } from "./RecipeBook";
import "./customer.css";

export const waLink = (num: string, text?: string) => `https://wa.me/${num.replace(/\D/g, "")}${text ? "?text=" + encodeURIComponent(text) : ""}`;

/** Items she has earned. */
export const itemsOf = (me: MeCustomer) => me.badges.map((b) => BADGE_ITEM[b.badge]);
/** Items she has earned and switched on. */
export const wearOf = (me: MeCustomer) => wornItems(itemsOf(me), me.customer.wardrobe);

export async function pickMascot(kind: MascotKind) {
  try { await api.put("/api/me/mascot", { mascot: kind }); store.patchCustomer({ mascot: kind }); }
  catch { toast("تعذر الحفظ، تأكدي من الإنترنت"); }
}

const TABS: [string, string, string][] = [
  ["/", "اليوم", "M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8"],
  ["/followup", "المتابعة", "M4 19h16M6 16l4-5 3 3 5-7"],
  ["/journey", "رحلتي", "M5 20c0-6 14-4 14-10a4 4 0 0 0-8 0M5 20h.01"],
  ["/more", "المزيد", "M5 12h.01M12 12h.01M19 12h.01"],
];

export function CustomerApp(p: { me: MeCustomer; hash: string; reload: () => void }) {
  useMemo(() => store.init(p.me), [p.me]);
  const me = useMe();
  const c = me.customer, wa = me.settings.whatsapp;
  if (!c.mascot) return <div class="cu-first"><MascotPicker current={null} onPick={pickMascot} /></div>;
  const route = p.hash.split("?")[0];
  const reveal = store.reveal;
  const pend = store.pending();
  return (
    <div class="cu">
      <header class="cu-head">
        <div class="logo">مزيونة</div>
        <span class={"cu-sync" + (pend ? " on" : "")} role="status" aria-label={pend ? "تغييرات ستحفظ عند الاتصال" : "كل شيء محفوظ"} title={pend ? "ستحفظ عند الاتصال" : "محفوظ"} />
        <span class="cu-sp" />
        {wa && <a class="cu-wa" href={waLink(wa)} target="_blank" rel="noopener noreferrer" aria-label="تواصلي معنا عبر واتساب">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /><path d="M9 9.5c.3 2.2 2.3 4.2 4.5 4.5l1-1.2 1.8.8-.4 1.6c-3.5.3-7.6-3.8-7.3-7.3L10.2 7.5l.8 1.8z" fill="currentColor" /></svg>
          <span>واتساب</span>
        </a>}
      </header>
      <main class="cu-main">
        {route === "/followup" ? <Followup /> : route === "/journey" ? <Journey /> : route === "/more" ? <More /> : route === "/recipes" ? <RecipeBook /> : <Today />}
      </main>
      <nav class="cu-tabs" aria-label="الأقسام">
        {TABS.map(([h, n, d]) => {
          const on = route === h || (h === "/more" && route === "/recipes");
          return <a key={h} href={"#" + h} class={on ? "on" : ""} aria-current={on ? "page" : undefined}>
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
            <span>{n}</span>
          </a>;
        })}
      </nav>
      {reveal && <BadgeReveal badge={reveal} kind={c.mascot} growth={growth(c, me.followups)} wear={wearOf(me)} onClose={() => store.shiftReveal()} />}
    </div>
  );
}

/** Arabic count of days: 1 يوم واحد, 2 يومان, 3 to 10 أيام, 11+ يوما. */
export const days = (n: number) => n === 1 ? "يوم واحد" : n === 2 ? "يومان" : n <= 10 ? `${n} أيام` : `${n} يوما`;
