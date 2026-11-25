// Two concentric progress rings: meals (outer) and workout (inner, a moon on rest days).
import { useEffect, useState } from "preact/hooks";
import "./game.css";

const pct = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 100);

export function Rings(p: { meals: number; workout: number | null; size?: number }) {
  const size = p.size ?? 132, rest = p.workout == null;
  // Start empty, then fill, so the first paint animates too.
  const [on, setOn] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(r); }, []);
  const off = (v: number) => 100 - (on ? pct(v) : 0);
  return (
    <div class="gm-rings">
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        <circle class="gm-tr" cx="50" cy="50" r="42" />
        <circle class="gm-fl" cx="50" cy="50" r="42" pathLength={100} style={`stroke-dashoffset:${off(p.meals)}`} />
        <circle class="gm-tr" cx="50" cy="50" r="29" />
        {!rest && <circle class="gm-fl gm-wk" cx="50" cy="50" r="29" pathLength={100} style={`stroke-dashoffset:${off(p.workout!)}`} />}
        {rest && <path class="gm-moon" d="M55 38a13 13 0 1 0 9 21 11 11 0 0 1-9-21z" />}
      </svg>
      <div class="gm-legend">
        <span><i class="gm-dot" />الوجبات <b dir="ltr">{pct(p.meals)}%</b></span>
        <span><i class="gm-dot gm-wk" />التمرين {rest ? <b>يوم راحة</b> : <b dir="ltr">{pct(p.workout!)}%</b>}</span>
      </div>
    </div>
  );
}
