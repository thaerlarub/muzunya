// First sign-in (and later from More): pick one of the four mascots, then confirm.
import { useRef, useState } from "preact/hooks";
import type { MascotKind } from "../../shared/types";
import { MASCOTS } from "../mascot/shapes";
import { Mascot, type MascotApi } from "../mascot/Mascot";
import "./game.css";

export function MascotPicker(p: { current?: MascotKind | null; onPick: (k: MascotKind) => void }) {
  const [sel, setSel] = useState<MascotKind | null>(p.current ?? null);
  const apis = useRef<Record<string, { current: MascotApi | null }>>(Object.fromEntries(MASCOTS.map((m) => [m.id, { current: null }]))).current;
  const choose = (k: MascotKind) => { setSel(k); apis[k].current?.hop(); };
  return (
    <section class="gm-pick">
      <h2>رفيقتك</h2>
      <p class="gm-pick-l">اختاري رفيقتك في الرحلة، تكبر معك كل ما تقدمتِ</p>
      <div class="gm-pick-grid">
        {MASCOTS.map((m) => (
          <button key={m.id} type="button" class="gm-pick-b" aria-pressed={sel === m.id} onClick={() => choose(m.id)}>
            <Mascot kind={m.id} growth={0.15} wear={[]} size={118} apiRef={apis[m.id]} />
            <b>{m.ar}</b>
          </button>
        ))}
      </div>
      <button class="btn wide" disabled={!sel || sel === p.current} onClick={() => sel && p.onPick(sel)}>
        {sel ? `اختيار ${MASCOTS.find((m) => m.id === sel)!.ar}` : "اختاري واحدة"}
      </button>
    </section>
  );
}
