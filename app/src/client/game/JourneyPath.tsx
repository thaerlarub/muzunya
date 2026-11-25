// Winding journey path from the start (bottom) up to the goal, one stop per kg; without a goal, 6 stops of 1 kg.
import { useEffect, useState } from "preact/hooks";
import type { Track } from "../../shared/types";
import "./game.css";

type Pt = [number, number];
const bez = (a: Pt, b: Pt, sp: number, t: number): Pt => {
  const c1: Pt = [a[0], a[1] - sp / 2], c2: Pt = [b[0], b[1] + sp / 2], u = 1 - t;
  const f = (k: 0 | 1) => u * u * u * a[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t * t * t * b[k];
  return [f(0), f(1)];
};
const r1 = (n: number) => Math.round(n * 10) / 10;

export function JourneyPath(p: { w0: number; latest: number; goal: number | null; track: Track }) {
  const dir = p.track === "loss" ? -1 : 1;
  const total = p.goal == null ? 6 : Math.abs(p.goal - p.w0), n = Math.max(1, Math.ceil(total - 1e-9));
  const prog = Math.min(total, Math.max(0, dir * (p.latest - p.w0)));
  // Stops sit on whole kg; the last segment (to the goal) may be shorter.
  const last = total - (n - 1);
  const pos = total === 0 ? n : prog >= n - 1 ? n - 1 + (last > 0 ? (prog - (n - 1)) / last : 1) : prog;

  const sp = n > 8 ? 36 : 44, H = n * sp + 64;
  const pts: Pt[] = Array.from({ length: n + 1 }, (_, i) => [150 + 80 * Math.sin(i * Math.PI / 2), H - 32 - i * sp]);
  const seg = (i: number) => `M${pts[i][0]} ${pts[i][1]}C${pts[i][0]} ${pts[i][1] - sp / 2} ${pts[i + 1][0]} ${pts[i + 1][1] + sp / 2} ${pts[i + 1][0]} ${pts[i + 1][1]}`;
  const label = (i: number) => {
    if (i === 0) return `البداية ${r1(p.w0)}`;
    if (p.goal == null) return `${dir > 0 ? "+" : "-"}${i} كغ`;
    if (i === n) return `الهدف ${r1(p.goal)}`;
    return `${r1(p.w0 + dir * i)}`;
  };

  const [on, setOn] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(r); }, []);
  const at = on ? pos : 0, si = Math.min(n - 1, Math.floor(at));
  const [mx, my] = at >= n ? pts[n] : bez(pts[si], pts[si + 1], sp, at - si);
  const done = r1(prog);

  return (
    <figure class="gm-path">
      <svg viewBox={`0 0 300 ${H}`} role="img" aria-label={p.goal == null ? `${done} كغ من 6` : `${done} كغ من ${r1(total)}`}>
        {pts.slice(0, -1).map((_, i) => <path key={i} d={seg(i)} class={i + 1 <= pos ? "gm-seg done" : "gm-seg"} />)}
        {pts.map(([x, y], i) => (
          <g key={"s" + i}>
            <circle cx={x} cy={y} r={i === n ? 11 : 8} class={i <= pos + 1e-9 ? "gm-stop done" : "gm-stop"} />
            <text x={x + (x < 150 ? -46 : 46)} y={y + 5} class={i === 0 || i === n ? "gm-lbl b" : "gm-lbl"}>{label(i)}</text>
          </g>
        ))}
        <g class="gm-mark" style={`transform:translate(${mx}px,${my}px)`}>
          <circle r="17" class="gm-halo" />
          <g class="gm-bob">
            <circle r="11" class="gm-dotm" />
            <path d="M0 5s-5.5-3.4-5.5-7.2a3 3 0 0 1 5.5-1.8 3 3 0 0 1 5.5 1.8C5.5 1.6 0 5 0 5z" fill="#fff" />
          </g>
        </g>
      </svg>
    </figure>
  );
}
