// Animated mascot. Drawing is imperative (blink, chew and growth tween redraw the SVG without re-rendering Preact).
import { useEffect, useRef } from "preact/hooks";
import type { MascotKind, Wardrobe, WearItem } from "../../shared/types";
import { MASCOTS, anchors, build, wearOnly, type Prim, type State } from "./shapes";
import { softSvg } from "./render";
import "./mascot.css";

export interface MascotApi { feed(from: Element | null, emoji: string): void; flex(): void; hop(): void; reveal(item: WearItem): void }

/** Earned items that she has not switched off. */
export const wornItems = (earned: WearItem[], wardrobe: Wardrobe): WearItem[] => earned.filter((i) => wardrobe[i] !== false);

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const PET = ["#c48bd9", "#f2a7bd", "#e9b949", "#fbd3e0", "#7fa9a0"];
const HEART = '<svg viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" fill="#e2729a"/></svg>';
const SPARK = '<svg viewBox="0 0 24 24"><path d="M12 1c.8 6 4 10 11 11-7 1-10.2 5-11 11-.8-6-4-10-11-11 7-1 10.2-5 11-11z" fill="#e9b949"/></svg>';

function centre(ps: Prim[]): [number, number] {
  const pts = ps.flatMap((p) => (p.e ? [[p.e[0], p.e[1]]] : p.p!));
  return [pts.reduce((s, q) => s + q[0], 0) / pts.length, pts.reduce((s, q) => s + q[1], 0) / pts.length];
}

function engine(root: HTMLElement, kind: MascotKind, g: number, wear: WearItem[], sleepy: boolean) {
  const fig = root.querySelector<HTMLElement>(".ms-fig")!, art = root.querySelector<HTMLElement>(".ms-art")!;
  const fx = root.querySelector<HTMLElement>(".ms-fx")!, shadow = root.querySelector<HTMLElement>(".ms-shadow")!;
  const st = { kind, g, target: g, wear, sleepy, s: {} as State, extra: new Set<WearItem>(), hide: null as WearItem | null, busy: 0, pending: 0, dead: false };
  let q = Promise.resolve(), raf = 0, blinkT = 0, playTok = 0;

  const draw = () => {
    const w = new Set([...st.wear, ...st.extra]);
    if (st.hide) w.delete(st.hide);
    art.innerHTML = softSvg(build(st.kind, st.g, { ...st.s, blink: st.s.blink || (st.sleepy && !st.busy) }, w));
    shadow.style.width = 40 + st.g * 16 + "%";
  };
  const tween = (to: number) => {
    cancelAnimationFrame(raf); st.target = to;
    if (reduced()) { st.g = to; return draw(); }
    const from = st.g, t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 450);
      st.g = from + (to - from) * (1 - Math.pow(1 - p, 3)); draw();
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  // One action at a time; a short backlog is kept, anything past it is dropped so fast ticking never piles up.
  const run = (f: () => Promise<void>) => {
    if (st.pending >= 4) return;
    st.pending++;
    q = q.then(async () => {
      if (st.dead) return;
      st.busy++; draw();
      try { await f(); } finally { st.busy--; st.pending--; if (!st.dead) draw(); }
    }).catch(() => {});
  };
  const play = (cls: string, ms: number) => {
    const tok = ++playTok;
    fig.classList.remove("idle", "hop", "yum", "flex"); void fig.offsetWidth; fig.classList.add(cls);
    return wait(ms).then(() => { if (tok === playTok) { fig.classList.remove(cls); fig.classList.add("idle"); } });
  };
  const fxEl = (cls: string, x: number, y: number, html = "") => {
    const i = document.createElement("i"); i.className = cls; i.style.left = x + "%"; i.style.top = y + "%"; i.innerHTML = html;
    fx.appendChild(i); setTimeout(() => i.remove(), 1500); return i;
  };

  const api: MascotApi = {
    feed: (from, emoji) => run(async () => {
      if (reduced()) return;
      const box = art.getBoundingClientRect(), [mx, my] = anchors(st.kind, st.g).mouth;
      const tx = box.left + mx / 100 * box.width, ty = box.top + my / 100 * box.height, fr = from?.getBoundingClientRect();
      const fx0 = fr ? fr.left + fr.width / 2 : box.left + box.width / 2, fy0 = fr ? fr.top + fr.height / 2 : box.bottom + 80;
      const cx = (fx0 + tx) / 2, cy = Math.min(fy0, ty) - 110, kf: Keyframe[] = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14, u = 1 - t;
        kf.push({ transform: `translate(${u * u * fx0 + 2 * u * t * cx + t * t * tx - 18}px,${u * u * fy0 + 2 * u * t * cy + t * t * ty - 18}px) rotate(${t * 260}deg) scale(${1 - .55 * t})` });
      }
      const f = document.createElement("div"); f.className = "ms-food"; f.textContent = emoji; document.body.appendChild(f);
      const fly = f.animate(kf, { duration: 720, easing: "cubic-bezier(.35,.1,.35,1)" });
      const op = setTimeout(() => { st.s.open = true; draw(); }, 380);
      await fly.finished.catch(() => {}); clearTimeout(op); f.remove();
      for (let i = 0; i < 3; i++) { st.s.open = false; st.s.full = true; draw(); await wait(110); st.s.open = true; draw(); await wait(110); }
      st.s.open = false; draw(); play("yum", 520);
      fxEl("ms-heart", mx, my - 6, HEART);
      await wait(450); st.s.full = false; draw();
    }),
    flex: () => run(async () => {
      if (reduced()) return;
      st.s.flex = true; draw();
      fxEl("ms-spark", st.kind === "camel" ? 66 : 80, 42, SPARK);
      fxEl("ms-spark late", st.kind === "camel" ? 18 : 22, 50, SPARK);
      await play("flex", 650); st.s.flex = false; draw();
    }),
    hop: () => run(async () => {
      if (reduced()) return;
      const k = root.offsetWidth / 160;
      for (let i = 0; i < 12; i++) {
        const a = -Math.PI / 2 + (Math.random() - .5) * 2.6, d = (50 + Math.random() * 60) * k, p = fxEl("ms-petal", 50, 45);
        p.style.cssText += `--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--r:${Math.random() * 540 - 270}deg;background:${PET[i % PET.length]};animation-delay:${150 + i * 18}ms`;
      }
      await play("hop", 780);
    }),
    reveal: (item) => run(async () => {
      if (reduced()) { st.extra.add(item); return; }
      st.hide = item; draw();
      const ps = wearOnly(st.kind, st.g, new Set([...st.wear, ...st.extra, item]), item), [cx, cy] = centre(ps);
      const glow = fxEl("ms-glow", cx, cy), pop = document.createElement("div");
      pop.className = "ms-pop"; pop.style.transformOrigin = `${cx}% ${cy}%`; pop.innerHTML = softSvg(ps); fig.appendChild(pop);
      await wait(700);
      st.hide = null; st.extra.add(item); draw(); pop.remove();
      await wait(350); glow.remove();
    }),
  };

  const blink = () => {
    blinkT = window.setTimeout(() => {
      if (!reduced() && !st.sleepy && !st.s.open) { st.s.blink = true; draw(); setTimeout(() => { st.s.blink = false; if (!st.dead) draw(); }, 140); }
      blink();
    }, 2600 + Math.random() * 2600);
  };
  blink(); draw();
  return {
    st, draw, tween, api,
    dispose() { st.dead = true; clearTimeout(blinkT); cancelAnimationFrame(raf); },
  };
}

export function Mascot(p: { kind: MascotKind; growth: number; wear: WearItem[]; sleepy?: boolean; size?: number; apiRef?: { current: MascotApi | null } }) {
  const root = useRef<HTMLDivElement>(null), eng = useRef<ReturnType<typeof engine> | null>(null);
  const delay = useRef((Math.random() * 2.8).toFixed(2)).current, size = p.size ?? 160;
  const wearKey = p.wear.join();

  useEffect(() => {
    const e = engine(root.current!, p.kind, p.growth, p.wear, !!p.sleepy);
    eng.current = e;
    if (p.apiRef) p.apiRef.current = e.api;
    return () => { e.dispose(); eng.current = null; if (p.apiRef) p.apiRef.current = null; };
  }, []);
  useEffect(() => {
    const e = eng.current; if (!e) return;
    if (e.st.kind === p.kind && e.st.wear.join() === wearKey && e.st.sleepy === !!p.sleepy) return;
    Object.assign(e.st, { kind: p.kind, wear: p.wear, sleepy: !!p.sleepy }); e.st.extra.clear(); e.draw();
  }, [p.kind, wearKey, p.sleepy]);
  useEffect(() => { const e = eng.current; if (e && e.st.target !== p.growth) e.tween(p.growth); }, [p.growth]);

  const name = MASCOTS.find((m) => m.id === p.kind)?.ar;
  return (
    <div ref={root} class={"ms" + (p.sleepy ? " sleepy" : "")} role="img" aria-label={name} style={`width:${size}px;height:${size}px;--d:-${delay}s`}>
      <div class="ms-shadow" />
      <div class="ms-fig idle"><div class="ms-art" /></div>
      <div class="ms-fx" />
      {p.sleepy && <span class="ms-z" aria-hidden="true">z</span>}
    </div>
  );
}
