# Muzuna (مزيونة): handoff context

Everything Claude Code needs to continue this project without the original chat.

## 1. Who and what

- **Owner:** Thaer Abu Al-Rub, based in Muscat, Oman.
- **Muzuna (مزيونة)** is his page/brand. Product: **"خلطة الأنوثة"**, a powdered weight gain mix for women. Fixed dose: **25 g once a day**, taken with Greek yogurt, milk, water, or as a milkshake (milk + banana + nuts).
- **Customers:** women in Oman/GCC who want to **gain weight** and get a more feminine shape. Muzuna sends each customer a personalised diet plan as a PDF, then calls her **every week** to check her weight.
- **Language of all customer-facing content:** Arabic (RTL). The owner talks to Claude in casual English.

## 2. Owner's working preferences (follow these)

- **No em dashes** anywhere in written output (code comments, docs, Arabic text included). Use colons, commas or new sentences.
- **Clean language separation:** never mix Arabic and English inside one sentence. A separate line or element in the other language is fine (exercise names have an English subtitle on its own line).
- **Honest pushback** over agreement. If a request is wrong, risky or the wrong tool for the job, say so directly and recommend the better approach. No diplomatic hedging.
- Casual, direct communication.
- When he asks about any food or supplement **product**, look up its real ingredient list or nutrition panel before giving an opinion.

## 3. History (what was asked, what was built, in order)

1. **Diet plan template.** He uploaded his own rough Muzuna plan (.docx, plain tables) and a competitor's weight-loss plan PDF (Dr. Lamis Alkhawaja, purple style, icon cards). He wanted his plan styled like the competitor's, for **weight gain**, with only the amounts changing per customer.
   - Pushback given: Word cannot hold that design reliably, so it was built as **HTML that prints to PDF**.
   - Pushback given: his example customer (female, 175 cm, 105 kg, BMI ~34) is the wrong profile for a weight-gain plan. The app now warns when BMI >= 25.
   - The competitor's PDF carries a copyright notice. **Do not copy her text, layout or links.** Only the general structure and feel was used, rebranded as Muzuna.
   - Result: `standalone/Muzuna_Weight_Gain_Plan.html` (superseded by the app below, kept for reference).
2. **Workout plan.** He uploaded the same competitor's exercise program (fat-loss: cardio first, 4 to 5 days). Rebuilt for **weight gain + feminine shape**: resistance-focused, glutes/hips/thighs emphasis plus shoulders/back, minimal cardio, home or gym exercise sets, beginner/intermediate/advanced, 3 or 4 days a week, progress log. Her YouTube links were not reused; there is a panel to paste own video links per exercise. Includes an honest line that spot fat gain is impossible and genetics matter.
   - Result: `standalone/Muzuna_Workout_Plan.html` (landscape A4).
3. **Recipe book.** He uploaded the competitor's recipe book (photo-heavy). Built a Muzuna version: cover, 8 weight-gain tip cards, calorie add-ons table, then 18 recipes in 4 sections (6 Muzuna recipes using the 25 g dose, 3 breakfasts, 5 main meals, 3 snacks). Each recipe has two photo slots (click to upload, saved in IndexedDB; empty slots print as coloured panels with an icon).
   - Result: `standalone/Muzuna_Recipes.html`.
4. **Current app (the main deliverable).** He asked for: no age field, open on phone and save PDF on phone, and a saved customer list with weekly weights to track by phone call. Built as a **Claude artifact** (hosted page) because a local .html file cannot run reliably on a phone and cannot sync between devices.
   - Result: `dist/muzuna_app.html`, built from `src/`.

## 4. The live app

- **URL:** https://claude.ai/artifact/DjohMAHESnb9DmS26vdy9Y
- **Artifact slug:** `6727adf2-1a36-4b6a-8d5f-8b71abab409f`
- **Last version at handoff:** `1795589347-150b`, runtime contract `0.2.99`, private to the owner (`read: owner`).
- **Declared capabilities:** `{"db": {}, "user": {}, "downloads": true}`
- No gallery thumbnail is set (database pages get no automatic screenshot). The owner can set one from the Share menu.

### Republishing

Claude Code most likely does **not** have the claude.ai artifact tools. Two options:
- Build with `python3 build.py`, then ask Claude in claude.ai (which has the artifact tools) to republish `dist/muzuna_app.html` to slug `6727adf2-1a36-4b6a-8d5f-8b71abab409f` via `publish_files` (needs the current `base_version`; get it with `get_artifact`).
- If the artifact tools are available in your session, use them directly. Rule from the platform: when the page **gains** a capability, declare first then publish; when it **loses** one, publish first then declare. `declare_capabilities` takes the whole declaration every time.

## 5. App behaviour

Two tabs in a sticky header: **الزبونات** (customers) and **الخطة الغذائية** (plan).

### Customers tab
- Summary cards: customer count, number due for a call, average gain in kg.
- "+ زبونة جديدة" opens a bottom sheet: name, phone, height, starting weight, start date.
- Customer card: name, phone, weeks logged, last weight, change since start (green up, red down), sparkline, orange "موعد الاتصال" badge when the latest weigh-in (or start date) is **7+ days** old. Due customers sort to the top.
- Customer sheet: edit details, log a weekly weight (weight + date), SVG line chart, week table with per-row delete, "فتح خطتها" (opens the plan tab with her latest weight), delete (two taps to confirm).
- Bottom: follow-up table, one row per customer, columns: name, starting weight, week 1..N (min 4), total change.
- "تصدير الجدول": CSV export with UTF-8 BOM (opens correctly in Excel) via the `downloads` capability.
- Search by name or phone.

### Plan tab
- Inputs: customer picker, name, height, current weight, activity level, daily surplus (300/400/500), optional manual kcal override, nutritionist name, plan date, footer text. **No age** (see calculation).
- Colour swatches (mauve default `#c48bd9`, pink, brown, green).
- 8 A4 pages, scaled to fit the screen: cover (product photo, customer card), 6 breakfast cards, 7-day lunch/dinner table, Muzuna 25 g page (4 preparation methods + weekly checklist), snacks + exchange table + calorie add-ons, drinks + weight-gain rules, shopping list, measurement tracker + nutritionist sign-off.
- Every portion number is a contenteditable `.q` span. Manual edits turn yellow (`.q.m`) and survive recalculation until "إعادة حساب الكميات".
- "حفظ PDF": html2canvas renders each page at scale 2, jsPDF assembles an A4 PDF, `downloads.save()` hands it to the phone (iOS Claude app opens the share sheet; browser downloads it).

## 6. Calculation (portions)

- BMR: Mifflin-St Jeor, female: `10*w + 6.25*h - 5*AGE - 161`, with **`AGE = 25` hard-coded** (owner refused an age field; about 50 kcal difference per 10 years, stated in the UI).
- TDEE = BMR x activity (1.2 / 1.375 / 1.55 / 1.725).
- Target kcal = TDEE + surplus, rounded to 50, or the manual override.
- Scale factor `f = clamp(target / 2200, 0.75, 1.5)`. **The base plan is written for 2200 kcal.** Warning shown when the target falls outside the clamp.
- Protein shown as `1.5 g/kg`, rounded to 5. Healthy weight range shown from BMI 18.5 to 24.9.
- Token syntax in `src/meal-data.js`: `{value|unit}`. Rounding per unit:
  - `g`: to 10 (5 below 50 g)
  - `ml`: to 25, min 50
  - `sp` (spoons) and `pc` (pieces): whole numbers, min 1
  - `hf`: halves allowed, shown as `½`, `1½`
- Muzuna's own 25 g is **never scaled**.

## 7. Data model (Claude artifact `db`)

- Path: each customer is one document at `data/users/<uid>/<customerId>`, where `<uid>` = `await (await claude.use("user")).id()`. This subtree is **private per viewer**, even from the artifact owner, so if the link is ever shared each person only sees their own list.
- Document shape:
  ```json
  {
    "id": "c<base36time><rand>",
    "name": "سارة أحمد",
    "phone": "+968 9123 4567",
    "h": 158,
    "w0": 49,
    "start": "2026-11-01",
    "act": "1.375",
    "sur": "400",
    "man": "",
    "weights": [{"k": "c...", "d": "2026-11-08", "w": 49.4}]
  }
  ```
- One `onSnapshot` on the collection; writes are queued per document (one write at a time per doc, as the platform requires). Loading has a 10 s "can't reach data" note.
- **Fallback:** if `db` or the user id is unavailable (signed out, local file), data lives in `localStorage` key `mz_customers` and a note says "saved on this device only".
- Other localStorage keys: `mz_col` (theme colour), `mz_plan_<field>` (last plan inputs, except name/height/weight/manual kcal).

## 8. Files

```
CLAUDE.md                     this file
build.py                      src/ -> dist/muzuna_app.html  (--test -> tests/app_test.html)
src/app.html                  app source with placeholders __LIBS__, __DATA__, __PHOTO__
src/meal-data.js              breakfast, week, snacks, ways, mzWeek, exch, shop arrays (Arabic, tokenised)
assets/product-photo.jpg      Muzuna product photo (from the owner's docx), embedded as base64 on build
dist/muzuna_app.html          built, self-contained page; this is what is published
tests/phone_test.py           Playwright smoke test at 390x844
standalone/                   earlier single-file deliverables (open in desktop Chrome, print to PDF)
  Muzuna_Weight_Gain_Plan.html  diet plan, superseded by the app
  Muzuna_Workout_Plan.html      workout program, landscape
  Muzuna_Recipes.html           recipe book with photo slots
```

Test setup: `npm i html2canvas@1.4.1 jspdf@2.5.1 && pip install playwright && playwright install chromium`, then `python3 build.py --test && python3 tests/phone_test.py`. A good run prints a ~1.7 MB PDF size and no page errors.

## 9. Gotchas already hit (do not reintroduce)

- **No `color-mix()` in the plan pages.** html2canvas 1.4.1 cannot parse it and drops the colours. Shades (`--a2`, `--a3`, `--ad`, `--c1`, `--c2`) are computed to hex in JS by `setCol()` / `mix()`.
- **`data-v` is reserved** for plan value bindings (`document.querySelectorAll("[data-v]")` overwrites their text). The tabs use `data-view`. Using `data-v` on any other element blanks it.
- Phone numbers render with `<bdo dir="ltr">` inside RTL text.
- `window.print()`, `alert/confirm/prompt` and normal downloads are **blocked** inside the artifact frame. PDF and CSV must go through `claude.use("downloads").save()`. When `downloads` resolves `null`, the PDF and export buttons are hidden.
- `downloads.save()` error codes: `declined` (say nothing), `host_unavailable` (some Claude Android apps cannot save: tell her to open the link in Chrome).
- Libraries load only from allowed CDNs (cdnjs). Remote images do not load in artifacts; images must be data URIs.
- During PDF capture the stage transform is removed and `body.cap` hides edit underlines, yellow highlights and page shadows.
- html2canvas renders Arabic shaping correctly here (verified). Avoid `letter-spacing` and `text-align: justify` on Arabic text; both break html2canvas shaping.
- Emoji are used as food icons (the owner asked for icons like the reference). They render differently on Windows vs iOS.

## 10. Open items and known risks

- **Muzuna nutrition label unknown.** Its calories and protein are not counted in the daily total. Ask the owner for the label, then add it (e.g. a `MUZUNA_KCAL` constant subtracted from the target before scaling).
- **Heating Muzuna is unverified.** The recipe book's pancake and warm latte recipes heat the mix. If the ingredients are heat-sensitive, remove those recipes.
- Energy-ball recipe uses 100 g for 4 days; the "one portion per day" note must stay.
- The plan amounts are a template scaled by formula, not individual dietetic advice. The plan has a nutritionist sign-off field; keep it.
- Ideas the owner was offered but has not confirmed: merge the workout plan into the app (would need converting to portrait), generate recipe photos with an image tool (costs his credits, ask first), a gallery thumbnail.
- The standalone files still have a `window.print()` button: fine on desktop Chrome, not for phones.

## 11. Brand

- Name: مزيونة, tagline: خلطة الأنوثة. Brand font: Aref Ruqaa (logo/headings), body font: Tajawal (Google Fonts).
- Default accent `#c48bd9` (mauve). Alternatives offered: `#d98ca3`, `#b98a6e`, `#7fa9a0`.
- Units in content: م.ك = tablespoon, م.ص = teaspoon, غ = grams, مل = ml.

## 12. New app on Cloudflare (2026-11-25)

The artifact app above is being replaced by a multi-user app in `app/` (branch `build`): Preact + Hono Worker + D1 + R2, admin and customer accounts, plans with a free page builder, daily checklists synced from the phone, follow-up, gallery, mascots and badges, plan and gift PDFs by browser print. Start with `app/README.md` (deploy, local dev), the design `docs/superpowers/specs/2026-11-25-muzuna-app-design.md` (section 0 lists the owner's scope cuts) and `app/API.md`. The recipe book has 17 recipes, not 18.
