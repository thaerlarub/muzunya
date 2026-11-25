// Customer data store, saved on the phone first (IndexedDB), synced to /api/sync in the background.
// IndexedDB "mz": store "cache" (key "me" -> last MeCustomer), store "queue" (autoIncrement Op rows).
import type { Badge, BadgeId, Customer, DayLog, Followup, FollowupInput, MeCustomer, Op } from "../shared/types";
import { useEffect, useState } from "preact/hooks";
import { applyTick, mergeDay, versionStamp } from "../shared/sync";

type Row = { id: number; op: Op };

let db: Promise<IDBDatabase | null> | null = null;
function idb(): Promise<IDBDatabase | null> {
  return (db ??= new Promise((ok) => {
    try {
      const r = indexedDB.open("mz", 1);
      r.onupgradeneeded = () => { r.result.createObjectStore("cache"); r.result.createObjectStore("queue", { autoIncrement: true }); };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(null);
    } catch { ok(null); }
  }));
}
// ponytail: no IndexedDB (private mode) means the queue lives in memory only until the tab closes.
async function tx<T>(name: "cache" | "queue", mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T> | void, retry = true): Promise<T | undefined> {
  const d = await idb(); if (!d) return undefined;
  const r = await new Promise<{ v: T | undefined } | null>((ok) => {
    try {
      const t = d.transaction(name, mode), q = f(t.objectStore(name));
      t.oncomplete = () => ok({ v: q ? q.result : undefined });
      t.onerror = t.onabort = () => ok(null);
    } catch { ok(null); }
  });
  if (r) return r.v;
  // iOS can drop the IndexedDB connection after the app was in the background: reconnect once.
  if (retry) { db = null; return tx(name, mode, f, false); }
  return undefined;
}

let me: MeCustomer = null as unknown as MeCustomer;
let queue: Row[] = [];
let memId = -1; // ids for rows when IndexedDB is unavailable
let reveal: BadgeId[] = [];
const subs = new Set<() => void>();
const emit = () => { me = { ...me }; subs.forEach((f) => f()); };

function applyOp(m: MeCustomer, op: Op): void {
  if (op.kind === "tick") {
    const i = m.logs.findIndex((l) => l.date === op.date);
    const body = applyTick(i >= 0 ? m.logs[i].body : {}, op.key, op.v, op.t);
    m.logs = i >= 0 ? m.logs.map((l, j) => (j === i ? { date: l.date, body } : l)) : [...m.logs, { date: op.date, body }];
  } else if (op.kind === "fu") {
    const old = m.followups.find((f) => f.id === op.id);
    if (old && old.author === "admin") return;
    const f: Followup = { ...(old ?? { id: op.id, customer_id: m.customer.user_id, author: "customer" }), ...op.data, updated_at: op.t } as Followup;
    m.followups = old ? m.followups.map((x) => (x.id === op.id ? f : x)) : [...m.followups, f];
  } else m.followups = m.followups.filter((x) => x.id !== op.id || x.author === "admin");
}

function setBadges(b: Badge[]) {
  const had = new Set(me.badges.map((x) => x.badge));
  reveal.push(...b.filter((x) => !had.has(x.badge)).map((x) => x.badge));
  me.badges = b;
}

let timer: number | undefined, inflight: Promise<void> | null = null;
const schedule = (ms = 3000) => { clearTimeout(timer); timer = window.setTimeout(() => store.flush(), ms); };

async function add(op: Op) {
  applyOp(me, op);
  const row: Row = { id: memId--, op };
  queue.push(row);
  emit();
  schedule();
  const id = await tx("queue", "readwrite", (s) => s.add(op));
  if (typeof id === "number") row.id = id;
  tx("cache", "readwrite", (s) => s.put(me, "me"));
}

export const uid = () => crypto.randomUUID();

/** Last cached MeCustomer, for opening the app offline. */
export const cachedMe = () => tx<MeCustomer>("cache", "readonly", (s) => s.get("me")).then((m) => m ?? null);

export const store = {
  get me() { return me; },
  subscribe(fn: () => void) { subs.add(fn); return () => { subs.delete(fn); }; },

  /** Start with the fresh data from /api/me (sync), then re-apply queued ops and reveal badges earned since the cache. */
  init(fresh: MeCustomer) {
    me = fresh;
    (async () => {
      let [cached, keys, ops] = await Promise.all([
        cachedMe(),
        tx<IDBValidKey[]>("queue", "readonly", (s) => s.getAllKeys()),
        tx<Op[]>("queue", "readonly", (s) => s.getAll()),
      ]);
      if (cached && cached.customer.user_id !== fresh.customer.user_id) { await store.clear(); keys = []; ops = []; } // left over from another account
      const k = keys ?? [];
      queue = k.map((id, i) => ({ id: id as number, op: ops![i] })).concat(queue.filter((r) => !k.includes(r.id))); // keep ops not yet in IndexedDB
      const m = { ...fresh };
      queue.forEach((r) => applyOp(m, r.op));
      me = m;
      if (cached?.customer.user_id === fresh.customer.user_id) { const had = new Set(cached.badges.map((x) => x.badge)); reveal.push(...fresh.badges.filter((x) => !had.has(x.badge)).map((x) => x.badge)); }
      emit();
      tx("cache", "readwrite", (s) => s.put(me, "me"));
      store.flush();
    })();
  },

  tick(date: string, key: string, v: number) { return add({ kind: "tick", date, key, v, t: Date.now() }); },
  saveFollowup(id: string | null, data: FollowupInput) { return add({ kind: "fu", id: id ?? uid(), data, t: Date.now() }); },
  deleteFollowup(id: string) { return add({ kind: "fudel", id, t: Date.now() }); },
  /** Local update after an online call (mascot, wardrobe, photos). */
  set(p: Partial<MeCustomer>) { Object.assign(me, p); emit(); tx("cache", "readwrite", (s) => s.put(me, "me")); },
  patchCustomer(p: Partial<Customer>) { store.set({ customer: { ...me.customer, ...p } }); },
  pending: () => queue.length,
  /** Forget everything on this phone (sign out). */
  async clear() { queue = []; await Promise.all([tx("queue", "readwrite", (s) => s.clear()), tx("cache", "readwrite", (s) => s.clear())]); },

  /** Next badge to reveal, or null. */
  get reveal(): BadgeId | null { return reveal[0] ?? null; },
  shiftReveal() { reveal.shift(); emit(); },

  flush(keepalive = false): Promise<void> {
    return (inflight ??= send(keepalive).finally(() => { inflight = null; }));
  },
};

async function send(keepalive: boolean) {
  if (!queue.length || !navigator.onLine) return;
  let ok = false;
  const sent = queue.slice(0, 25); // small batches stay far under the D1 per-request query limit
  try {
    const r = await fetch("/api/sync", {
      method: "POST", credentials: "same-origin", keepalive,
      headers: { "Content-Type": "application/json", "X-CSRF-Token": me.csrf },
      body: JSON.stringify({ ops: sent.map((x) => x.op) }),
    });
    if (!r.ok && r.status !== 400) return; // offline, signed out, server down: keep the ops and retry later
    // 400 means the whole request was malformed (bad ops alone are skipped by the server), so drop it.
  // Ops are idempotent (timestamped, client ids), so one that is sent twice does no harm.
    const res: { logs: DayLog[]; followups: Followup[]; badges: Badge[]; vstamp: string } | null = r.ok ? await r.json() : null;
    const ids = new Set(sent.map((x) => x.id));
    queue = queue.filter((x) => !ids.has(x.id));
    await tx("queue", "readwrite", (s) => { sent.forEach((x) => x.id >= 0 && s.delete(x.id)); });
    if (res) {
      for (const l of res.logs) {
        const i = me.logs.findIndex((x) => x.date === l.date);
        me.logs = i >= 0 ? me.logs.map((x, j) => (j === i ? { date: x.date, body: mergeDay(x.body, l.body) } : x)) : [...me.logs, l];
      }
      me.followups = res.followups;
      queue.forEach((x) => x.op.kind !== "tick" && applyOp(me, x.op));
      setBadges(res.badges);
      // A new plan version was saved since she opened the app: reload so today's checklist matches it.
      if (res.vstamp !== versionStamp(me.versions)) fetch("/api/me", { credentials: "same-origin" }).then((x) => x.ok && x.json()).then((m) => m && store.init(m)).catch(() => {});
    }
    ok = true;
    emit();
    tx("cache", "readwrite", (s) => s.put(me, "me"));
  } catch { /* network error: retry on the next change, on online or on open */ }
  finally { if (queue.length) schedule(ok ? 500 : 30000); }
}

addEventListener("online", () => store.flush());
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") store.flush(true); });

/** Re-render on every store change; returns the current data. */
export function useMe(): MeCustomer {
  const [, set] = useState(0);
  useEffect(() => store.subscribe(() => set((n) => n + 1)), []);
  return store.me;
}
