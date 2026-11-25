export const AGE = 25;
export const BASE = 2200;

/** Rounding per unit, ported from the old app. */
export function fmt(v: number, u: string): number | string {
  if (u === "g") return v >= 50 ? Math.round(v / 10) * 10 : Math.max(5, Math.round(v / 5) * 5);
  if (u === "ml") return Math.max(50, Math.round(v / 25) * 25);
  if (u === "hf") {
    const r = Math.max(0.5, Math.round(v * 2) / 2), i = Math.floor(r);
    return r % 1 ? (i ? i + "½" : "½") : r;
  }
  return Math.max(1, Math.round(v));
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export const scale = (kcal: number, muzunaKcal: number | null): number => clamp((kcal - (muzunaKcal || 0)) / BASE, 0.75, 1.5);

export function targets(p: { w: number | null; h: number | null; act: string; sur: string; man: number | null; muzunaKcal: number | null }) {
  const w = p.w || 0, h = p.h || 0, m2 = (h / 100) ** 2;
  const bmr = 10 * w + 6.25 * h - 5 * AGE - 161;
  const kcal = p.man || Math.round((bmr * +p.act + +p.sur) / 50) * 50;
  const raw = (kcal - (p.muzunaKcal || 0)) / BASE;
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {
    kcal,
    prot: Math.round((w * 1.5) / 5) * 5,
    bmi: h ? w / m2 : 0,
    lo: r1(18.5 * m2),
    hi: r1(24.9 * m2),
    f: clamp(raw, 0.75, 1.5),
    clamped: raw < 0.75 || raw > 1.5,
  };
}

/** {b|u} or {b|u|manual}. Groups: 1 base, 2 unit, 3 manual text. */
export const TOKEN_RE = /\{([\d.]+)\|(\w+)(?:\|([^}|]+))?\}/g;

export const tokenValue = (b: number, u: string, f: number): string => String(fmt(b * f, u));

export function renderTokens(s: string, f: number, wrap?: (val: string, i: number, manual: boolean) => string): string {
  let i = 0;
  return s.replace(TOKEN_RE, (_m, b: string, u: string, man?: string) => {
    const val = man ?? tokenValue(+b, u, f);
    return wrap ? wrap(val, i++, man != null) : val;
  });
}

/** Set token i to {b|u|value}. An empty value clears the manual part. */
export function setManual(s: string, i: number, value: string): string {
  const v = value.replace(/[}|]/g, "").trim();
  let n = 0;
  return s.replace(TOKEN_RE, (m, b: string, u: string) => (n++ === i ? (v ? `{${b}|${u}|${v}}` : `{${b}|${u}}`) : m));
}

export const clearManual = (s: string): string => s.replace(TOKEN_RE, (_m, b: string, u: string) => `{${b}|${u}}`);

export const stripTokens = (s: string, f: number): string => renderTokens(s, f);
