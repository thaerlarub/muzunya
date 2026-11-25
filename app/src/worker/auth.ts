// Sign-in, sessions, CSRF, must_change, /api/me.
import { Hono, type MiddlewareHandler, type Context } from "hono";
import { getCookie } from "hono/cookie";
import { normPhone } from "../shared/phone.ts";
import { DAY, Env, Row, b64, bundle, fail, getSettings, json, rand, sha256hex, unb64, exercise } from "./db.ts";
import type { MeAdmin, MeCustomer } from "../shared/types.ts";

const COOKIE = "__Host-mz";
const AGE = { admin: 43_200, customer: 34_560_000 }; // seconds: 12 h, 400 days
const WINDOW = 15 * 60_000;
const MC_OK = new Set(["/api/me", "/api/auth/password", "/api/auth/logout"]);

// ---------- passwords ----------
export async function hashPw(pw: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unb64(salt), iterations: 20_000 }, key, 256);
  return b64(new Uint8Array(bits));
}
export const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)));
export async function checkPw(pw: string, salt: string, hash: string) {
  const a = unb64(await hashPw(pw, salt)), b = unb64(hash);
  let d = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ (b[i] ?? 0);
  return d === 0;
}
export function newTempPassword() {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (x) => abc[x % abc.length]).join("");
}
const DUMMY_SALT = "AAAAAAAAAAAAAAAAAAAAAA==";
const DUMMY_HASH = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

// ---------- cookies and sessions ----------
const cookie = (c: Context, tok: string, age: number) =>
  c.header("Set-Cookie", `${COOKIE}=${tok}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`);

async function startSession(c: Context<Env>, uid: string, role: "admin" | "customer") {
  const tok = rand(32);
  await c.env.DB.prepare("INSERT INTO sessions (id_hash, user_id, csrf, expires_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256hex(tok), uid, rand(24), Date.now() + AGE[role] * 1000).run();
  cookie(c, tok, AGE[role]);
}

/** Loads the session for every /api route except health and login. Enforces CSRF, must_change, sliding expiry. */
export const session: MiddlewareHandler<Env> = async (c, next) => {
  const p = c.req.path;
  if (p === "/api/health" || p === "/api/auth/login") return next();
  const tok = getCookie(c, COOKIE);
  if (!tok) return fail(401, "auth");
  const sid = await sha256hex(tok);
  const r = await c.env.DB.prepare(
    "SELECT s.csrf, s.expires_at, u.id, u.role, u.must_change, u.status FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ?",
  ).bind(sid).first<Row>();
  const now = Date.now();
  if (!r || r.expires_at < now || r.status !== "active") return fail(401, "auth");
  if (c.req.method !== "GET" && c.req.header("X-CSRF-Token") !== r.csrf) return fail(403, "csrf");
  if (r.must_change && !MC_OK.has(p)) return fail(403, "must_change");
  if (r.role === "customer" && r.expires_at - now < 300 * DAY) {
    await c.env.DB.prepare("UPDATE sessions SET expires_at = ? WHERE id_hash = ?").bind(now + AGE.customer * 1000, sid).run();
    cookie(c, tok, AGE.customer);
  }
  c.set("user", { id: r.id, role: r.role, must_change: !!r.must_change, sid, csrf: r.csrf });
  await next();
};

export const role = (want: "admin" | "customer"): MiddlewareHandler<Env> => async (c, next) => {
  if (c.var.user.role !== want) fail(403, "role");
  await next();
};

// ---------- routes ----------
export const auth = new Hono<Env>();

auth.post("/api/auth/login", async (c) => {
  const db = c.env.DB, now = Date.now();
  const b = await json(c);
  const pw = typeof b.password === "string" ? b.password.slice(0, 200) : "";
  const phone = normPhone(typeof b.phone === "string" ? b.phone : "") ?? String(b.phone ?? "").slice(0, 40);
  const keys = ["p:" + phone, "ip:" + (c.req.header("CF-Connecting-IP") || "local")];
  // Count the attempt before checking the password (atomic, so parallel requests cannot slip past the limit).
  const bump = db.prepare(
    `INSERT INTO login_attempts (key, count, window_start) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN window_start + ? <= excluded.window_start THEN 1 ELSE count + 1 END,
       window_start = CASE WHEN window_start + ? <= excluded.window_start THEN excluded.window_start ELSE window_start END
     RETURNING count`,
  );
  const counts = await db.batch<{ count: number }>(keys.map((k) => bump.bind(k, now, WINDOW, WINDOW)));
  if (counts.some((r) => (r.results[0]?.count ?? 0) > 5)) return fail(429, "locked");

  const u = await db.prepare("SELECT id, role, salt, pw_hash, status FROM users WHERE phone = ?").bind(phone).first<Row>();
  const ok = await checkPw(pw, u?.salt ?? DUMMY_SALT, u?.pw_hash ?? DUMMY_HASH);
  if (!u || !ok) return fail(401, "bad");
  if (u.status !== "active") return fail(401, "archived");
  await db.batch([
    db.prepare("DELETE FROM login_attempts WHERE key = ?").bind(keys[0]),
    db.prepare("UPDATE login_attempts SET count = max(count - 1, 0) WHERE key = ?").bind(keys[1]), // a good sign-in does not count against the IP
    db.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now),
  ]);
  await startSession(c, u.id, u.role);
  return c.json({ ok: true });
});

auth.post("/api/auth/logout", async (c) => {
  await c.env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?").bind(c.var.user.sid).run();
  cookie(c, "", 0);
  return c.json({ ok: true });
});

auth.post("/api/auth/password", async (c) => {
  const db = c.env.DB, me = c.var.user;
  const b = await json(c);
  if (typeof b.next !== "string" || b.next.length < 6 || b.next.length > 200) return fail(400, "short");
  const u = await db.prepare("SELECT salt, pw_hash FROM users WHERE id = ?").bind(me.id).first<Row>();
  if (!u || typeof b.current !== "string" || !(await checkPw(b.current.slice(0, 200), u.salt, u.pw_hash))) return fail(400, "current");
  const salt = newSalt();
  await db.batch([
    db.prepare("UPDATE users SET salt = ?, pw_hash = ?, must_change = 0 WHERE id = ?").bind(salt, await hashPw(b.next, salt), me.id),
    db.prepare("DELETE FROM sessions WHERE user_id = ? AND id_hash != ?").bind(me.id, me.sid),
  ]);
  return c.json({ ok: true });
});

auth.get("/api/me", async (c) => {
  const db = c.env.DB, { sid, csrf, ...user } = c.var.user;
  if (user.must_change) return c.json({ user, csrf });
  if (user.role === "admin") return c.json<MeAdmin>({ user, csrf, settings: await getSettings(db) });
  const [b, settings, ex] = await Promise.all([
    bundle(db, user.id, false),
    getSettings(db),
    db.prepare("SELECT * FROM exercises ORDER BY rowid").all<Row>(),
  ]);
  if (!b) return fail(404, "not_found");
  return c.json<MeCustomer>({ user, csrf, ...b, settings, exercises: ex.results.map(exercise) });
});
