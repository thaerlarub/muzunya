// API smoke test against `wrangler dev --port 8787`, fresh local DB.
// Setup (from app/): rm -rf .wrangler/state/v3/d1 && ./node_modules/.bin/wrangler d1 migrations apply DB --local
//   then ./node_modules/.bin/wrangler dev --port 8787 (in another shell) and: node tests/api.mjs
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const BASE = "http://localhost:8787";
const APP = fileURLToPath(new URL("..", import.meta.url));
let failed = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : " " + extra}`);
  if (!cond) failed++;
};
const run = (cmd, args) => execFileSync(cmd, args, { cwd: APP, encoding: "utf8" });
const sql = (q) => JSON.parse(run("./node_modules/.bin/wrangler", ["d1", "execute", "DB", "--local", "--json", "--command", q]))[0].results;
const today = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 28 * 3600e3).toISOString().slice(0, 10);

/** A tiny client with one cookie and the CSRF token. */
function client() {
  const s = { cookie: "", csrf: "" };
  s.req = async (method, path, body, { csrf = true } = {}) => {
    const headers = {};
    if (s.cookie) headers.Cookie = s.cookie;
    if (method !== "GET" && csrf) headers["X-CSRF-Token"] = s.csrf;
    let b = body;
    if (body !== undefined && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      b = JSON.stringify(body);
    }
    // One retry: undici can reuse a keep-alive socket the dev server already closed (after the slow wrangler d1 calls).
    const go = () => fetch(BASE + path, { method, headers, body: b });
    const r = await go().catch(go);
    const set = r.headers.getSetCookie().find((x) => x.startsWith("__Host-mz="));
    if (set) s.cookie = set.split(";")[0];
    const ct = r.headers.get("Content-Type") || "";
    const data = ct.includes("json") ? await r.json() : await r.arrayBuffer();
    return { status: r.status, data, headers: r.headers };
  };
  s.login = async (phone, password) => {
    const r = await s.req("POST", "/api/auth/login", { phone, password });
    if (r.status === 200) s.csrf = (await s.req("GET", "/api/me")).data.csrf;
    return r;
  };
  return s;
}

// health
check("health ok", (await (await fetch(BASE + "/api/health")).json()).ok === true);

// admin account through the script
const ADMIN = ["9100 0001", "adminpass1"];
const insertSql = run("node", ["scripts/create-admin.mjs", ...ADMIN]).trim();
run("./node_modules/.bin/wrangler", ["d1", "execute", "DB", "--local", "--command", insertSql]);

const ad = client();
let r = await ad.login(ADMIN[0], "wrong-pass");
check("wrong password 401", r.status === 401 && r.data.error === "bad", JSON.stringify(r));
r = await ad.login("+96891000001", ADMIN[1]);
check("admin login", r.status === 200 && ad.cookie.startsWith("__Host-mz="), JSON.stringify(r.data));
r = await ad.req("GET", "/api/me");
check("admin /api/me is MeAdmin", r.data.user?.role === "admin" && r.data.csrf && r.data.settings?.accent === "#c48bd9" && !("customer" in r.data), JSON.stringify(r.data));
const newCust = (name, phone) => ({ name, phone, height: 160, w0: 50, start_date: today });
r = await ad.req("POST", "/api/admin/customers", newCust("A", "92000001"), { csrf: false });
check("POST without CSRF 403", r.status === 403 && r.data.error === "csrf", JSON.stringify(r));

const A = await ad.req("POST", "/api/admin/customers", newCust("سارة", "9200 0001"));
const B = await ad.req("POST", "/api/admin/customers", newCust("نورة", "+968 9200-0002"));
check("admin creates A and B", A.status === 200 && B.status === 200 && A.data.temp_password?.length === 8 && B.data.id, JSON.stringify([A.data, B.data]));
r = await ad.req("POST", "/api/admin/customers", newCust("dup", "0096892000001"));
check("duplicate phone 400 exists", r.status === 400 && r.data.error === "exists");
r = await ad.req("GET", "/api/admin/templates");
check("seeded templates", r.status === 200 && Array.isArray(r.data) && r.data.length > 0, `${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);

// A: forced password change
const a = client();
r = await a.login("92000001", A.data.temp_password);
check("A logs in with temp password", r.status === 200);
r = await a.req("GET", "/api/recipes");
check("must_change blocks data route 403", r.status === 403 && r.data.error === "must_change", JSON.stringify(r));
r = await a.req("GET", "/api/me");
check("must_change /api/me only user+csrf", r.data.user?.must_change === true && !("customer" in r.data));
r = await a.req("POST", "/api/auth/password", { current: A.data.temp_password, next: "apass123" });
check("A sets password", r.status === 200, JSON.stringify(r.data));
r = await a.req("GET", "/api/me");
const meKeys = ["user", "csrf", "customer", "settings", "orders", "versions", "logs", "followups", "photos", "notes", "badges", "exercises"];
check("A /api/me is MeCustomer", r.status === 200 && meKeys.every((k) => k in r.data) && r.data.customer.phone === "+96892000001" && r.data.user.must_change === false, JSON.stringify(r.data).slice(0, 300));
r = await a.req("GET", "/api/recipes");
check("A reads recipes", r.status === 200 && r.data.length > 0);

// plan version + sync
const body = { slots: [{ id: "bf", name: "x", icon: "x", kind: "fixed" }], pages: [], vars: { dt: "", hd: "" } };
r = await ad.req("POST", `/api/admin/customers/${A.data.id}/plans`, { type: "meal", start_date: today, cycle_len: 7, body });
check("admin posts meal version", r.status === 200 && r.data.id && r.data.body.slots[0].id === "bf", JSON.stringify(r.data));
const now = Date.now();
r = await a.req("POST", "/api/sync", {
  ops: [
    { kind: "tick", date: today, key: "m:bf", v: 1, t: now },
    { kind: "tick", date: tomorrow, key: "m:bf", v: 1, t: now },
    { kind: "tick", date: today, key: "m:s1", v: 1, t: now },
    { kind: "tick", date: today, key: "m:s1", v: 0, t: now - 5000 },
    { kind: "fu", id: "fu-1", data: { date: today, weight: 50.5 }, t: now },
  ],
});
check("sync ok", r.status === 200 && r.data.ok, JSON.stringify(r.data));
r = await a.req("GET", "/api/me");
const day = r.data.logs.find((l) => l.date === today);
check("tick today persists", day?.body["m:bf"]?.[0] === 1, JSON.stringify(r.data.logs));
check("tick tomorrow skipped", !r.data.logs.some((l) => l.date === tomorrow));
check("newer t wins when older sent second", day?.body["m:s1"]?.[0] === 1 && day.body["m:s1"][1] === now, JSON.stringify(day));
check("fu op saved as hers", r.data.followups.some((f) => f.id === "fu-1" && f.weight === 50.5 && f.author === "customer"));
r = await a.req("POST", "/api/sync", { ops: [
  { kind: "tick", date: today, key: "bad key", v: 1, t: now },
  { kind: "tick", date: today, key: "kg:0", v: null, t: now },
  { kind: "tick", date: today, key: "m:s2", v: 1, t: Date.now() + 3600_000 }, // phone clock an hour fast
] });
check("bad ops skipped, good op kept, future time clamped", r.status === 200 && r.data.logs.find((l) => l.date === today)?.body["m:s2"]?.[0] === 1
  && r.data.logs.find((l) => l.date === today).body["m:s2"][1] <= Date.now() && typeof r.data.vstamp === "string", JSON.stringify(r.data?.logs));

// photos
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);
const fd = new FormData();
fd.append("file", new Blob([jpeg], { type: "image/jpeg" }), "x.jpg");
fd.append("date", today);
fd.append("caption", "hi");
const ph = await a.req("POST", "/api/photos", fd);
check("A uploads JPEG", ph.status === 200 && ph.data.id && ph.data.customer_id === A.data.id, JSON.stringify(ph.data));
r = await a.req("GET", `/api/photos/${ph.data.id}`);
check("A reads her photo", r.status === 200 && r.headers.get("Content-Type") === "image/jpeg" && r.headers.get("X-Content-Type-Options") === "nosniff" && r.data.byteLength === jpeg.length);
const fd2 = new FormData();
fd2.append("file", new Blob([new TextEncoder().encode("<svg></svg>")], { type: "image/jpeg" }), "x.jpg");
r = await a.req("POST", "/api/photos", fd2);
check("non-image upload 400", r.status === 400 && r.data.error === "type");

// B isolation
const b = client();
await b.login("92000002", B.data.temp_password);
await b.req("POST", "/api/auth/password", { current: B.data.temp_password, next: "bpass123" });
r = await b.req("GET", `/api/photos/${ph.data.id}`);
check("B gets 404 on A's photo", r.status === 404);
r = await b.req("DELETE", `/api/photos/${ph.data.id}`);
check("B cannot delete A's photo", r.status === 404);
r = await b.req("POST", "/api/sync", { ops: [{ kind: "fu", id: "fu-1", data: { date: today, weight: 99 }, t: now + 1000 }, { kind: "fudel", id: "fu-1", t: now }] });
const bme = (await b.req("GET", "/api/me")).data;
check("B /api/me has none of A's data", bme.customer.user_id === B.data.id && !JSON.stringify(bme).includes(A.data.id) && bme.logs.length === 0 && bme.photos.length === 0 && bme.versions.length === 0, JSON.stringify(bme).slice(0, 300));
const afu = sql(`SELECT weight FROM followups WHERE id = 'fu-1'`);
check("B cannot overwrite or delete A's follow-up", afu.length === 1 && afu[0].weight === 50.5, JSON.stringify(afu));
r = await b.req("GET", "/api/admin/overview");
check("customer on admin route 403", r.status === 403);

// admin overview and detail
r = await ad.req("GET", "/api/admin/overview");
const rowA = r.data.rows?.find((x) => x.customer.user_id === A.data.id);
check("overview rows", r.status === 200 && r.data.rows.length === 2 && rowA?.versions.length === 1 && rowA.logs.length === 1 && rowA.last_followup?.id === "fu-1", JSON.stringify(r.data).slice(0, 300));
r = await ad.req("GET", `/api/admin/customers/${A.data.id}`);
check("admin customer detail", r.status === 200 && r.data.photos.length === 1 && r.data.followups.length === 1);

// reset, archive, delete
r = await ad.req("POST", `/api/admin/customers/${A.data.id}/reset`);
check("admin reset returns temp", r.status === 200 && r.data.temp_password?.length === 8);
r = await a.req("GET", "/api/me");
check("A's session 401 after reset", r.status === 401);
await ad.req("POST", `/api/admin/customers/${B.data.id}/archive`, { archived: true });
r = await b.req("GET", "/api/me");
check("B's session 401 after archive", r.status === 401);
r = await b.login("92000002", "bpass123");
check("archived B login 401 archived", r.status === 401 && r.data.error === "archived", JSON.stringify(r));
r = await ad.req("DELETE", `/api/admin/customers/${A.data.id}`);
check("delete A ok", r.status === 200);
const left = sql(
  ["users WHERE id", "customers WHERE user_id", "plan_versions WHERE customer_id", "day_logs WHERE customer_id", "followups WHERE customer_id", "photos WHERE customer_id", "sessions WHERE user_id"]
    .map((t) => `(SELECT count(*) FROM ${t} = '${A.data.id}')`).join(" + ").replace(/^/, "SELECT ").concat(" AS n"),
);
check("delete A removes rows", left[0].n === 0, JSON.stringify(left));
r = await ad.req("GET", `/api/admin/customers/${A.data.id}`);
check("deleted A 404", r.status === 404);

// lockout (last, so the shared local IP counter does not block the steps above)
sql("DELETE FROM login_attempts");
const x = client();
const codes = [];
for (let i = 0; i < 6; i++) codes.push((await x.login("93000009", "nope-" + i)).status);
check("5 wrong then 6th 429", codes.slice(0, 5).every((s) => s === 401) && codes[5] === 429, codes.join(","));

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
