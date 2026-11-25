// Photo upload, serving and delete. R2 keys: c/<customer_id>/<id> or r/<recipe_id>/<id>.
import { Hono } from "hono";
import { todayMuscat } from "../shared/dates.ts";
import { Env, Row, fail, id, isDate, photo } from "./db.ts";
import type { Photo } from "../shared/types.ts";

const MAX = 5 * 1024 * 1024;

function sniff(b: Uint8Array): string | null {
  const at = (i: number, s: string) => [...s].every((ch, j) => b[i + j] === ch.charCodeAt(0));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && at(1, "PNG")) return "image/png";
  if (at(0, "RIFF") && at(8, "WEBP")) return "image/webp";
  return null;
}

export const photos = new Hono<Env>();

photos.post("/api/photos", async (c) => {
  const db = c.env.DB, me = c.var.user;
  const len = Number(c.req.header("Content-Length"));
  if (!len || len > MAX + 100_000) return fail(400, "too_big"); // no length (chunked) or too big: refuse before parsing
  const fd = await c.req.formData().catch(() => fail(400, "form"));
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return fail(400, "file");
  if (file.size > MAX) return fail(400, "too_big");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type) return fail(400, "type");
  const date = fd.get("date") || todayMuscat();
  if (!isDate(date)) return fail(400, "date");
  const cap = fd.get("caption");
  const caption = typeof cap === "string" && cap.trim() ? cap.trim().slice(0, 300) : null;

  let customer_id: string | null = me.id, recipe_id: string | null = null;
  if (me.role === "admin") {
    const cid = fd.get("customer_id"), rid = fd.get("recipe_id");
    if (typeof cid === "string" && cid) {
      if (!(await db.prepare("SELECT 1 FROM customers WHERE user_id = ?").bind(cid).first())) return fail(404, "not_found");
    } else if (typeof rid === "string" && rid) {
      if (!(await db.prepare("SELECT 1 FROM recipes WHERE id = ?").bind(rid).first())) return fail(404, "not_found");
      const n = await db.prepare("SELECT count(*) AS n FROM photos WHERE recipe_id = ?").bind(rid).first<number>("n");
      if ((n ?? 0) >= 2) return fail(400, "full");
    } else return fail(400, "target");
    customer_id = typeof cid === "string" && cid ? cid : null;
    recipe_id = customer_id ? null : (rid as string);
  }
  const p: Photo = { id: id(), customer_id, recipe_id, date, caption, author: me.role, created_at: Date.now() };
  const key = customer_id ? `c/${customer_id}/${p.id}` : `r/${recipe_id}/${p.id}`;
  await c.env.PHOTOS.put(key, bytes, { httpMetadata: { contentType: type } });
  await db.prepare("INSERT INTO photos (id, customer_id, recipe_id, r2_key, date, caption, author, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(p.id, p.customer_id, p.recipe_id, key, p.date, p.caption, p.author, p.created_at).run();
  return c.json(p);
});

photos.get("/api/photos/:id", async (c) => {
  const me = c.var.user;
  const r = me.role === "admin"
    ? await c.env.DB.prepare("SELECT r2_key FROM photos WHERE id = ?").bind(c.req.param("id")).first<Row>()
    : await c.env.DB.prepare("SELECT r2_key FROM photos WHERE id = ? AND (customer_id = ? OR (customer_id IS NULL AND recipe_id IS NOT NULL))")
      .bind(c.req.param("id"), me.id).first<Row>();
  const obj = r && (await c.env.PHOTOS.get(r.r2_key));
  if (!obj) return fail(404, "not_found");
  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
});

photos.delete("/api/photos/:id", async (c) => {
  const me = c.var.user, db = c.env.DB;
  const r = me.role === "admin"
    ? await db.prepare("SELECT r2_key FROM photos WHERE id = ?").bind(c.req.param("id")).first<Row>()
    : await db.prepare("SELECT r2_key FROM photos WHERE id = ? AND customer_id = ? AND author = 'customer'").bind(c.req.param("id"), me.id).first<Row>();
  if (!r) return fail(404, "not_found");
  await c.env.PHOTOS.delete(r.r2_key);
  await db.prepare("DELETE FROM photos WHERE id = ?").bind(c.req.param("id")).run();
  return c.json({ ok: true });
});
