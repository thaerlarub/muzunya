// Wardrobe: mascot preview plus a switch per earned item; locked items name the badge that unlocks them.
import { useRef } from "preact/hooks";
import type { BadgeId, MascotKind, Wardrobe as WardrobeT, WearItem } from "../../shared/types";
import { BADGE_ITEM, BADGE_NAME } from "../../shared/badges";
import { WEAR, WEAR_AR } from "../mascot/shapes";
import { Mascot, wornItems, type MascotApi } from "../mascot/Mascot";
import { ItemIcon } from "./Badges";
import "./game.css";

const badgeOf = (i: WearItem) => (Object.keys(BADGE_ITEM) as BadgeId[]).find((b) => BADGE_ITEM[b] === i)!;

export function Wardrobe(p: { kind: MascotKind; growth: number; earned: WearItem[]; wardrobe: WardrobeT; onChange: (w: WardrobeT) => void }) {
  const api = useRef<MascotApi | null>(null), worn = wornItems(p.earned, p.wardrobe);
  const toggle = (i: WearItem) => {
    const on = !worn.includes(i);
    p.onChange({ ...p.wardrobe, [i]: on });
    if (on) api.current?.reveal(i);
  };
  return (
    <section class="gm-ward">
      <Mascot kind={p.kind} growth={p.growth} wear={worn} size={190} apiRef={api} />
      <ul class="gm-ward-l">
        {WEAR.map((i) => {
          const has = p.earned.includes(i), on = worn.includes(i);
          return (
            <li key={i}>
              {has ? (
                <button type="button" class="gm-ward-b" role="switch" aria-checked={on} onClick={() => toggle(i)}>
                  <ItemIcon item={i} /><span class="gm-ward-n">{WEAR_AR[i]}</span><span class="gm-sw" aria-hidden="true" />
                </button>
              ) : (
                <div class="gm-ward-b locked">
                  <ItemIcon item={i} />
                  <span class="gm-ward-n">{WEAR_AR[i]}<small>تفتحها شارة {BADGE_NAME[badgeOf(i)]}</small></span>
                  <svg class="gm-lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
