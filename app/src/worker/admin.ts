// Admin routes (session role admin, enforced in index.ts).
import { Hono, type MiddlewareHandler } from "hono";
import { normPhone } from "../shared/phone.ts";
import { mergeDay } from "../shared/sync.ts";
import { activeVersion, addDays, todayMuscat } from "../shared/dates.ts";
import { seedExercises, seedRecipes } from "../shared/seed.ts";
import { seedTemplates } from "../shared/templates.ts";
import type { AdminRow, DayBody, Followup, Order, PlanVersion, Template, Exercise } from "../shared/types.ts";
import { hashPw, newSalt, newTempPassword } from "./auth.ts";
import {
  CUSTOMER_SQL, Env, FU_FIELDS, Fields, Row, SETTINGS_DEFAULT, badge, bundle, customer, date, dayLog, dropPrefix, exercise,
  fail, followup, getSettings, id, insert, int, isDate, json, note, obj, oneOf, optDate, optNum, optStr, pick, recipe, str,
  template, update, version, bool,
} from "./db.ts";

const TYPES = ["meal", "exercise"] as const;
const TRACKS = ["gain", "loss"] as const;
const CUSTOMER_FIELDS: Fields = {
  name: str(100), height: optNum, w0: optNum, start_date: date, track: oneOf(TRACKS, "gain"), goal_w: optNum,
  act: oneOf(["1.2", "1.375", "1.55", "1.725"], "1.375"), sur: oneOf(["300", "400", "500"], "400"), man_kcal: optNum,
  mascot: (v) => (v == null ? null : oneOf(["girl", "kitten", "bunny", "camel"])(v)), allergies: optStr(2000),
  journey_finished_at: optDate, letter: optStr(20_000),
};
const EX_FIELDS: Fields = {
  name_ar: str(100), name_en: optStr(100, ""), kind: oneOf(["r", "e", "s"], "r"),
  places: (v) => (v == null ? '["home","gym"]' : Array.isArray(v) && v.length && v.every((p) => p === "home" || p === "gym") ? JSON.stringify([...new Set(v)]) : fail(400, "places")),
  video_url: (v) => (v == null || v === "" ? null : typeof v === "string" && v.length <= 500 && /^https:\/\/\S+$/.test(v) ? v : fail(400, "url")),
};
const RECIPE_FIELDS: Fields = {
  section: oneOf(["m", "b", "l", "n"]), title: str(200), tag: optStr(100), body: obj, sort: int(-1e6, 1e6, 0),
};
const TEMPLATE_FIELDS: Fields = { name: str(100), cycle_len: int(1, 366, 7), body: obj };
const KEY = /^(m|x|kg):[\w-]{1,40}$/;

// ---------- first-run seed ----------
let seeded = false;
export const seed: MiddlewareHandler<Env> = async (c, next) => {
  if (!seeded) {
    const db = c.env.DB;
    const n = await db.prepare(
      "SELECT (SELECT count(*) FROM exercises) AS e, (SELECT count(*) FROM recipes) AS r, (SELECT count(*) FROM templates) AS t",
    ).first<Row>();
    const s: D1PreparedStatement[] = [];
    if (!n?.e) for (const e of seedExercises()) s.push(insert(db, "exercises", { ...e, places: JSON.stringify(e.places) }));
    if (!n?.r) for (const r of seedRecipes()) s.push(insert(db, "recipes", { ...r, body: JSON.stringify(r.body) }));
    if (!n?.t) for (const t of seedTemplates()) s.push(insert(db, "templates", { id: id(), ...t, body: JSON.stringify(t.body), created_at: Date.now() }));
    if (s.length) await db.batch(s);
    seeded = true;
  }
  await next();
};

export const admin = new Hono<Env>();

async function mustCustomer(db: D1Database, cid: string) {
  if (!(await db.prepare("SELECT 1 FROM customers WHERE user_id = ?").bind(cid).first())) fail(404, "not_found");
}
const ok = { ok: true } as const;

// ---------- overview ----------
admin.get("/api/admin/overview", async (c) => {
  const db = c.env.DB, today = todayMuscat();
  const [cs, os, vm, ls, fs, bs] = await db.batch<Row>([
    db.prepare(CUSTOMER_SQL + " ORDER BY c.name"),
    db.prepare("SELECT * FROM orders ORDER BY order_date"),
    db.prepare("SELECT id, customer_id, type, start_date, created_at FROM plan_versions"),
    db.prepare("SELECT customer_id, date, body FROM day_logs WHERE date >= ? ORDER BY date").bind(addDays(today, -13)),
    db.prepare(
      "SELECT * FROM (SELECT *, row_number() OVER (PARTITION BY customer_id ORDER BY date DESC, updated_at DESC) AS rn FROM followups) WHERE rn = 1",
    ),
    db.prepare("SELECT customer_id, badge, earned_at FROM badges ORDER BY earned_at"),
  ]);
  // Per customer and type: the version active today plus any future-dated ones.
  const groups = new Map<string, Row[]>();
  for (const v of vm.results) {
    const k = v.customer_id + "|" + v.type;
    groups.set(k, [...(groups.get(k) ?? []), v]);
  }
  const want: string[] = [];
  for (const g of groups.values()) {
    const a = activeVersion(g as { start_date: string; created_at: number; id: string }[], today);
    if (a) want.push(a.id);
    for (const v of g) if (v.start_date > today) want.push(v.id);
  }
  // Pages are left out of the overview bodies (they are big and the list only needs slots and days).
  const { results: vb } = await db.prepare(
    "SELECT id, customer_id, type, start_date, cycle_len, json_set(body, '$.pages', json('[]')) AS body, created_at FROM plan_versions WHERE id IN (SELECT value FROM json_each(?)) ORDER BY start_date, created_at",
  ).bind(JSON.stringify(want)).all<Row>();

  const by = <T>(rows: Row[], map: (r: Row) => T) => {
    const m = new Map<string, T[]>();
    for (const r of rows) m.set(r.customer_id, [...(m.get(r.customer_id) ?? []), map(r)]);
    return m;
  };
  const O = by(os.results, (r) => r as Order), V = by(vb, version), L = by(ls.results, dayLog), B = by(bs.results, badge);
  const F = new Map(fs.results.map((r) => [r.customer_id, followup(r)]));
  const rows: AdminRow[] = cs.results.map((r) => ({
    customer: customer(r), orders: O.get(r.user_id) ?? [], versions: V.get(r.user_id) ?? [], logs: L.get(r.user_id) ?? [],
    last_followup: F.get(r.user_id) ?? null, badges: B.get(r.user_id) ?? [],
  }));
  return c.json({ rows });
});

// ---------- customers ----------
admin.post("/api/admin/customers", async (c) => {
  const db = c.env.DB, b = await json(c);
  const phone = normPhone(typeof b.phone === "string" ? b.phone : "");
  if (!phone) return fail(400, "phone");
  const f = pick(b, CUSTOMER_FIELDS);
  if (await db.prepare("SELECT 1 FROM users WHERE phone = ?").bind(phone).first()) return fail(400, "exists");
  const uid = id(), temp = newTempPassword(), salt = newSalt();
  await db.batch([
    insert(db, "users", { id: uid, role: "customer", phone, salt, pw_hash: await hashPw(temp, salt), must_change: 1, status: "active", created_at: Date.now() }),
    insert(db, "customers", { user_id: uid, ...f }),
  ]);
  return c.json({ id: uid, temp_password: temp });
});

admin.get("/api/admin/customers/:id", async (c) => {
  const b = await bundle(c.env.DB, c.req.param("id"), true);
  return b ? c.json(b) : fail(404, "not_found");
});

admin.put("/api/admin/customers/:id", async (c) => {
  const db = c.env.DB, cid = c.req.param("id"), b = await json(c);
  await mustCustomer(db, cid);
  const f = pick(b, CUSTOMER_FIELDS, true);
  const s: D1PreparedStatement[] = [];
  if ("phone" in b) {
    const phone = normPhone(typeof b.phone === "string" ? b.phone : "");
    if (!phone) return fail(400, "phone");
    if (await db.prepare("SELECT 1 FROM users WHERE phone = ? AND id != ?").bind(phone, cid).first()) return fail(400, "exists");
    s.push(db.prepare("UPDATE users SET phone = ? WHERE id = ?").bind(phone, cid));
  }
  if (Object.keys(f).length) s.push(update(db, "customers", f, "user_id = ?", cid));
  if (s.length) await db.batch(s);
  return c.json(ok);
});

admin.post("/api/admin/customers/:id/reset", async (c) => {
  const db = c.env.DB, cid = c.req.param("id");
  await mustCustomer(db, cid);
  const temp = newTempPassword(), salt = newSalt();
  await db.batch([
    db.prepare("UPDATE users SET salt = ?, pw_hash = ?, must_change = 1 WHERE id = ? AND role = 'customer'").bind(salt, await hashPw(temp, salt), cid),
    db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(cid),
  ]);
  return c.json({ temp_password: temp });
});

admin.post("/api/admin/customers/:id/signout", async (c) => {
  const cid = c.req.param("id");
  await mustCustomer(c.env.DB, cid);
  await c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(cid).run();
  return c.json(ok);
});

admin.post("/api/admin/customers/:id/archive", async (c) => {
  const db = c.env.DB, cid = c.req.param("id"), b = await json(c);
  if (typeof b.archived !== "boolean") return fail(400, "archived");
  await mustCustomer(db, cid);
  await db.batch([
    db.prepare("UPDATE users SET status = ? WHERE id = ? AND role = 'customer'").bind(b.archived ? "archived" : "active", cid),
    ...(b.archived ? [db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(cid)] : []),
  ]);
  return c.json(ok);
});

admin.delete("/api/admin/customers/:id", async (c) => {
  const db = c.env.DB, cid = c.req.param("id");
  await mustCustomer(db, cid);
  await dropPrefix(c.env.PHOTOS, `c/${cid}/`);
  const del = (t: string, col = "customer_id") => db.prepare(`DELETE FROM ${t} WHERE ${col} = ?`).bind(cid);
  await db.batch([
    del("orders"), del("plan_versions"), del("day_logs"), del("followups"), del("photos"), del("notes"), del("badges"),
    del("sessions", "user_id"), del("customers", "user_id"), db.prepare("DELETE FROM users WHERE id = ? AND role = 'customer'").bind(cid),
  ]);
  return c.json(ok);
});

// ---------- orders ----------
admin.post("/api/admin/customers/:id/orders", async (c) => {
  const db = c.env.DB, cid = c.req.param("id"), b = await json(c);
  await mustCustomer(db, cid);
  const o: Order = { id: id(), customer_id: cid, order_date: date(b.order_date) as string, months: int(1, 120)(b.months) as number };
  await insert(db, "orders", o).run();
  return c.json(o);
});
admin.delete("/api/admin/orders/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM orders WHERE id = ?").bind(c.req.param("id")).run();
  return c.json(ok);
});

// ---------- plans ----------
admin.post("/api/admin/customers/:id/plans", async (c) => {
  const db = c.env.DB, cid = c.req.param("id"), b = await json(c);
  await mustCustomer(db, cid);
  const body = obj(b.body);
  const v: PlanVersion = {
    id: id(), customer_id: cid, type: oneOf(TYPES)(b.type) as PlanVersion["type"], start_date: date(b.start_date) as string,
    cycle_len: int(1, 366, 7)(b.cycle_len) as number, body: JSON.parse(body), created_at: Date.now(),
  };
  await insert(db, "plan_versions", { ...v, body }).run();
  return c.json(v);
});
admin.delete("/api/admin/plans/:id", async (c) => {
  const r = await c.env.DB.prepare("DELETE FROM plan_versions WHERE id = ? AND start_date > ?").bind(c.req.param("id"), todayMuscat()).run();
  return r.meta.changes ? c.json(ok) : fail(400, "started");
});

// ---------- day logs (admin corrections) ----------
admin.put("/api/admin/customers/:id/logs/:date", async (c) => {
  const db = c.env.DB, cid = c.req.param("id"), d = c.req.param("date"), b = await json(c);
  if (!isDate(d)) return fail(400, "date");
  const body = b.body;
  const valid = body && typeof body === "object" && !Array.isArray(body) && Object.entries(body).every(([k, v]) =>
    KEY.test(k) && Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === "number" && Number.isFinite(x)));
  if (!valid) return fail(400, "body");
  await mustCustomer(db, cid);
  const cur = await db.prepare("SELECT body FROM day_logs WHERE customer_id = ? AND date = ?").bind(cid, d).first<string>("body");
  const merged = mergeDay(cur ? (JSON.parse(cur) as DayBody) : {}, body as DayBody);
  await db.prepare(
    `INSERT INTO day_logs (customer_id, date, body, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(customer_id, date) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`,
  ).bind(cid, d, JSON.stringify(merged), Date.now()).run();
  return c.json(ok);
});

// ---------- follow-ups ----------
admin.post("/api/admin/customers/:id/followups", async (c) => {
  const db = c.env.DB, cid = c.req.param("id"), b = await json(c);
  await mustCustomer(db, cid);
  const f = { id: id(), customer_id: cid, ...pick(b, FU_FIELDS), author: "admin", updated_at: Date.now() } as Followup;
  await insert(db, "followups", f).run();
  return c.json(f);
});
admin.put("/api/admin/followups/:id", async (c) => {
  const b = await json(c);
  await update(c.env.DB, "followups", { ...pick(b, FU_FIELDS), updated_at: Date.now() }, "id = ?", c.req.param("id")).run();
  return c.json(ok);
});
admin.delete("/api/admin/followups/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM followups WHERE id = ?").bind(c.req.param("id")).run();
  return c.json(ok);
});

// ---------- notes ----------
admin.post("/api/admin/customers/:id/notes", async (c) => {
  const db = c.env.DB, cid = c.req.param("id"), b = await json(c);
  await mustCustomer(db, cid);
  const n = { id: id(), customer_id: cid, date: date(b.date), text: str(10_000)(b.text), private: bool(b.private ?? false), created_at: Date.now() };
  await insert(db, "notes", n).run();
  return c.json(note(n));
});
admin.delete("/api/admin/notes/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM notes WHERE id = ?").bind(c.req.param("id")).run();
  return c.json(ok);
});

// ---------- journey ----------
admin.post("/api/admin/customers/:id/finish", async (c) => {
  const db = c.env.DB, cid = c.req.param("id"), b = await json(c);
  await mustCustomer(db, cid);
  await db.batch([
    db.prepare("UPDATE customers SET journey_finished_at = ?, letter = ? WHERE user_id = ?").bind(todayMuscat(), optStr(20_000)(b.letter), cid),
    db.prepare("INSERT OR IGNORE INTO badges (customer_id, badge, earned_at) VALUES (?, 'finish', ?)").bind(cid, Date.now()),
  ]);
  return c.json(ok);
});
admin.post("/api/admin/customers/:id/unfinish", async (c) => {
  const db = c.env.DB, cid = c.req.param("id");
  await mustCustomer(db, cid);
  await db.batch([
    db.prepare("UPDATE customers SET journey_finished_at = NULL WHERE user_id = ?").bind(cid),
    db.prepare("DELETE FROM badges WHERE customer_id = ? AND badge = 'finish'").bind(cid),
  ]);
  return c.json(ok);
});

// ---------- templates ----------
admin.get("/api/admin/templates", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM templates ORDER BY type, name").all<Row>();
  return c.json(results.map(template));
});
admin.post("/api/admin/templates", async (c) => {
  const b = await json(c);
  const t = { id: id(), type: oneOf(TYPES)(b.type), track: oneOf(TRACKS, "gain")(b.track), ...pick(b, TEMPLATE_FIELDS), created_at: Date.now() };
  await insert(c.env.DB, "templates", t).run();
  return c.json(template(t) as Template);
});
admin.put("/api/admin/templates/:id", async (c) => putRow(c.env.DB, "templates", pick(await json(c), TEMPLATE_FIELDS, true), c.req.param("id")).then(() => c.json(ok)));
admin.delete("/api/admin/templates/:id", async (c) => delRow(c.env.DB, "templates", c.req.param("id")).then(() => c.json(ok)));

// ---------- exercises ----------
admin.get("/api/admin/exercises", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM exercises ORDER BY rowid").all<Row>();
  return c.json(results.map(exercise));
});
admin.post("/api/admin/exercises", async (c) => {
  const e = { id: id(), ...pick(await json(c), EX_FIELDS) };
  await insert(c.env.DB, "exercises", e).run();
  return c.json(exercise(e) as Exercise);
});
admin.put("/api/admin/exercises/:id", async (c) => putRow(c.env.DB, "exercises", pick(await json(c), EX_FIELDS, true), c.req.param("id")).then(() => c.json(ok)));
admin.delete("/api/admin/exercises/:id", async (c) => delRow(c.env.DB, "exercises", c.req.param("id")).then(() => c.json(ok)));

// ---------- recipes ----------
admin.post("/api/admin/recipes", async (c) => {
  const r = { id: id(), ...pick(await json(c), RECIPE_FIELDS) };
  await insert(c.env.DB, "recipes", r).run();
  return c.json(recipe(r));
});
admin.put("/api/admin/recipes/:id", async (c) => putRow(c.env.DB, "recipes", pick(await json(c), RECIPE_FIELDS, true), c.req.param("id")).then(() => c.json(ok)));
admin.delete("/api/admin/recipes/:id", async (c) => {
  const rid = c.req.param("id");
  await dropPrefix(c.env.PHOTOS, `r/${rid}/`);
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM photos WHERE recipe_id = ?").bind(rid),
    c.env.DB.prepare("DELETE FROM recipes WHERE id = ?").bind(rid),
  ]);
  return c.json(ok);
});

// ---------- settings ----------
admin.get("/api/admin/settings", async (c) => c.json(await getSettings(c.env.DB)));
admin.put("/api/admin/settings", async (c) => {
  const db = c.env.DB, b = await json(c);
  const s = pick(b, {
    whatsapp: optStr(40, ""), accent: (v: unknown) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fail(400, "accent")),
    muzuna_kcal: optNum, muzuna_prot: optNum,
  } satisfies Record<keyof typeof SETTINGS_DEFAULT, unknown>, true);
  const put = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  if (Object.keys(s).length) await db.batch(Object.entries(s).map(([k, v]) => put.bind(k, JSON.stringify(v))));
  return c.json(ok);
});

// ---------- helpers ----------
async function putRow(db: D1Database, table: string, f: Row, rid: string) {
  if (!Object.keys(f).length) return;
  const r = await update(db, table, f, "id = ?", rid).run();
  if (!r.meta.changes) fail(404, "not_found");
}
async function delRow(db: D1Database, table: string, rid: string) {
  await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(rid).run();
}
