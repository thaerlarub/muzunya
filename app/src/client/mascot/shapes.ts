// Shape model for the four mascots, ported from docs/mockups/muzuna-mascots.html (style B, soft vector).
// Coordinates are in a 100 x 100 box. g = growth 0..1 (rounder with progress).
import type { MascotKind, WearItem } from "../../shared/types";

export interface Prim {
  e?: [number, number, number, number]; // ellipse cx, cy, rx, ry
  p?: [number, number][];               // polygon
  f: string;                            // fill
  rot?: number;
  d?: boolean;                          // detail: no outline
  o?: number;                           // opacity
  head?: boolean;                       // gets the sheen
}
export interface State { blink?: boolean; open?: boolean; full?: boolean; flex?: boolean }
interface Anchors { top: [number, number]; side: [number, number]; eyes: [number, number][]; neck: [number, number, number]; mouth: [number, number] }
interface Parts { pre: Prim[]; post: Prim[]; a: Anchors }

const INK = "#3b2947", SKIN = "#f6d3bd", PINK = "#f2a7bd", ROSE = "#e2729a", GOLD = "#e9b949", SAGE = "#7fa9a0", MOUTH = "#7d2f4a";
const E = (cx: number, cy: number, rx: number, ry: number, f: string, o: Partial<Prim> = {}): Prim => ({ e: [cx, cy, rx, ry], f, ...o });
const P = (p: [number, number][], f: string, o: Partial<Prim> = {}): Prim => ({ p, f, ...o });
const D = { d: true };

export function girl(g: number, s: State): Parts {
  const k = 1 + .45 * g, bw = 17 * k, c = s.full ? 1.3 : 0, ey = s.blink ? .35 : 2.3, A = "#b47bc9";
  const arms = s.flex
    ? [E(50 - bw - 2, 60, 4.2, 8.5, A, { rot: -42 }), E(50 + bw + 2, 60, 4.2, 8.5, A, { rot: 42 })]
    : [E(50 - bw + 1, 70, 4.5, 8.5, A, { rot: 18 }), E(50 + bw - 1, 70, 4.5, 8.5, A, { rot: -18 })];
  return {
    pre: [E(50 - (8 + 3 * g), 90, 5, 4, "#7a4f8a"), E(50 + (8 + 3 * g), 90, 5, 4, "#7a4f8a"), ...arms, E(50, 72, bw, 19 + 2 * g, "#c48bd9"), E(50, 79, bw * .55, 3, "#d9b0e6", D)],
    post: [E(50, 38, 20 + 1.5 * g, 21, "#8e5aa3", { head: true }), E(50, 41, 13 + 1.6 * g + c * .6, 13.5 + .6 * g, SKIN),
      E(42 - g - c * .4, 46, 3 + g + c, 2 + c * .5, PINK, { d: true, o: .85 }), E(58 + g + c * .4, 46, 3 + g + c, 2 + c * .5, PINK, { d: true, o: .85 }),
      E(44, 41, 1.7, ey, INK, D), E(56, 41, 1.7, ey, INK, D), s.open ? E(50, 48.8, 3.2, 3, MOUTH, D) : E(50, 48, 2.3, 1.2, "#c0607a", D)],
    a: { top: [50, 18], side: [64, 24], eyes: [[44, 41], [56, 41]], neck: [50, 56, 16 * (1 + .3 * g)], mouth: [50, 48.5] },
  };
}

export function kitten(g: number, s: State): Parts {
  const k = 1 + .45 * g, bw = 16 * k, F = "#e6d9ee", F2 = "#cbb6db", c = s.full ? 1.3 : 0, ey = s.blink ? .35 : 2.5;
  const paws = s.flex ? [E(50 - bw - 1, 62, 3.6, 5.5, F2, { rot: -35 }), E(50 + bw + 1, 62, 3.6, 5.5, F2, { rot: 35 })] : [];
  return {
    pre: [E(50 + bw * .95, 72, 4, 13, F2, { rot: 35 }), E(50 - (8 + 3 * g), 90, 5, 4, F2), E(50 + (8 + 3 * g), 90, 5, 4, F2), ...paws, E(50, 72, bw, 18 + 2 * g, F), E(50, 76, bw * .56, 11, "#fbf6fd", D)],
    post: [P([[33, 32], [36, 11], [48, 24]], F), P([[67, 32], [64, 11], [52, 24]], F), P([[36.5, 27], [37.5, 16], [44, 24]], PINK, D), P([[63.5, 27], [62.5, 16], [56, 24]], PINK, D),
      E(50, 39, 18 + 1.6 * g + c * .6, 16 + .6 * g, F, { head: true }), E(41 - g - c * .4, 45, 3 + g + c, 1.9 + c * .5, PINK, { d: true, o: .8 }), E(59 + g + c * .4, 45, 3 + g + c, 1.9 + c * .5, PINK, { d: true, o: .8 }),
      E(43.5, 39, 1.8, ey, INK, D), E(56.5, 39, 1.8, ey, INK, D), ...(s.open ? [E(50, 48.6, 2.8, 2.6, MOUTH, D)] : []), P([[48, 44], [52, 44], [50, 46.2]], "#d9708e", D)],
    a: { top: [50, 23], side: [63, 23], eyes: [[43.5, 39], [56.5, 39]], neck: [50, 55, 16 * (1 + .3 * g)], mouth: [50, 48] },
  };
}

export function bunny(g: number, s: State): Parts {
  const k = 1 + .45 * g, bw = 16 * k, F = "#f5eef8", F2 = "#e4d6ea", c = s.full ? 1.3 : 0, ey = s.blink ? .35 : 2.5;
  const paws = s.flex ? [E(50 - bw - 1, 63, 3.6, 5.5, F2, { rot: -35 }), E(50 + bw + 1, 63, 3.6, 5.5, F2, { rot: 35 })] : [];
  return {
    pre: [E(50 - (9 + 3 * g), 91, 6.5, 3.6, F2), E(50 + (9 + 3 * g), 91, 6.5, 3.6, F2), ...paws, E(50, 73, bw, 18 + 2 * g, F), E(50, 77, bw * .56, 11, "#fffbff", D)],
    post: [E(42, 16, 5.2, 15, F, { rot: -8 }), E(58, 16, 5.2, 15, F, { rot: 8 }), E(42, 17, 2.5, 11, PINK, { rot: -8, d: true }), E(58, 17, 2.5, 11, PINK, { rot: 8, d: true }),
      E(50, 41, 17 + 1.6 * g + c * .6, 15 + .6 * g, F, { head: true }), E(41 - g - c * .4, 46, 3 + g + c, 1.9 + c * .5, PINK, { d: true, o: .8 }), E(59 + g + c * .4, 46, 3 + g + c, 1.9 + c * .5, PINK, { d: true, o: .8 }),
      E(44, 40, 1.8, ey, INK, D), E(56, 40, 1.8, ey, INK, D), ...(s.open ? [E(50, 49.4, 2.8, 2.6, MOUTH, D)] : []), E(50, 45, 1.8, 1.3, "#d9708e", D), P([[48.6, 47], [51.4, 47], [51.4, 49.6], [48.6, 49.6]], "#ffffff", D)],
    a: { top: [50, 27], side: [61, 28], eyes: [[44, 40], [56, 40]], neck: [50, 57, 16 * (1 + .3 * g)], mouth: [50, 49] },
  };
}

export function camel(g: number, s: State): Parts {
  const k = 1 + .3 * g, T = "#dcb488", T2 = "#c49a6c", L = "#ecd2b0", c = s.full ? 1.2 : 0;
  return {
    pre: [E(68, 85, 3.4, 9, T2), E(73, 84, 3.4, 9, T2), E(41, 85, 3.4, 9, T2), E(47, 84, 3.4, 9, T2), E(77 + 3 * g, 66, 2.2, 7, T2, { rot: -20 }),
      E(58, 57 - 2 * g, 10 + 4 * g, 9 + 4 * g, T), E(56, 70, 21 * k, 14 + 3 * g, T), E(56, 74, 14 * k, 6, L, D), E(36, 53, 6.5, 13, T, { rot: 16 })],
    post: [E(37, 28, 2.6, 4.2, T2, { rot: 30 }), E(30, 36, 11, 9, T, { head: true }), E(21, 40, 7.5 + c * .5, 6 + c * .4, L), E(17, 39, 1, .7, INK, D), E(34, 40, 2.6 + c, 1.7 + c * .5, PINK, { d: true, o: .85 }),
      E(29, 34, 1.8, s.blink ? .35 : 2.5, INK, D), s.open ? E(20.5, 44, 2.8, 2.3, MOUTH, D) : E(21, 43.5, 2.2, .9, "#a8755a", D)],
    a: { top: [31, 26], side: [39, 27], eyes: [[29, 34]], neck: [37, 50, 11], mouth: [20.5, 44] },
  };
}

const FIG = { girl, kitten, bunny, camel };
export const MASCOTS: { id: MascotKind; ar: string }[] = [
  { id: "girl", ar: "مزيونة" }, { id: "kitten", ar: "قطوة" }, { id: "bunny", ar: "أرنوبة" }, { id: "camel", ar: "حوار" },
];
export const WEAR: WearItem[] = ["bow", "necklace", "scarf", "glasses", "flower", "crown"];
export const WEAR_AR: Record<WearItem, string> = { bow: "فيونكة", necklace: "عقد لؤلؤ", scarf: "وشاح", glasses: "نظارة شمسية", flower: "وردة", crown: "تاج" };

// `only` limits the output to one item (used for the reveal pop) while keeping positions from the full set.
export function neckWear(a: Anchors, wear: Set<WearItem>, only?: WearItem): Prim[] {
  const [x, y, w] = a.neck, out: Prim[] = [], has = (i: WearItem) => wear.has(i) && (!only || only === i);
  if (has("scarf")) out.push(E(x, y, w * .62, 3.8, SAGE), P([[x + w * .18, y], [x + w * .46, y + 12], [x + w * .12, y + 12]], "#6a9289"));
  if (has("necklace")) for (let t = -2; t <= 2; t++) out.push(E(x + t * w / 5.2, y + 3.2 - t * t * .55, 1.7, 1.7, "#fff8ef"));
  return out;
}
export function headWear(a: Anchors, wear: Set<WearItem>, only?: WearItem): Prim[] {
  const out: Prim[] = [], [tx, ty] = a.top, has = (i: WearItem) => wear.has(i) && (!only || only === i);
  if (has("glasses")) {
    const e = a.eyes;
    e.forEach(([x, y]) => out.push(E(x, y, 4.2, 3.2, "#2e2236"), E(x - 1.4, y - 1.1, 1.2, .8, "#ffffff", { d: true, o: .55 })));
    if (e.length > 1) out.push(P([[e[0][0] + 3.5, e[0][1] - .8], [e[1][0] - 3.5, e[1][1] - .8], [e[1][0] - 3.5, e[1][1] + .6], [e[0][0] + 3.5, e[0][1] + .6]], "#2e2236", D));
  }
  if (has("flower")) {
    const [x, y] = a.side;
    for (let i = 0; i < 5; i++) { const t = i * 1.2566 - 1.57; out.push(E(x + Math.cos(t) * 3.2, y + Math.sin(t) * 3.2, 2.7, 2.7, "#fbd3e0")); }
    out.push(E(x, y, 1.8, 1.8, GOLD, D));
  }
  if (has("crown")) out.push(P([[tx - 9, ty], [tx - 9, ty - 8], [tx - 4.5, ty - 3.5], [tx, ty - 10], [tx + 4.5, ty - 3.5], [tx + 9, ty - 8], [tx + 9, ty]], GOLD), E(tx, ty - 3, 1.5, 1.5, ROSE, D), E(tx - 5.5, ty - 2, 1, 1, SAGE, D), E(tx + 5.5, ty - 2, 1, 1, SAGE, D));
  if (has("bow")) {
    const cr = wear.has("crown"), bx = cr ? tx - 11 : tx, by = cr ? ty + 3 : ty;
    out.push(P([[bx, by], [bx - 7, by - 4.5], [bx - 7, by + 4.5]], ROSE), P([[bx, by], [bx + 7, by - 4.5], [bx + 7, by + 4.5]], ROSE), E(bx, by, 2.1, 2.1, "#c4567e"));
  }
  return out;
}

export function build(kind: MascotKind, g: number, s: State, wear: Set<WearItem>): Prim[] {
  const r = FIG[kind](g, s);
  return [...r.pre, ...neckWear(r.a, wear), ...r.post, ...headWear(r.a, wear)];
}
/** Just one wearable, placed as `build` would place it. */
export function wearOnly(kind: MascotKind, g: number, wear: Set<WearItem>, item: WearItem): Prim[] {
  const a = FIG[kind](g, {}).a;
  return [...neckWear(a, wear, item), ...headWear(a, wear, item)];
}
export const anchors = (kind: MascotKind, g = 0): Anchors => FIG[kind](g, {}).a;

/** A wearable on its own, centred in the 100 box (badge medallions). */
export function itemPrims(item: WearItem): Prim[] {
  const a: Anchors = { top: [50, item === "crown" ? 55 : 50], side: [50, 50], eyes: [[44, 50], [56, 50]], neck: [50, item === "scarf" ? 44 : 48, 20], mouth: [50, 50] };
  return [...neckWear(a, new Set([item])), ...headWear(a, new Set([item]))];
}
