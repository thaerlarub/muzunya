# Dependency allow-list

Exact versions only, each published at least 14 days before it was added (pnpm `minimumReleaseAge: 20160`), install scripts off (`.npmrc ignore-scripts=true`).

| Package | Version | Why |
|---|---|---|
| preact | 11.2.0 | UI (3 KB React-like), owner chose approach B |
| hono | 4.13.18 | Worker router, no dependencies of its own |
| vite | 8.3.8 | dev build of the client (dev only) |
| typescript | 7.0.2 | type check only (dev only) |
| wrangler | 4.160.0 | Cloudflare dev server, D1 local, deploy (dev only) |

Tests use `node --test` (Node 22 type stripping): no test framework.
