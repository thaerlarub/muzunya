import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Env } from "./db.ts";
import { auth, role, session } from "./auth.ts";
import { customerRoutes } from "./customer.ts";
import { admin, seed } from "./admin.ts";
import { photos } from "./photos.ts";

export type { Env };
const app = new Hono<Env>();

app.onError((e, c) => {
  if (e instanceof HTTPException) return c.json({ error: e.message || "error" }, e.status);
  console.error(e);
  return c.json({ error: "server" }, 500);
});
app.notFound((c) => c.json({ error: "not_found" }, 404));

app.get("/api/health", (c) => c.json({ ok: true }));
app.use("/api/*", session);
app.use("/api/admin/*", role("admin"), seed);
app.route("/", auth);
app.route("/", customerRoutes);
app.route("/", photos);
app.route("/", admin);

export default app;
