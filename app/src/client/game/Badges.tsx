// Badge shelf (all six, earned in colour) and the gentle reveal overlay for a new badge.
import { useEffect, useRef } from "preact/hooks";
import type { Badge, BadgeId, MascotKind, WearItem } from "../../shared/types";
import { BADGE_ITEM, BADGE_NAME } from "../../shared/badges";
import { itemPrims, WEAR_AR } from "../mascot/shapes";
import { softSvg } from "../mascot/render";
import { Mascot, type MascotApi } from "../mascot/Mascot";
import "./game.css";

export const BADGES: BadgeId[] = ["week1", "kg1", "streak7", "perfect", "half", "finish"];
export const ItemIcon = (p: { item: WearItem }) => <span class="gm-item" dangerouslySetInnerHTML={{ __html: softSvg(itemPrims(p.item), "34 34 32 32") }} />;
const day = (ms: number) => new Date(ms).toLocaleDateString("ar-OM-u-nu-latn", { day: "numeric", month: "short", timeZone: "Asia/Muscat" });

export function BadgeShelf(p: { earned: Badge[] }) {
  return (
    <ul class="gm-shelf">
      {BADGES.map((id) => {
        const b = p.earned.find((x) => x.badge === id);
        return (
          <li key={id} class={b ? "gm-badge on" : "gm-badge"}>
            <span class="gm-medal"><ItemIcon item={BADGE_ITEM[id]} /></span>
            <b>{BADGE_NAME[id]}</b>
            <small>{b ? day(b.earned_at) : "بانتظارك"}</small>
          </li>
        );
      })}
    </ul>
  );
}

export function BadgeReveal(p: { badge: BadgeId; kind: MascotKind; growth: number; wear: WearItem[]; onClose: () => void }) {
  const api = useRef<MascotApi | null>(null), btn = useRef<HTMLButtonElement>(null), item = BADGE_ITEM[p.badge];
  useEffect(() => {
    btn.current?.focus();
    const t = setTimeout(() => { api.current?.reveal(item); api.current?.hop(); }, 250);
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") p.onClose(); };
    addEventListener("keydown", k);
    return () => { clearTimeout(t); removeEventListener("keydown", k); };
  }, [p.badge]);
  return (
    <div class="gm-reveal" role="dialog" aria-modal="true" aria-labelledby="gm-rv-t">
      <div class="gm-rv-card">
        <p class="gm-rv-k">شارة جديدة</p>
        <Mascot key={p.badge} kind={p.kind} growth={p.growth} wear={p.wear.filter((w) => w !== item)} size={200} apiRef={api} />
        <h2 id="gm-rv-t">{BADGE_NAME[p.badge]}</h2>
        <p class="gm-rv-l">هديتك الجديدة: {WEAR_AR[item]}</p>
        <button ref={btn} class="btn wide" onClick={p.onClose}>شكرا</button>
      </div>
    </div>
  );
}
