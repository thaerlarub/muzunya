# API contract (Worker, Hono). Types in `src/shared/types.ts`.

All JSON. Cookie `__Host-mz`. Every non-GET needs header `X-CSRF-Token` (from `/api/me`), except `POST /api/auth/login`.
Errors: `{ error: string }` with status 400 (bad input), 401 (no session), 403 (CSRF, wrong role, or `must_change` set), 404 (not found or not hers), 429 (locked out).
While `must_change` is set, only `/api/me`, `/api/auth/password` and `/api/auth/logout` work.

## Auth
- `POST /api/auth/login {phone, password}` -> `{ ok: true }` + cookie. 401 `{error:"bad"}`, 401 `{error:"archived"}`, 429.
- `POST /api/auth/logout` -> `{ ok: true }`
- `POST /api/auth/password {current, next}` -> `{ ok: true }` (next at least 6 chars; clears must_change; other sessions of this user signed out)
- `GET /api/me` -> `MeCustomer | MeAdmin` (401 when signed out). When `must_change`, only `{user, csrf}` is returned.
- `GET /api/health` -> `{ ok: true }`

## Customer (session role customer, all filtered on the session user)
- `POST /api/sync {ops: Op[]}` -> `{ ok: true, logs: DayLog[] (days touched), followups: Followup[] (hers), badges: Badge[] }`. Ticks failing `canTick` are skipped (not an error), max 500 ops.
- `PUT /api/me/mascot {mascot}` -> `{ ok: true }`
- `PUT /api/me/wardrobe {wardrobe}` -> `{ ok: true }`
- `GET /api/recipes` -> `Recipe[]` (also for admin)

## Photos (customer or admin)
- `POST /api/photos` multipart: `file` (JPEG, PNG or WebP by magic bytes, max 5 MB), `date`, `caption`, admin only: `customer_id` or `recipe_id` -> `Photo`
- `GET /api/photos/:id` -> image bytes. Customer: only her own photos and recipe photos. Admin: all. `Cache-Control: private, max-age=86400`, `X-Content-Type-Options: nosniff`.
- `DELETE /api/photos/:id` -> `{ ok: true }` (customer: only photos she authored)

## Admin (session role admin)
- `GET /api/admin/overview` -> `{ rows: AdminRow[] }` (active and archived; client filters)
- `POST /api/admin/customers {name, phone, height, w0, start_date, act?, sur?, goal_w?, allergies?, salt?}` -> `{ id, temp_password }`. Phone normalised with `normPhone`; 400 `{error:"phone"}` if invalid, 400 `{error:"exists"}` if taken.
- `GET /api/admin/customers/:id` -> `AdminCustomer`
- `PUT /api/admin/customers/:id {any Customer field except user_id, status, wardrobe; phone allowed}` -> `{ ok: true }`
- `POST /api/admin/customers/:id/reset` -> `{ temp_password }` (must_change = 1, all her sessions deleted)
- `POST /api/admin/customers/:id/signout` -> `{ ok: true }`
- `POST /api/admin/customers/:id/archive {archived: boolean}` -> `{ ok: true }` (archive also deletes her sessions)
- `DELETE /api/admin/customers/:id` -> `{ ok: true }` (all rows and her R2 objects)
- `POST /api/admin/customers/:id/orders {order_date, months}` -> `Order`; `DELETE /api/admin/orders/:id`
- `POST /api/admin/customers/:id/plans {type, start_date, cycle_len, body}` -> `PlanVersion` (new version)
- `DELETE /api/admin/plans/:id` -> `{ ok: true }` (only a version whose start_date is in the future)
- `PUT /api/admin/customers/:id/logs/:date {body: DayBody}` -> `{ ok: true }` (admin corrections, merged with mergeDay)
- `POST /api/admin/customers/:id/followups {FollowupInput}` -> `Followup` (author admin); `PUT /api/admin/followups/:id {FollowupInput}`; `DELETE /api/admin/followups/:id`
- `POST /api/admin/customers/:id/notes {date, text, private}` -> `Note`; `DELETE /api/admin/notes/:id`
- `POST /api/admin/customers/:id/finish {letter}` -> `{ ok: true }` (sets journey_finished_at today, awards `finish`); `POST /api/admin/customers/:id/unfinish`
- `GET /api/admin/templates` -> `Template[]`; `POST {type, track, name, cycle_len, body}` -> `Template`; `PUT /api/admin/templates/:id {name?, cycle_len?, body?}`; `DELETE /api/admin/templates/:id`
- `GET /api/admin/exercises` -> `Exercise[]`; `POST {name_ar, name_en, kind, places, video_url}` -> `Exercise`; `PUT /api/admin/exercises/:id`; `DELETE /api/admin/exercises/:id`
- `POST /api/admin/recipes {section, title, tag, body, sort}` -> `Recipe`; `PUT /api/admin/recipes/:id`; `DELETE /api/admin/recipes/:id`
- `GET /api/admin/settings` -> `Settings`; `PUT /api/admin/settings {Settings}` -> `{ ok: true }`

## First run
When `exercises`, `recipes` or `templates` is empty, the Worker seeds them from `src/shared/seed.ts` (`seedExercises()`, `seedRecipes()`, `seedTemplates()`) on the first admin request.
