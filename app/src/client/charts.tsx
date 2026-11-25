// Small SVG charts: weight over time and sizes first vs latest. Shared by customer and admin.
import { useEffect, useRef, useState } from "preact/hooks";
import type { Followup } from "../shared/types";
import { fmtDate } from "./ui";
import "./customer/customer.css";

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(340);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 340));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function WeightChart(p: { points: { d: string; w: number }[]; goal?: number | null }) {
  const [ref, W] = useWidth();
  const [hi, setHi] = useState<number | null>(null);
  const pts = [...p.points].sort((a, b) => a.d.localeCompare(b.d));
  if (pts.length < 2) return <div ref={ref} class="ch-empty">سجلي وزنين على الأقل ليظهر الرسم.</div>;
  const H = 200, pl = 36, pr = 12, pt = 14, pb = 26;
  const vals = pts.map((x) => x.w).concat(p.goal ? [p.goal] : []);
  const mn = Math.floor(Math.min(...vals) - 0.5), mx = Math.ceil(Math.max(...vals) + 0.5);
  const t0 = Date.parse(pts[0].d), span = Math.max(1, Date.parse(pts[pts.length - 1].d) - t0);
  // RTL: time runs right to left, like the old app.
  const X = (d: string) => W - pr - ((Date.parse(d) - t0) / span) * (W - pl - pr);
  const Y = (v: number) => pt + ((mx - v) / (mx - mn)) * (H - pt - pb);
  const step = Math.max(1, Math.round((mx - mn) / 4));
  const ticks: number[] = []; for (let v = mn; v <= mx; v += step) ticks.push(v);
  const h = hi === null ? null : pts[hi];
  const pick = (e: PointerEvent) => {
    const x = e.offsetX; let best = 0;
    pts.forEach((q, i) => { if (Math.abs(X(q.d) - x) < Math.abs(X(pts[best].d) - x)) best = i; });
    setHi(best);
  };
  return (
    <div ref={ref} class="ch">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} direction="ltr" role="img" aria-label="الوزن مع الوقت" onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHi(null)}>
        {ticks.map((v) => <g key={v}><line x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} stroke="#eee6f1" /><text x={pl - 6} y={Y(v) + 4} font-size="11" fill="#6f6478" text-anchor="end">{v}</text></g>)}
        {p.goal ? <g><line x1={pl} x2={W - pr} y1={Y(p.goal)} y2={Y(p.goal)} stroke="var(--c2)" stroke-width="1.5" stroke-dasharray="5 4" /><text x={pl + 4} y={Y(p.goal) - 5} font-size="11" fill="var(--ad)">الهدف {p.goal}</text></g> : null}
        <polyline points={pts.map((q) => X(q.d) + "," + Y(q.w)).join(" ")} fill="none" stroke="var(--a)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        {pts.map((q, i) => <circle key={i} cx={X(q.d)} cy={Y(q.w)} r={hi === i ? 6 : 4} fill="#fff" stroke="var(--ad)" stroke-width="2" />)}
        <text x={W - pr} y={H - 6} font-size="11" fill="#6f6478" text-anchor="end">{fmtDate(pts[0].d)}</text>
        <text x={pl} y={H - 6} font-size="11" fill="#6f6478" text-anchor="start">{fmtDate(pts[pts.length - 1].d)}</text>
        {h && <line x1={X(h.d)} x2={X(h.d)} y1={pt} y2={H - pb} stroke="#d9cfe0" />}
      </svg>
      {h && <div class="ch-tip" style={{ left: Math.min(Math.max(X(h.d) - 50, 0), W - 100) + "px" }}><b>{h.w} كجم</b><span>{fmtDate(h.d)}</span></div>}
    </div>
  );
}

const SIZES: [keyof Followup, string][] = [["arm", "الذراع"], ["chest", "الصدر"], ["waist", "الخصر"], ["hips", "الأرداف"], ["thigh", "الفخذ"]];

export function SizesCompare(p: { first: Followup | null; last: Followup | null }) {
  const rows = SIZES.map(([k, n]) => ({ n, a: p.first?.[k] as number | null | undefined, b: p.last?.[k] as number | null | undefined })).filter((r) => r.a || r.b);
  if (!rows.length) return <div class="ch-empty">سجلي مقاساتك لتظهر المقارنة.</div>;
  const max = Math.max(...rows.flatMap((r) => [r.a || 0, r.b || 0]));
  const same = p.first?.id === p.last?.id;
  return (
    <div class="sz">
      <div class="sz-leg"><span><i class="sz-a" />أول قياس</span>{!same && <span><i class="sz-b" />آخر قياس</span>}</div>
      {rows.map((r) => {
        const d = r.a && r.b && !same ? Math.round((r.b - r.a) * 10) / 10 : null;
        return (
          <div class="sz-row" key={r.n}>
            <div class="sz-n">{r.n}</div>
            <div class="sz-bars">
              {r.a ? <div class="sz-bar sz-a" style={{ width: (r.a / max) * 100 + "%" }}><span>{r.a}</span></div> : null}
              {r.b && !same ? <div class="sz-bar sz-b" style={{ width: (r.b / max) * 100 + "%" }}><span>{r.b}</span></div> : null}
            </div>
            <div class="sz-d">{d === null ? "" : (d > 0 ? "+" : "") + d}</div>
          </div>
        );
      })}
      <p class="note">بالسنتيمتر</p>
    </div>
  );
}
