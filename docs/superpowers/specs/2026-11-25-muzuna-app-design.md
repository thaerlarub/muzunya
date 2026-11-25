# Muzuna app on Cloudflare: design

Date: 2026-11-25. Owner: Thaer. Status: draft for owner approval.
Context: read `CLAUDE.md` in this folder first (brand, owner preferences, the current Claude artifact app, its calculation and its gotchas). This document says what changes.

## 0. Scope changes (owner, 2026-11-25, these override the sections below)

The owner wants this built fast and "not giga secure and perfect". Kept: the free page builder (7.3), all mascots and gamification (9), everything else in 5 to 12 unless listed here.
- **No PWA** (15 dropped): no manifest, no service worker, no install guide. Ticks are still saved on the phone first (IndexedDB) and synced (14).
- **PDF through the browser's own print** (`window.print()` with a print stylesheet, A4 portrait). No html2canvas, no jsPDF. Applies to the plan PDF and the gift PDF.
- **Password hashing on the server**: PBKDF2-SHA256 with a per-user salt at an iteration count that fits the 10 ms CPU limit (about 20 000). The phone-side hashing flow in 5 is dropped. Temporary password, forced change, admin reset stay. Simple D1 lockout counter stays.
- **Dropped**: phase 5 of the earlier task list (backups, security docs, independent security review, final smoke test), audit log (11, 16), billing notification notes stay the owner's business.
- Kept because it costs nothing: hashed passwords, `__Host-` HttpOnly cookie, CSRF header, every customer query filtered on the session user, parameterised SQL, exact dependency versions.

## 1. Intent

Muzuna sells a monthly package: a bag of "خلطة الأنوثة" (25 g a day, 30 days) plus a personal meal plan, an exercise plan and a weekly follow-up call. Today the owner runs this from a private Claude artifact that only he can use. He wants a real app where **each customer has her own account**: she sees her active plans, ticks off meals and exercises every day, logs her weight and sizes, keeps a journey photo gallery, and enjoys a small game around it (a mascot she feeds and dresses). He keeps one admin view of everyone. The game layer is there to keep her ticking and coming back; the follow-up data is there so his weekly call is quick and useful; the end-of-journey gift is a sentimental keepsake that makes the brand memorable.

Scale: about 100 customers, each opening the app most days. Must run on Cloudflare's **free** tier.

## 2. Goals, non-goals, anti-goals

Goals
- One admin (the owner) and many customers, Arabic RTL everywhere, phone-first, installable as a PWA.
- Meal plan and exercise plan per customer, versioned, built from templates and fully editable, combined into one portrait PDF.
- Daily checklists from the active plans, follow-up tracking, a journey gallery, a gift PDF at the end.
- Gamification: mascot (picked by her, grows with her progress, wears earned badges, eats ticked meals), progress rings, badges, streak, journey path.
- Works offline for ticking; nothing she ticks is lost.
- Stays inside the Cloudflare free tier with wide headroom.

Non-goals (first version)
- Weight-loss track (comes later; the data model carries a `track` field now, see 12).
- Payments, in-app chat (WhatsApp covers it), more than one admin, English customer UI, push reminders, consent screen (owner decision 2026-11-25, see 13).
- Data migration from the current artifact app (fresh start).

Anti-goals (a failure even if it works)
- A customer seeing anything of another customer.
- Ticks or weigh-ins silently lost.
- Animations that feel childish, loud or shaming (no red, no "you failed"); soft and elegant only.
- A heavy dependency tree that the owner cannot keep patched (he can push monthly or weekly).
- Any customer-facing text mixing Arabic and English in one sentence, or containing em dashes.

## 3. Constraints

- **Cloudflare free tier.** Workers with static assets (not classic Pages; same free tier, where Cloudflare puts new features). D1 for data, R2 for photos (the owner adds a payment method so R2 can be enabled; owner decision 2026-11-25). The address is `muzuna.<account>.workers.dev` **for good** (owner decision 2026-11-25): no custom domain is planned, so the installed PWA never has to move. 10 ms CPU per request: nothing CPU-heavy on the server (password hashing and image resizing happen on the phone, PDFs are made on the phone).
- **Owner's security baseline** (`~/.claude/CLAUDE.md`): exact dependency versions, lockfile, 14-day release cooldown, install scripts off, a written allow-list for every direct dependency, no CDNs (self-host fonts, html2canvas, jsPDF), CSP `'self'` with nonce-based `script-src`, `__Host-` cookies, CSRF token on every state-changing request, rate-limited sign-in, parameterised SQL only, uploads checked by real content type and size, gitleaks before commits, independent security review before launch. Only the owner deploys (`wrangler deploy`) and pushes.
- **Owner's design rules** (`~/.claude/design/DESIGN-RULES.md`): motion 150 to 300 ms for UI, ease-out in, ease-in out; 44 px hit areas; `prefers-reduced-motion` always honoured.
- **Carry over from the current app** (`CLAUDE.md` section 9): no `color-mix()` in PDF pages; no `letter-spacing` or `text-align: justify` on Arabic; phone numbers in `<bdo dir="ltr">`; the 25 g Muzuna dose is never scaled; portion rounding rules per unit.
- Brand: مزيونة, Aref Ruqaa for the brand name, Tajawal for body (both self-hosted, OFL), accent `#c48bd9` with alternates `#d98ca3`, `#b98a6e`, `#7fa9a0`. Latin digits.

## 4. Approaches considered

- **A. Plain JavaScript, no framework**, extending the current `build.py`. Fewest dependencies, reuses the working pages directly. Rejected by the owner: the editors and dashboard are large enough that a framework pays off, and he can push updates monthly or weekly, so dependency upkeep is acceptable.
- **B. Preact + TypeScript + Vite front end, Hono on the Worker. Chosen (owner, 2026-11-25).** Faster to build the plan editors, dashboard and mascot, tidier state, React-like code like the owner's daycare project. Preact over React for size; Hono over a hand router because it is small, typed and has no dependencies of its own.
- **C. Server-rendered pages (htmx style).** Rejected: PDFs, mascot and offline ticking need client code anyway, so it would mean two styles to maintain, and ticks would wait on the network.

PDFs stay client-side (html2canvas 1.4.1 + jsPDF, self-hosted), as today. jsPDF 2.5.1 has published HIGH advisories, which the baseline blocks, so it is upgraded to the newest fixed release that is at least 14 days old, and the Arabic shaping and colours are re-tested against the current output (`tests/phone_test.py` gives the reference PDF). Cloudflare Browser Rendering was rejected: small free allowance, and the gift PDF with many photos would use it up.

## 5. Roles and sign-in

- **Admin**: one account, the owner. Created once from the command line (a local script computes the password hash and inserts the row). Password only (owner decision; 2FA was offered and declined). Session lasts 12 hours.
- **Customer**: signs in with her **phone number** (normalised to `+968...` form; accept spaces, dashes, leading `00` or a missing country code for Oman numbers) and password. The admin creates her account; the app generates a **temporary password** shown once to the admin, who sends it to her (WhatsApp). On first sign-in she must set her own password before anything else. **Admin reset**: new temporary password, `must_change` set again, all her sessions signed out. A "sign her out everywhere" button exists on its own too.
- Customer sessions **last until she signs out** (owner decision). Cookie `Max-Age` at the browser maximum (400 days) and refreshed on use.
- Archived customers cannot sign in.

**Password hashing on the phone** (keeps strong hashing inside the 10 ms CPU limit; measured 2026-11-25: PBKDF2-SHA256 at 100k iterations costs 10.8 ms on the owner's PC).
1. Client asks `POST /api/auth/salt {phone}`. Server returns that account's salt; for unknown phones it returns a stable fake salt `HMAC(secret, phone)` so the response does not reveal whether a number has an account.
2. Client computes `k = PBKDF2-SHA256(password, salt, 600 000 iterations, 32 bytes)` with Web Crypto (expect 0.3 to 1.5 s on a cheap phone; show a spinner).
3. Client sends `k`. Server stores and compares `HMAC-SHA256(pepper, k)`; pepper is a Worker secret. One HMAC is microseconds.
4. New passwords (temporary or her own) are hashed in the browser that chose them: the admin's browser generates the temporary password, a fresh salt and `k`, and sends salt and `k` only. The server never sees a plain password.

Brute force: 5 failed attempts per phone or per IP in 15 minutes locks that phone or IP for 15 minutes (counted in D1), plus the Workers rate-limiting binding on `/api/auth/*`. (Cloudflare's free WAF rate-limiting rule needs an own domain, which this app will not have.)

Sessions: 32 random bytes in cookie `__Host-mz` (HttpOnly, Secure, SameSite=Lax, Path=/); D1 stores only its SHA-256. Each session has a CSRF token, returned by `GET /api/me`, required as header `X-CSRF-Token` on every non-GET request.

## 6. Customer profile and package

Fields: name, phone, height, starting weight, start date, track (`gain` now), optional goal weight, activity, surplus, manual kcal, mascot choice, mascot wardrobe, status (`active` | `archived`), journey finished date and closing letter, allergies and dislikes (shown to the admin while editing her meal plan).

**Package (orders).** The admin records each order: date and number of months (1, 2, 3...). Each month is 30 days. A new order starts at the later of the order date and the current package end, so renewals stack. **Package end** = end of the last order. Alert fires **5 days** before package end (and stays while overdue). The customer sees a "renew on WhatsApp" button in the same window. Access is **not** limited by the package: a lapsed customer keeps full access (owner decision).

## 7. Plans

Two independent plan types per customer: **meal** and **exercise**. Each is a list of **versions**. Saving creates a new version with a **start date** the admin picks (default today). The active version for a date is the latest version whose start date is on or before that date. Old versions stay readable by both admin and customer, with the ticks made under them.

Day of the plan: `day = (date - version.start_date) mod cycle_length + 1`, dates in Asia/Muscat.

**Templates.** Any plan can be saved as a named template, per type and per track. New plans start from a template. Built-in starting templates: the current Muzuna meal template (`src/meal-data.js`) and the current workout generator (`standalone/Muzuna_Workout_Plan.html`: place home or gym, level, 3 or 4 days).

### 7.1 Meal plan

- Header values as today: calories, protein, BMI and healthy range, computed with the existing formula (`CLAUDE.md` section 6). **Muzuna nutrition label** (owner decision 2026-11-25: editable by the admin in settings): calories and protein per 25 g dose. When set, the dose is shown on the customer card and the Muzuna page, and its calories are subtracted from the target before portions are scaled (`f = clamp((target - muzuna_kcal) / 2200, 0.75, 1.5)`, base plan unchanged), so the day's total still lands on the target. When empty, nothing changes from today.
- **Slots**, which the admin can add, remove, rename and reorder. Each slot has a kind:
  - `fixed`: same text every day (Muzuna 25 g, a supplement).
  - `choose`: a list of options, she eats one (breakfast, snack). The checklist shows the slot name; she just ticks.
  - `rotation`: one item per plan day over the plan's cycle length (lunch, dinner). Cycle length is set per plan (default 7).
  - `counter`: a target count (water, 8 glasses). She taps glasses.
- Every text is editable. Portions stay as tokens `{base|unit}` so the plan scales to her calories exactly like today; an edited number becomes `{base|unit|manual}` and survives recalculation until "recalculate portions". The token renderer and rounding rules are reused from `src/app.html`.
- The **pages** of the plan are built in the page builder (7.3). The slots are the plan's data; the pages decide how that data and any other content is printed.

### 7.2 Exercise plan

- A cycle of days (default 7). Each day is `rest` (with an optional note such as "light walk 20 minutes") or `workout` (title plus a list of exercises).
- Each exercise row: exercise from the library or a custom name, sets, reps text, rest text, optional note.
- **Exercise library** (admin-editable): Arabic name, English name (shown on its own line), type (reps, per side, seconds), places (home, gym), video link (the owner's own YouTube links). Seeded from the 26 exercises in the workout standalone file.
- The generator fills a plan from place, level and days a week using the existing PLAN, SCHED and LV data; then everything is editable.
- The cover and intro pages of the workout booklet (goal, cardio, progression, honest note on genetics, warm-up and cool-down) are pages in the page builder like the meal plan's.
- Workout days are tied to the plan day (owner decision: count from plan start). If she trains on a different day, she ticks that workout under its planned day (past-day ticking allows it). The booklet line "نقدر نغير أيام الراحة حسب ظروفنا" is reworded to say this.

### 7.3 Page builder and PDF

**Free page builder (owner decision 2026-11-25).** Each plan (and each template) holds an ordered list of A4 portrait pages. The admin can add, remove, duplicate and reorder pages, and on each page add, edit, reorder and remove **blocks**:
- heading bar (the mauve `.bar` with optional small line), sub-heading, rich text (bold, accent colour, bullet and check lists),
- table (any rows and columns, header row, optional fixed checkbox column),
- image (product photo or an uploaded image), spacer, divider, two-column group,
- **data blocks** bound to the plan: slot cards (a `choose` slot as icon cards, like today's breakfast page), rotation table (any `rotation` slots by plan day, like today's lunch and dinner table, any cycle length, splits across pages when long), Muzuna dose box, customer card (name, height, weight, BMI, kcal, protein, goal), measurement tracker, nutritionist sign-off,
- a page can be a cover (full accent background, blobs, photo, customer card).

Every block keeps the plan's portion tokens, so scaling still works inside free text. The **built-in templates recreate today's 8 meal pages and the workout booklet (redrawn portrait)** out of these blocks, so a new plan looks like today's by default. The builder must keep the A4 frame, page number tab and footer on every page and stop content overflowing a page (warn and offer to move the block to a new page) so the PDF never clips. Stated risk: this is the largest part of the front end, several times the work of fixed page types, and free layouts are easier to make ugly; the templates are the guard rail.

One **portrait A4** PDF with the active meal plan pages followed by the active exercise plan pages. Made on the phone with html2canvas + jsPDF, as today. Saved with a normal download on Android and desktop; on iPhone in the installed app, through the share sheet (`navigator.share` with a file), falling back to opening the PDF. Both admin and customer can make it.

## 8. Customer dashboard (Arabic, RTL)

Tabs: **Today**, **Follow-up**, **Journey**, **More** (plans and PDF, recipes, notes from the admin, wardrobe, sign out). Exact navigation is left to the builder.

**Today**
- Her mascot, the two progress rings (meals today, workout today), streak, this week's stats (meal %, workouts done of scheduled).
- Meal checklist: one tick per slot, showing the slot name and, for rotation slots, today's dish. Water as 8 glasses.
- Exercise checklist: one tick per exercise of today's workout, each with sets and reps, a video link, and an optional "kg used" field. Rest days show a rest card.
- A date switcher: she can tick **any past day of her currently active version** (from that version's start date to today); never future days. Older versions are view-only.
- Package-ending banner with the WhatsApp renew button when due.

**Follow-up**
- New entry: date, weight, sizes (arm, chest, waist, hips, thigh, in cm), appetite 1 to 5, "how was your week" text. Every field except date is optional.
- Entries by the customer can be edited or deleted by her; entries by the admin are locked for her.
- Charts: weight over time, sizes first vs latest.

**Journey**
- Goal progress (if a goal is set) and the journey path (start weight to goal, a stop per kg; without a goal, the path shows kg gained in steps of 1 kg up to 6).
- **Gallery**: any photo that means something to her (her scale, a meal, an outfit), each with date and caption. She and the admin can add; she can delete her own; the admin can remove any.
- Badges shelf.

**More**: active plans (and history), PDF download, recipe book, dated notes from the admin, mascot wardrobe, WhatsApp button, sign out.

**Stats definitions** (builder may refine)
- Meal % for a day = ticked slots (water counts as glasses / 8) / total slots. Week = Saturday to Friday.
- A workout day is done when all its exercises are ticked.
- **Streak**: consecutive days with at least one tick. A broken streak shows "start a new streak today"; best streak is kept. No red, no penalty text.
- **Late ticks**: ticks she fills in later for past days count for meal %, workout stats and history. **Streak and badges count a tick only if it was made on that day or the next day** (Asia/Muscat), so a broken streak or a missed perfect week cannot be repaired a week later. Each stored tick keeps the time it was made, which makes this possible.

## 9. Gamification

Tone: soft and elegant. All motion off under `prefers-reduced-motion` (the state still updates). Reference mock-up: https://claude.ai/artifact/1e3ouyNZpZYLg3xvD1LCxo (four mascots, three styles, feeding demo).

- **Mascot**: she picks one of four on first sign-in (can change later in More): Muzuna girl (مزيونة), kitten (قطوة), bunny (أرنوبة), baby camel (حوار). **Art style: B, soft vector** (owner decision 2026-11-25): smooth rounded SVG shapes, tonal outlines, a light sheen, smooth growth. Built as a small engine: one shape model per character, poses, a renderer for the chosen style (same structure as the mock-up and as the daycare project's mascot engine; the daycare character itself is not reused).
- **Growth**: rounder with progress. With a goal: share of the way from starting weight to goal. Without: one step per kg gained, up to 6 steps. Follows her latest weight (it can shrink back).
- **Poses and reactions**: idle (breathing, blinking), **eat** on every meal tick (the food flies on an arc to the mascot, mouth opens, three chews, puffed cheeks, a heart), **flex** on an exercise tick, **hop with petals** when all of today's meals or a whole workout is done, sleepy when nothing was ticked for 2 days.
- **Badges** and the item each unlocks:
  | Badge | Rule | Item |
  |---|---|---|
  | First week | 7 days since her start date, with ticks on at least 5 of them | Bow |
  | First kg | latest weight at least 1 kg toward goal direction from start | Pearl necklace |
  | 7-day streak | streak reaches 7 | Scarf |
  | Perfect week | 7 consecutive days with 100% meals and every scheduled workout done | Sunglasses |
  | Halfway | goal set and progress at least 50% | Flower |
  | Journey finished | admin pressed "finish journey" | Crown |
  Badges, once earned, are kept. Earning one plays a short reveal.
- **Wardrobe**: every earned item is worn by default; she can switch items on or off. The crown arrives with the journey finish.
- Progress rings, tick pop and the journey path animate softly.

## 10. Journey finish and gift

The admin can set a goal weight; the "goal reached" flag appears when her latest weight reaches it. The journey ends **only** when the admin presses "finish journey" (with or without a goal). He writes a closing letter. Her account stays fully active afterwards.

**Gift PDF** (made on the phone, downloadable by her and the admin): cover with her name and mascot wearing the crown; weight chart, start and final weight, total kg and weeks; sizes before and after; her gallery photos with captions in date order; badges earned; the admin's letter on the last page.

## 11. Admin side (Arabic, works on phone and computer)

- **Customer list** with search and flags: due for a call (last weigh-in, or start date, 7+ days ago), not ticking (no ticks for 2+ days), goal reached (not yet finished), plan ending soon (active meal or exercise version 4+ weeks old), package ending (5 days or less, or overdue). Each row shows this week's meal % and workout count and her badges.
- **Customer page**: profile and package orders, plans (edit, new version with start date, history, save as template), day-by-day tick grid (meals and workouts, with kg logged), follow-up entries (add, edit), gallery (add, remove), notes (a dated log she sees, and private notes she does not), goal and finish journey with the letter, reset password, sign out everywhere, archive, delete on request (removes all her rows and photos).
- **Templates**, **exercise library**, **recipe book** (all 18 recipes from `standalone/Muzuna_Recipes.html` ported; add, edit, delete, two photos per recipe), **settings** (owner WhatsApp number, accent colour, Muzuna calories and protein per 25 g).
- **Audit log**: who did what and when for resets, deletes, archives, plan versions and finish journey.
- Plan editors must be usable on a phone and comfortable on a computer.

## 12. Weight-loss track (later)

Not built now, but nothing should assume gain: customers and templates carry `track`; goal direction, "toward goal" wording, BMI warning (gain track warns at BMI 25 or more, as today), badge rules and mascot growth read the track. For loss, the mascot gets fitter instead of rounder (to be designed then).

## 13. Privacy

Owner position (2026-11-25): the business is not based in Oman and does not serve Oman only; customer identity is limited to a name and a phone number (the phone only eases sign-in). **No consent screen in the first version.**
Noted for the record: the app also stores weight, body sizes, appetite, notes and personal photos per customer. Several data protection laws (for example in Saudi Arabia, the UAE, Oman and the EU) apply by where the customer lives, not where the business is based, and treat health data as sensitive. Not legal advice; the consent screen can be added in one release if the owner decides to.
- Photos are resized on the phone (longest side 1600 px, JPEG about 0.8) which also removes EXIF data, including location.
- Photos are private: served only through the Worker after a session check, `Cache-Control: private`, `X-Content-Type-Options: nosniff`.
- Archive keeps data until deletion is requested; delete removes everything including R2 objects.

## 14. Offline and sync (owner decision: save on the phone first)

- Ticks, glasses, kg used and her follow-up entries are saved on the phone first (IndexedDB) and the UI updates at once.
- Changes are sent as **operations** with their own timestamp (for example: "2026-11-25, lunch, ticked, 13:05"). The queue is flushed 3 seconds after the last change, when the app is hidden or closed (`fetch` with `keepalive`), and when it comes back online or is opened. A small "will sync" dot shows unsent changes.
- Server merge: latest timestamp wins per item, so two devices merge cleanly.
- Ticks are stored as **one row per customer per day** (JSON of that day's ticks), so a batch is one write.
- Photos upload directly (too big to queue); if offline, the upload button says so.
- Admin screens are online only (notes are written by the admin only, so the customer side never writes notes).
- The app loads the customer's data with one request on open and keeps a cached copy for offline use.

## 15. PWA

Manifest (name مزيونة, mauve theme colour, icons from the logo or her mascot), a hand-written service worker (about 60 lines, no plugin) that caches the app files per release version and serves them offline, and an update prompt ("new version, tap to refresh"). A one-time Arabic guide for iPhone (Share, then Add to Home Screen); Android uses the install prompt. Inside the installed app she signs in once more (separate storage from Safari).

## 16. Data model (D1, SQLite)

Tables (columns abbreviated; every table has created/updated timestamps where useful):

- `users` (id, role `admin`|`customer`, phone unique, salt, pw_hmac, must_change, status, created_at)
- `sessions` (id_hash, user_id, csrf_hash, expires_at, last_seen)
- `login_attempts` (key, count, window_start) for phone and IP limits
- `customers` (user_id, name, height, w0, start_date, track, goal_w, act, sur, man_kcal, mascot, wardrobe JSON, allergies, journey_finished_at, letter)
- `orders` (id, customer_id, order_date, months)
- `plan_versions` (id, customer_id, type `meal`|`exercise`, start_date, cycle_len, body JSON, created_at)
- `templates` (id, type, track, name, body JSON)
- `exercises` (id, name_ar, name_en, kind, places, video_url)
- `day_logs` (customer_id, date, meal_version_id, ex_version_id, body JSON with per-item value and timestamp; primary key customer_id + date)
- `followups` (id, customer_id, date, weight, arm, chest, waist, hips, thigh, appetite, note, author)
- `photos` (id, customer_id or null for recipe photos, r2_key, date, caption, author)
- `notes` (id, customer_id, date, text, private)
- `badges` (customer_id, badge, earned_at)
- `recipes` (id, section, title, tag, body JSON, photo ids)
- `settings` (key, value)
- `audit` (id, at, actor, action, target, detail)

Every customer-facing query filters on the session's user id, never on an id from the request.

## 17. API sketch (Hono on the Worker)

`/api/auth/*` (salt, sign-in, sign-out, set password), `/api/me` (profile, CSRF token, active plans, recent logs, badges: one call on open), `/api/sync` (batched operations), `/api/followups`, `/api/photos` (upload, list, get, delete), `/api/recipes`, `/api/admin/*` (customers, orders, plans, templates, exercises, notes, reset, archive, delete, audit, settings). The builder shapes the exact routes.

## 18. Free-tier budget (100 customers)

| Resource | Free limit | Expected |
|---|---|---|
| Worker requests | 100 000 / day | 2 000 to 5 000 |
| D1 rows written | 100 000 / day | about 500 with batching |
| D1 rows read | 5 000 000 / day | about 50 000 |
| D1 storage | 500 MB | a few MB a year |
| R2 storage | 10 GB | about 1 GB |
| CPU per request | 10 ms | 1 to 2 ms |

## 19. Operations

- **Backups**: weekly, scheduled on the owner's PC (WSL cron): `wrangler d1 export` plus a copy of all R2 objects, encrypted, last 8 kept. Restore steps written down and tried once.
- **Billing safety**: with a card on file for R2, set Cloudflare billing notifications so the owner hears before any usage would be charged.
- **Launch: all at once** (owner decision 2026-11-25), not staged. The build plan still orders the work so the mascot comes after the core; the mascot art style is B, soft vector.
- **Deploy**: the owner runs `wrangler deploy` (pinned wrangler). Secrets (pepper, salt secret) set with `wrangler secret put`, generated, never typed by hand, never in git.
- **Security docs** per the design rules: security policy, threat model, access control, data protection, incident response (short).
- Before launch: dependency scan (SBOM + OSV), gitleaks, independent security review of auth, sessions, CSRF, uploads, CSP and SQL.

## 20. Open items

1. Heating Muzuna unverified (recipe book's pancake and warm latte), carried over from `CLAUDE.md`.

## 21. Left to the builder

Exact routes and component structure; navigation layout; chart drawing; the poses' exact keyframes within the stated tone; how the plan editors look, as long as they work on phone and computer; test tooling (keep the Playwright phone smoke test, add unit tests for day calculation, sync merge, badge rules and portion scaling); the dependency allow-list contents, within the baseline rules.
