# Muzuna app on Cloudflare: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Multi-user Muzuna app (one admin, ~100 customers) on Cloudflare free tier: plans with a free page builder, daily checklists synced from the phone, follow-up, gallery, mascots and badges, printable plan and gift PDFs.

**Architecture:** One package in `app/`. Vite builds a Preact SPA into `app/dist/client`, served as Workers static assets; a Hono Worker serves `/api/*` against D1 and R2. Pure logic (dates, portions, sync merge, stats, badges, growth, package) lives in `app/src/shared/` and is used by both sides and tested with `node --test` (Node 22 type stripping, no test framework).

**Tech Stack:** Preact, Hono, Vite (JSX through esbuild, no preset plugin), TypeScript (type check only), Wrangler (dev, D1 local, deploy). Nothing else.

**Spec:** `docs/superpowers/specs/2026-11-25-muzuna-app-design.md` (section 0 overrides the rest).

## Global Constraints

- Exact dependency versions, lockfile committed, each version at least 14 days old on 2026-11-25 (published on or before 2026-11-11), install scripts off (`.npmrc` `ignore-scripts=true`), allow-list in `app/DEPENDENCIES.md`.
- No CDNs: fonts (Tajawal, Aref Ruqaa) and the product photo self-hosted in `app/public/`. CSP via `app/public/_headers`: `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'`.
- All UI Arabic RTL. No em dashes anywhere. No Arabic and English in one sentence. Latin digits. Phone numbers in `<bdo dir="ltr">`.
- Print pages: no `color-mix()`, no `letter-spacing` or `text-align: justify` on Arabic. Accent shades computed in JS with `mix()` from `src/app.html`.
- Dates are Asia/Muscat (UTC+4, no DST). Week is Saturday to Friday.
- Calculation from `CLAUDE.md` section 6: `AGE=25`, `BASE=2200`, `f = clamp((target - muzuna_kcal)/2200, 0.75, 1.5)`, rounding per unit (`g` to 10, 5 below 50; `ml` to 25 min 50; `sp`,`pc` whole min 1; `hf` halves). Muzuna 25 g never scaled.
- Motion 150 to 300 ms for UI, every animation off under `prefers-reduced-motion` (state still updates). 44 px hit areas.
- Every customer query filters on the session user id. Parameterised SQL only. Cookie `__Host-mz` HttpOnly Secure SameSite=Lax Path=/. Header `X-CSRF-Token` on every non-GET.
- PBKDF2-SHA256, 16-byte salt, 20 000 iterations, 32 bytes, computed in the Worker.

## Review Focus

1. Phone number typed in another form (`9123 4567`, `0096891234567`, `+968 9123-4567`) signs in to the same account: `normPhone` test in Task 2.
2. Two devices tick the same slot offline at different times: the later tick wins on both after sync: `mergeDay` test in Task 2.
3. Ticking on a past day of the active version works; a future day or an older version is refused by the Worker: `canTick` test in Task 2, enforced in `/api/sync` (Task 8).
4. A long page in the builder never clips in print: overflow warning with "move to new page" in Task 7.
5. A customer requesting another customer's photo or data by id gets 404: covered in `tests/api.mjs` (Task 3 and Task 10).

---

### Task 1: Scaffold, tooling, database

**Files:** Create `app/package.json`, `app/.npmrc`, `app/pnpm-lock.yaml`, `app/DEPENDENCIES.md`, `app/tsconfig.json`, `app/vite.config.ts`, `app/wrangler.jsonc`, `app/migrations/0001_init.sql`, `app/index.html`, `app/src/client/main.tsx`, `app/src/worker/index.ts`, `app/public/_headers`, `app/public/fonts/*.woff2`, `app/public/fonts.css`, `app/public/product.jpg`, `app/.gitignore`, repo `git init` at `muzuna/muzuna/`.

- [ ] `git init`, `.gitignore` (node_modules, dist, .wrangler, .dev.vars).
- [ ] Pin versions with `npm view <pkg> time --json`, newest version published on or before 2026-11-11: preact, hono, vite, typescript, wrangler. Write them and the one-line reason each into `DEPENDENCIES.md`. `pnpm install --frozen-lockfile` after first lock.
- [ ] Fonts: download woff2 (Arabic and Latin subsets) of Tajawal 400/500/700/800 and Aref Ruqaa 700 once, `@font-face` in `fonts.css`.
- [ ] `wrangler.jsonc`: `main: src/worker/index.ts`, `assets: {directory: dist/client, not_found_handling: single-page-application, run_worker_first: ["/api/*"]}`, D1 binding `DB`, R2 binding `PHOTOS`, `compatibility_date` 2026-11-01.
- [ ] Migration with tables from spec 16 minus `audit`, `day_logs` without version columns, `sessions(id_hash PK, user_id, csrf, expires_at)`.
- [ ] Scripts: `build` (vite build), `dev` (vite build --watch & wrangler dev), `test` (`node --test src/shared/*.test.ts`), `check` (tsc --noEmit), `db:local` (wrangler d1 migrations apply DB --local).
- [ ] Verify: `pnpm build && pnpm db:local && wrangler dev`, `curl localhost:8787/api/health` returns `{"ok":true}`, `/` serves the shell.
- [ ] Commit.

### Task 2: Shared pure logic (tested)

**Files:** Create `app/src/shared/{dates,portions,phone,sync,stats,badges,growth,pkg}.ts` and one `*.test.ts` each.

**Produces:**
- `muscatDate(ms?: number): string` (YYYY-MM-DD), `addDays(d: string, n: number): string`, `diffDays(a: string, b: string): number`, `weekStart(d: string): string` (Saturday).
- `activeVersion<T extends {start_date:string}>(vs: T[], date: string): T | null`, `planDay(v: {start_date:string, cycle_len:number}, date: string): number` (1-based).
- `canTick(versions, date, today): boolean`: true when `date <= today` and `date >= active(today).start_date`.
- `fmt(v: number, u: string): number|string`, `scale(kcal: number, muzunaKcal: number): number`, `targets(p: {w,h,act,sur,man,muzunaKcal}): {kcal, prot, bmi, lo, hi, f, warn}`, `renderTokens(s: string, f: number): {html: string}` with tokens `{b|u}` and `{b|u|manual}`; `setManual(s, i, value)`, `clearManual(s)`.
- `normPhone(s: string): string|null` (`+968` default for 8-digit numbers, `00` to `+`).
- Day log shape `DayBody = Record<string, [v: number, t: number]>`, keys `m:<slotId>`, `x:<exerciseIndex>`, `kg:<exerciseIndex>`. `mergeDay(a: DayBody, b: DayBody): DayBody` (per key larger `t` wins).
- `dayMealPct(body, slots)`, `workoutDone(body, day)`, `streak(logs: {date, body}[], today): {cur, best}` (counts a tick only when made on its date or the next day), `weekStats(...)`.
- `earnedBadges(ctx): BadgeId[]` with ids `week1,kg1,streak7,perfect,half,finish`; `BADGE_ITEM = {week1:'bow',kg1:'necklace',streak7:'scarf',perfect:'glasses',half:'flower',finish:'crown'}`.
- `growth({w0, latest, goal, track}): number` 0..1 (goal: share of way; no goal: kg gained / 6, clamp).
- `packageEnd(orders: {order_date, months}[]): string|null` (stacking, 30 days a month), `packageDue(end, today): boolean` (5 days or overdue).

- [ ] Tests with exact values, including: `fmt(47,'g')===45`, `fmt(183,'g')===180`, `fmt(30,'ml')===50`, `fmt(1.3,'hf')==='1½'`; `scale(2600,0)` 1.1818..., `scale(1500,0)` 0.75; with `muzunaKcal=100`, `scale(2300,100)===1`; `planDay({start_date:'2026-11-20',cycle_len:7},'2026-11-27')===1`; `normPhone('9123 4567')===normPhone('0096891234567')==='+96891234567'`; merge where older `t` loses on both orders; streak where a late tick (made 3 days after) does not count; `packageEnd` stacking of a renewal made before the end.
- [ ] Run `pnpm test`: fail, implement, pass. Commit.

### Task 3: Auth, sessions, CSRF, admin script

**Files:** Create `app/src/worker/{auth.ts,db.ts}`, `app/scripts/create-admin.mjs`, `app/tests/api.mjs`. Modify `app/src/worker/index.ts`.

**Produces:** routes `POST /api/auth/login {phone,password}`, `POST /api/auth/logout`, `POST /api/auth/password {current?, next}` (clears `must_change`), `GET /api/me` → `{user:{id,role,must_change}, csrf, ...role data}`; middleware `requireUser(role?)` setting `c.var.user`; `hashPw(pw, salt)`; `newTempPassword()` (8 chars, no look-alikes).

- [ ] Lockout: 5 failures per phone or per IP in 15 min → 429 for 15 min (`login_attempts`).
- [ ] Customer session expiry 400 days sliding, admin 12 h. CSRF checked on every non-GET (403).
- [ ] `create-admin.mjs <phone> <password>` prints the SQL insert (same PBKDF2 params) for `wrangler d1 execute DB --local|--remote --command`.
- [ ] `tests/api.mjs` (plain fetch against `wrangler dev`): wrong password 401, 6th try 429, login sets cookie, POST without CSRF 403, `must_change` user gets 403 on data routes until password set.
- [ ] Commit.

### Task 4: Admin customers

**Files:** Create `app/src/worker/admin.ts`, `app/src/client/admin/{List.tsx,Customer.tsx,Profile.tsx}`, `app/src/client/{api.ts,ui.tsx,app.css}`.

**Produces:** `api.get/post/put/del(path, body?)` (adds CSRF, throws `{status}`); admin routes `GET /api/admin/overview` (customers + latest followup + active versions + this week's day_logs + badges + package end), `POST /api/admin/customers` (returns temp password once), `PUT /api/admin/customers/:id`, `POST .../:id/reset`, `POST .../:id/signout`, `POST .../:id/archive`, `DELETE .../:id` (rows and R2 objects), `POST/DELETE .../:id/orders`.

- [ ] List: search, flags (due call 7+ days, not ticking 2+ days, goal reached, plan 4+ weeks old, package due), week meal % and workouts, badges. Flags computed client-side with Task 2 functions.
- [ ] Customer page tabs: profile, plans, ticks, follow-up, gallery, notes, journey.
- [ ] Commit.

### Task 5: Plans, templates, exercise library

**Files:** Create `app/src/shared/plan.ts` (types), `app/src/shared/seed.ts` (meal template from `src/meal-data.js`, recipes from `standalone/Muzuna_Recipes.html`, exercises EX/PLAN/SCHED/LV from `standalone/Muzuna_Workout_Plan.html`), `app/src/shared/generator.ts`, `app/src/worker/plans.ts`, `app/src/client/admin/{Exercises.tsx,Templates.tsx}`.

**Produces types:**
- `Slot = {id, name, icon, kind:'fixed'|'choose'|'rotation'|'counter', text?, options?: Card[], items?: string[], target?: number}`; `Card = {icon, lines: string[], note?, tag?}`.
- `MealBody = {slots: Slot[], pages: Page[], vars: {dt, hd}}`; `ExDay = {rest:true, note?} | {title, ic, items: ExItem[]}`; `ExItem = {ex?: string, name?: string, sets, reps, rest, note?}`; `ExBody = {days: ExDay[], pages: Page[], vars}`.
- `Page = {id, cover?: boolean, blocks: Block[]}`; `Block` union in Task 6.
- `defaultMeal(): MealBody` (today's 8 pages), `generateEx(place, level, daysPerWeek, lib): ExBody` (booklet pages, portrait), `seedExercises()`, `seedRecipes()`.
- Routes: `GET/POST /api/admin/customers/:id/plans` (new version `{type,start_date,cycle_len,body}`), `GET/POST/PUT/DELETE /api/admin/templates`, `/api/admin/exercises`; first-run seeding when tables are empty.
- [ ] Test `generator.test.ts`: 3 days a week at home level 0 gives 7 days, workouts on days 1, 3, 5, each with sets 3 and reps "12 إلى 15".
- [ ] Commit.

### Task 6: Page renderer and print

**Files:** Create `app/src/client/pages/{blocks.tsx,Page.tsx,print.css,Print.tsx}`.

**Produces:** `Block` union: `bar{t,small?}`, `sub{t}`, `text{html}`, `table{head:string[], rows:string[][], check?:boolean}`, `image{src:'product'|photoId}`, `spacer{h}`, `divider`, `cols{a:string,b:string}`, `points{items:{badge,html}[]}`, data blocks `slotCards{slot, style:'cards'|'tiles'}`, `rotation{slots:string[]}`, `dose`, `customer`, `tracker`, `signoff`, `exWeek`, `exDays`, `exLog`, `mzWeek`. `<PlanPages body ctx editable onEdit/>` renders A4 pages (frame, page number tab, footer), expands `rotation` (7 days a page) and `exDays` (one page per workout day). `sanitize(html)` keeps only `b,strong,br,ul,ol,li,p,div,span.acc`.
- [ ] Portion spans `.q` carry `data-path` and `data-i`; editing sets the manual token via `setManual`.
- [ ] `#/print/plan/:cid` renders active meal pages then active exercise pages and calls `window.print()`; `@page {size: A4; margin: 0}`.
- [ ] Verify visually against today's `dist/muzuna_app.html` pages with Playwright screenshots at A4.
- [ ] Commit.

### Task 7: Page builder and plan editors

**Files:** Create `app/src/client/admin/{PlanEditor.tsx,Builder.tsx,SlotEditor.tsx,ExEditor.tsx}`.

- [ ] Builder: page list (add, duplicate, delete, move), block list per page (add from palette, edit form, move, delete), live preview with the renderer, overflow check (`scrollHeight > clientHeight` of the page content) shows a warning with "move last block to a new page".
- [ ] Slot editor (add, remove, rename, reorder, kind, options, rotation items, counter target), cycle length, exercise day editor (rest or workout, exercises from library or custom), generator button, "recalculate portions", save as new version with start date, save as template, load template, copy from another customer, history list (view only).
- [ ] Commit.

### Task 8: Customer Today and sync

**Files:** Create `app/src/client/customer/{App.tsx,Today.tsx,store.ts}`, `app/src/worker/customer.ts`.

**Produces:** `/api/me` for customers returns profile, settings, versions (all), day_logs, followups, badges, notes (public). `POST /api/sync {ops: {kind:'tick', date, key, v, t}[] | {kind:'fu', ...}}` merges per day with `mergeDay`, rejects ticks where `!canTick`, returns fresh badges. `store.ts`: IndexedDB `mz` db with stores `cache` and `queue`, `queueOp(op)`, flush 3 s after last change, on `visibilitychange` hidden (`fetch keepalive`), on `online` and on open; "will sync" dot.
- [ ] Today: date switcher (past days of active version), meal checklist with today's rotation dish rendered with portions, water 8 glasses, exercise checklist with sets, reps, video link, kg field, rest card, rings, streak, week stats, package banner with WhatsApp renew.
- [ ] Commit.

### Task 9: Follow-up, notes, tick grid

**Files:** Create `app/src/client/{customer/Followup.tsx,admin/Ticks.tsx,admin/Notes.tsx,charts.tsx}`, routes in `customer.ts` and `admin.ts`.
- [ ] Follow-up entries (date, weight, arm, chest, waist, hips, thigh, appetite 1 to 5, note), customer edits or deletes own only, admin entries locked for her; weight line chart, sizes first vs latest.
- [ ] Notes: dated public log and private notes (admin only).
- [ ] Admin tick grid: days by slots and exercises, kg shown.
- [ ] Commit.

### Task 10: Photos, gallery, recipes

**Files:** Create `app/src/worker/photos.ts`, `app/src/client/{photo.ts,customer/Journey.tsx,Recipes.tsx,admin/Recipes.tsx}`.
- [ ] `resizeImage(file): Promise<Blob>` (longest side 1600, JPEG 0.8). Upload checks magic bytes (JPEG `FFD8FF`, PNG, WebP) and size under 5 MB; served with `Cache-Control: private`, `nosniff`, only to the owner customer or admin.
- [ ] Gallery with date and caption; recipe book (18 seeded, admin add, edit, delete, 2 photos each).
- [ ] `tests/api.mjs`: customer B fetching customer A's photo gets 404.
- [ ] Commit.

### Task 11: Mascots and game layer

**Files:** Create `app/src/client/mascot/{shapes.ts,render.ts,Mascot.tsx,mascot.css}`, `app/src/client/customer/{Picker.tsx,Wardrobe.tsx,Badges.tsx,Rings.tsx,Path.tsx}`.
- [ ] Port `girl, kitten, bunny, camel`, `neckWear`, `headWear`, `build` and the soft renderer from `docs/mockups/muzuna-mascots.html`; wear set from wardrobe.
- [ ] Poses: idle breathing and blink, `feed(fromEl, emoji)` arc then three chews and a heart, flex, hop with petals, sleepy (no ticks 2 days). Badge reveal. Rings and journey path animate.
- [ ] Picker on first sign-in after password change, change later in More.
- [ ] Commit.

### Task 12: Journey finish, gift, settings

**Files:** Create `app/src/client/admin/{Journey.tsx,Settings.tsx}`, `app/src/client/pages/Gift.tsx`.
- [ ] Goal weight, goal reached flag, finish journey with letter (earns crown), account stays active.
- [ ] Gift print `#/print/gift/:cid`: cover with name and crowned mascot, weight chart, start and final weight, kg and weeks, sizes before and after, gallery with captions by date, badges, letter last.
- [ ] Settings: WhatsApp number, accent colour, Muzuna kcal and protein per 25 g.
- [ ] Final check: `pnpm test`, `pnpm check`, `node tests/api.mjs`, Playwright walk at 390x844 for admin and customer, gitleaks. Commit.
