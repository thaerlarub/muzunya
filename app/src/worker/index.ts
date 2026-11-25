import { Hono } from "hono";

export type Env = { Bindings: Cloudflare.Env };
const app = new Hono<Env>();
app.get("/api/health", (c) => c.json({ ok: true }));
export default app;
