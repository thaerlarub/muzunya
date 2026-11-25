// Customer routes. Every query uses the session user id, never an id from the request (except op ids, always scoped to her).
import { Hono } from "hono";
import { applyTick } from "../shared/sync.ts";
import { canTick, todayMuscat } from "../shared/dates.ts";
import { earnedBadges } from "../shared/badges.ts";
import { role } from "./auth.ts";
import type { DayBody, Op } from "../shared/types.ts";
import {
  CUSTOMER_SQL, DAY, Env, FU_FIELDS, Row, badge, customer, dayLog, fail, followup, isDate, json, pick, recipe, version,
} from "./db.ts";

const KEY = /^(m|x|kg):[\w-]{1,40}$/;
const OP_ID = /^[\w-]{1,64}$/;
const MASCOTS = ["girl", "kitten", "bunny", "camel"];
const WEAR = ["bow", "necklace", "scarf", "glasses", "flower", "crown"];

/** Throws 400 on any malformed op; returns the op with follow-up data validated. */
function checkOp(op: any, now: number): Op {
  const t = op?.t;
  if (typeof t !== "number" || !Number.isFinite(t) || t < now - 60 * DAY || t > now + 600_000) return fail(400, "op");
  if (op.kind === "tick" && isDate(op.date) && typeof op.key === "string" && KEY.test(op.key) && typeof op.v === "number" && Number.isFinite(op.v))
    return { kind: "tick", date: op.date, key: op.key, v: op.v, t };
  if (op.kind === "fu" && typeof op.id === "string" && OP_ID.test(op.id) && op.data && typeof op.data === "object")
    return { kind: "fu", id: op.id, data: pick(op.data, FU_FIELDS) as any, t };
  if (op.kind === "fudel" && typeof op.id === "string" && OP_ID.test(op.id)) return { kind: "fudel", id: op.id, t };
  return fail(400, "op");
}

export const customerRoutes = new Hono<Env>();

customerRoutes.post("/api/sync", role("customer"), async (c) => {
  const db = c.env.DB, uid = c.var.user.id, now = Date.now();
  const b = await json(c);
  if (!Array.isArray(b.ops) || b.ops.length > 500) return fail(400, "ops");
  const ops = b.ops.map((o: unknown) => checkOp(o, now));

  const [cr, vr, lr] = await db.batch<Row>([
    db.prepare(CUSTOMER_SQL + " WHERE c.user_id = ?").bind(uid),
    db.prepare("SELECT * FROM plan_versions WHERE customer_id = ?").bind(uid),
    db.prepare("SELECT date, body FROM day_logs WHERE customer_id = ?").bind(uid),
  ]);
  if (!cr.results[0]) return fail(404, "not_found");
  const cust = customer(cr.results[0]);
  const versions = vr.results.map(version);
  const logs = new Map<string, DayBody>(lr.results.map((r) => [r.date, dayLog(r).body]));
  const today = todayMuscat();

  const touched = new Set<string>(), changed = new Set<string>();
  const stmts: D1PreparedStatement[] = [];
  for (const op of ops as Op[]) {
    if (op.kind === "tick") {
      touched.add(op.date);
      if (!canTick(versions, op.key, op.date, today)) continue;
      logs.set(op.date, applyTick(logs.get(op.date) ?? {}, op.key, op.v, op.t));
      changed.add(op.date);
    } else if (op.kind === "fu") {
      const d = op.data;
      // Insert as hers, or update only her own customer-authored row when this change is newer. Admin rows are never touched.
      stmts.push(db.prepare(
        `INSERT INTO followups (id, customer_id, date, weight, arm, chest, waist, hips, thigh, appetite, note, author, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'customer', ?)
         ON CONFLICT(id) DO UPDATE SET date = excluded.date, weight = excluded.weight, arm = excluded.arm, chest = excluded.chest,
           waist = excluded.waist, hips = excluded.hips, thigh = excluded.thigh, appetite = excluded.appetite, note = excluded.note,
           updated_at = excluded.updated_at
         WHERE followups.customer_id = ? AND followups.author = 'customer' AND followups.updated_at <= excluded.updated_at`,
      ).bind(op.id, uid, d.date, d.weight, d.arm, d.chest, d.waist, d.hips, d.thigh, d.appetite, d.note, op.t, uid));
    } else {
      stmts.push(db.prepare("DELETE FROM followups WHERE id = ? AND customer_id = ? AND author = 'customer'").bind(op.id, uid));
    }
  }
  // ponytail: read-modify-write per day; two syncs of the same day in the same instant can drop one side. Fine for one phone per customer.
  for (const d of changed) {
    stmts.push(db.prepare(
      `INSERT INTO day_logs (customer_id, date, body, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(customer_id, date) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`,
    ).bind(uid, d, JSON.stringify(logs.get(d)), now));
  }
  const fuSel = db.prepare("SELECT * FROM followups WHERE customer_id = ? ORDER BY date, updated_at").bind(uid);
  const res = await db.batch<Row>([...stmts, fuSel]);
  const followups = res[res.length - 1].results.map(followup);

  const earned = earnedBadges({ customer: cust, versions, logs: [...logs].map(([date, body]) => ({ date, body })), followups, today });
  const award = db.prepare("INSERT OR IGNORE INTO badges (customer_id, badge, earned_at) VALUES (?, ?, ?)");
  const br = await db.batch<Row>([
    ...earned.map((x) => award.bind(uid, x, now)),
    db.prepare("SELECT badge, earned_at FROM badges WHERE customer_id = ? ORDER BY earned_at").bind(uid),
  ]);
  return c.json({
    ok: true,
    logs: [...touched].filter((d) => logs.has(d)).map((date) => ({ date, body: logs.get(date)! })),
    followups,
    badges: br[br.length - 1].results.map(badge),
  });
});

customerRoutes.put("/api/me/mascot", role("customer"), async (c) => {
  const { mascot } = await json(c);
  if (!MASCOTS.includes(mascot)) return fail(400, "mascot");
  await c.env.DB.prepare("UPDATE customers SET mascot = ? WHERE user_id = ?").bind(mascot, c.var.user.id).run();
  return c.json({ ok: true });
});

customerRoutes.put("/api/me/wardrobe", role("customer"), async (c) => {
  const { wardrobe: w } = await json(c);
  if (!w || typeof w !== "object" || Array.isArray(w) || Object.entries(w).some(([k, v]) => !WEAR.includes(k) || typeof v !== "boolean"))
    return fail(400, "wardrobe");
  await c.env.DB.prepare("UPDATE customers SET wardrobe = ? WHERE user_id = ?").bind(JSON.stringify(w), c.var.user.id).run();
  return c.json({ ok: true });
});

customerRoutes.get("/api/recipes", async (c) => {
  const db = c.env.DB;
  const [rs, ps] = await db.batch<Row>([
    db.prepare("SELECT * FROM recipes ORDER BY sort, rowid"),
    db.prepare("SELECT id, recipe_id FROM photos WHERE recipe_id IS NOT NULL ORDER BY created_at"),
  ]);
  const byRecipe = new Map<string, string[]>();
  for (const p of ps.results) byRecipe.set(p.recipe_id, [...(byRecipe.get(p.recipe_id) ?? []), p.id]);
  return c.json(rs.results.map((r) => recipe(r, (byRecipe.get(r.id) ?? []).slice(0, 2))));
});
