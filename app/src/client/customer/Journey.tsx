// Journey: goal progress, path, gallery, badges.
import { latestWeight, progress } from "../../shared/badges";
import { JourneyPath } from "../game/JourneyPath";
import { BadgeShelf } from "../game/Badges";
import { Gallery } from "../Gallery";
import { uploadPhoto } from "../photo";
import { api } from "../api";
import { store, useMe } from "../store";

export function Journey() {
  const me = useMe(), c = me.customer;
  const lw = latestWeight(c, me.followups), pr = progress(c, me.followups);
  const kg = lw != null && c.w0 != null ? Math.round((lw - c.w0) * 10) / 10 : null;
  return (
    <div class="stack">
      <section class="card">
        <h3>رحلتي</h3>
        {pr != null && (
          <div class="jr-goal">
            <div class="jr-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pr * 100)}><i style={{ width: pr * 100 + "%" }} /></div>
            <p><b><bdo dir="ltr">{Math.round(pr * 100)}%</bdo></b> من الطريق إلى هدفك {c.goal_w} كجم</p>
          </div>
        )}
        {kg != null && <p class="note">بدأتِ بوزن {c.w0} كجم، وزنك الآن {lw} كجم{kg > 0 ? `، زدتِ ${kg} كجم` : ""}.</p>}
        {c.w0 != null && <JourneyPath w0={c.w0} latest={lw ?? c.w0} goal={c.goal_w} track={c.track} />}
      </section>
      <section class="card">
        <h3>صوري</h3>
        <Gallery
          photos={me.photos}
          canDelete={(p) => p.author === "customer"}
          onAdd={async (file, date, caption) => { const ph = await uploadPhoto({ file, date, caption }); store.set({ photos: [...store.me.photos, ph] }); }}
          onDelete={async (p) => { await api.del(`/api/photos/${encodeURIComponent(p.id)}`); store.set({ photos: store.me.photos.filter((x) => x.id !== p.id) }); }}
        />
      </section>
      <section class="card">
        <h3>أوسمتي</h3>
        <BadgeShelf earned={me.badges} />
      </section>
    </div>
  );
}
