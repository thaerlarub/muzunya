# Muzuna app (Cloudflare Workers + D1 + R2)

One admin, many customers, Arabic RTL. Preact client in `src/client`, Hono Worker in `src/worker`, shared logic in `src/shared`.
Design: `../docs/superpowers/specs/2026-11-25-muzuna-app-design.md`. API: `API.md`. Dependencies: `DEPENDENCIES.md`.

## First deploy (owner, about 15 minutes)

1. Cloudflare account. Add a payment method so R2 can be enabled (the free 10 GB is enough; the card is only required by Cloudflare). Turn on billing notifications.
2. In this folder:
   ```bash
   pnpm install --frozen-lockfile
   ./node_modules/.bin/wrangler login
   ./node_modules/.bin/wrangler d1 create muzuna          # copy the database_id it prints into wrangler.jsonc
   ./node_modules/.bin/wrangler r2 bucket create muzuna-photos
   ./node_modules/.bin/wrangler d1 migrations apply DB --remote
   ./node_modules/.bin/wrangler d1 execute DB --remote --command "$(node scripts/create-admin.mjs '<your phone>' '<your password>')"
   pnpm build && ./node_modules/.bin/wrangler deploy
   ```
3. Open `https://muzuna.<your-account>.workers.dev`, sign in with your phone and password, then set the WhatsApp number, colour and the Muzuna label in Settings.

Type the admin password in your own terminal only; it is hashed by the script and never stored in plain text.

## Updates

```bash
pnpm build && ./node_modules/.bin/wrangler deploy
./node_modules/.bin/wrangler d1 migrations apply DB --remote   # only when migrations/ has a new file
```

## Adding a customer

Admin: "+ زبونة جديدة", fill in her details, then send her the link and the temporary password (the WhatsApp button does it). She sets her own password on first sign-in. "إعادة تعيين كلمة المرور" on her profile issues a new temporary one.

## Local development

```bash
./node_modules/.bin/wrangler d1 migrations apply DB --local
./node_modules/.bin/wrangler d1 execute DB --local --command "$(node scripts/create-admin.mjs '9000 0001' admin123)"
pnpm build && pnpm dev            # http://localhost:8787
pnpm test                         # pure logic tests
pnpm check                        # type check client and worker
node tests/api.mjs                # API checks; needs a fresh local DB and pnpm dev running
```

On the Windows drive (`/mnt/c`) file watching does not work: after `pnpm build`, restart `pnpm dev` so it serves the new files.
