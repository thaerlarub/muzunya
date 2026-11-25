// Worker helpers: env type, ids, errors, input validation, row mappers, shared loaders.
import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type {
  Badge, Customer, DayLog, Exercise, Followup, Note, Order, Photo, PlanVersion, Recipe, SessionUser, Settings, Template,
} from "../shared/types.ts";

export type User = SessionUser & { sid: string; csrf: string };
export type Env = { Bindings: Cloudflare.Env; Variables: { user: User } };
export type Row = Record<string, any>;

export const DAY = 86_400_000;

// ---------- bytes ----------
export const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
export const unb64 = (s: string) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));
export const b64url = (u: Uint8Array) => b64(u).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const rand = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)));
export const id = () => rand(16);
export async function sha256hex(s: string) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return Array.from(h, (x) => x.toString(16).padStart(2, "0")).join("");
}

// ---------- errors and input ----------
export const fail = (status: ContentfulStatusCode, error: string): never => {
  throw new HTTPException(status, { message: error });
};
export async function json(c: Context): Promise<Row> {
  const b = await c.req.json().catch(() => null);
  return b && typeof b === "object" && !Array.isArray(b) ? b : fail(400, "json");
}
export const isDate = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + "T00:00:00Z").toISOString().startsWith(s);

type V = (v: any) => unknown;
export type Fields = Record<string, V>;
const bad = (what: string) => fail(400, what);
export const date: V = (v) => (isDate(v) ? v : bad("date"));
export const optDate: V = (v) => (v == null ? null : date(v));
export const optNum: V = (v) => (v == null ? null : typeof v === "number" && Number.isFinite(v) ? v : bad("number"));
export const int = (lo: number, hi: number, def?: number): V => (v) =>
  v == null && def !== undefined ? def : Number.isInteger(v) && v >= lo && v <= hi ? v : bad("number");
export const str = (max: number): V => (v) =>
  typeof v === "string" && v.trim() && v.length <= max ? v.trim() : bad("text");
export const optStr = (max: number, def: string | null = null): V => (v) =>
  v == null || v === "" ? def : typeof v === "string" && v.length <= max ? v : bad("text");
export const oneOf = (list: readonly string[], def?: string): V => (v) =>
  v == null && def !== undefined ? def : list.includes(v) ? v : bad("value");
export const obj = (v: unknown) => {
  const s = v && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : bad("body");
  return s.length <= 1_000_000 ? s : bad("too_big");
};
export const bool: V = (v) => (typeof v === "boolean" ? (v ? 1 : 0) : bad("bool"));

/** Validate `input` against `f`. Full: every field (missing ones get their default or fail). Partial: only keys present. */
export function pick(input: Row, f: Fields, partial = false): Row {
  const out: Row = {};
  for (const k in f) if (!partial || k in input) out[k] = f[k](input[k]);
  return out;
}
// Column names below always come from our own Fields keys, never from the request.
export const insert = (db: D1Database, table: string, o: Row) =>
  db.prepare(`INSERT INTO ${table} (${Object.keys(o)}) VALUES (${Object.keys(o).map(() => "?")})`).bind(...Object.values(o));
export const update = (db: D1Database, table: string, o: Row, where: string, ...args: unknown[]) =>
  db.prepare(`UPDATE ${table} SET ${Object.keys(o).map((k) => k + " = ?")} WHERE ${where}`).bind(...Object.values(o), ...args);

export const FU_FIELDS: Fields = {
  date, weight: optNum, arm: optNum, chest: optNum, waist: optNum, hips: optNum, thigh: optNum,
  appetite: (v) => (v == null ? null : int(1, 5)(v)), note: optStr(2000),
};

// ---------- row mappers ----------
const J = (s: unknown) => (typeof s === "string" ? JSON.parse(s) : s);
export const CUSTOMER_SQL = "SELECT c.*, u.phone, u.status FROM customers c JOIN users u ON u.id = c.user_id";
export const customer = (r: Row): Customer => ({
  user_id: r.user_id, name: r.name, phone: r.phone, status: r.status, height: r.height, w0: r.w0,
  start_date: r.start_date, track: r.track, goal_w: r.goal_w, act: r.act, sur: r.sur, man_kcal: r.man_kcal,
  mascot: r.mascot, wardrobe: J(r.wardrobe), allergies: r.allergies, journey_finished_at: r.journey_finished_at, letter: r.letter,
});
export const order = (r: Row): Order => ({ id: r.id, customer_id: r.customer_id, order_date: r.order_date, months: r.months });
export const version = (r: Row): PlanVersion => ({
  id: r.id, customer_id: r.customer_id, type: r.type, start_date: r.start_date, cycle_len: r.cycle_len, body: J(r.body), created_at: r.created_at,
});
export const template = (r: Row): Template => ({
  id: r.id, type: r.type, track: r.track, name: r.name, cycle_len: r.cycle_len, body: J(r.body), created_at: r.created_at,
});
export const exercise = (r: Row): Exercise => ({
  id: r.id, name_ar: r.name_ar, name_en: r.name_en, kind: r.kind, places: J(r.places), video_url: r.video_url,
});
export const dayLog = (r: Row): DayLog => ({ date: r.date, body: J(r.body) });
export const followup = (r: Row): Followup => ({
  id: r.id, customer_id: r.customer_id, date: r.date, weight: r.weight, arm: r.arm, chest: r.chest, waist: r.waist,
  hips: r.hips, thigh: r.thigh, appetite: r.appetite, note: r.note, author: r.author, updated_at: r.updated_at,
});
export const photo = (r: Row): Photo => ({
  id: r.id, customer_id: r.customer_id, recipe_id: r.recipe_id, date: r.date, caption: r.caption, author: r.author, created_at: r.created_at,
});
export const note = (r: Row): Note => ({
  id: r.id, customer_id: r.customer_id, date: r.date, text: r.text, private: !!r.private, created_at: r.created_at,
});
export const badge = (r: Row): Badge => ({ badge: r.badge, earned_at: r.earned_at });
export const recipe = (r: Row, photos: string[] = []): Recipe => ({
  id: r.id, section: r.section, title: r.title, tag: r.tag, body: J(r.body), sort: r.sort, photos,
});

// ---------- loaders ----------
/** Everything about one customer. `admin` includes private notes. Null when she does not exist. */
export async function bundle(db: D1Database, uid: string, admin: boolean) {
  const q = (sql: string) => db.prepare(sql).bind(uid);
  const [c, o, v, l, f, p, n, b] = await db.batch<Row>([
    q(CUSTOMER_SQL + " WHERE c.user_id = ?"),
    q("SELECT * FROM orders WHERE customer_id = ? ORDER BY order_date"),
    q("SELECT * FROM plan_versions WHERE customer_id = ? ORDER BY start_date, created_at"),
    q("SELECT date, body FROM day_logs WHERE customer_id = ? ORDER BY date"),
    q("SELECT * FROM followups WHERE customer_id = ? ORDER BY date, updated_at"),
    q("SELECT * FROM photos WHERE customer_id = ? ORDER BY date, created_at"),
    q(`SELECT * FROM notes WHERE customer_id = ?${admin ? "" : " AND private = 0"} ORDER BY date, created_at`),
    q("SELECT badge, earned_at FROM badges WHERE customer_id = ? ORDER BY earned_at"),
  ]);
  if (!c.results[0]) return null;
  return {
    customer: customer(c.results[0]), orders: o.results.map(order), versions: v.results.map(version),
    logs: l.results.map(dayLog), followups: f.results.map(followup), photos: p.results.map(photo),
    notes: n.results.map(note), badges: b.results.map(badge),
  };
}

export const SETTINGS_DEFAULT: Settings = { whatsapp: "", accent: "#c48bd9", muzuna_kcal: null, muzuna_prot: null };
export async function getSettings(db: D1Database): Promise<Settings> {
  const s: Row = { ...SETTINGS_DEFAULT };
  const { results } = await db.prepare("SELECT key, value FROM settings").all<Row>();
  for (const r of results) if (r.key in s) s[r.key] = JSON.parse(r.value);
  return s as Settings;
}

export async function dropPrefix(b: R2Bucket, prefix: string) {
  let cursor: string | undefined;
  do {
    const l = await b.list({ prefix, cursor });
    if (l.objects.length) await b.delete(l.objects.map((o) => o.key));
    cursor = l.truncated ? l.cursor : undefined;
  } while (cursor);
}
