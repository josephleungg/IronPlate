# API Reference (planned)

One versioned REST API serves the **web app and the future React Native app**. It runs as a Hono Worker on Cloudflare, and its OpenAPI 3.1 spec is generated from the same Zod schemas the clients import.

- **Base URL:** `https://ironplate.app/api`. A Workers route sends `/api/*` to the `api` Worker, so the web app calls it same-origin. Every path below is relative to this base (`/v1/me` → `https://ironplate.app/api/v1/me`).
- **Auth routes:** `/auth/*`, handled by Better Auth
- **Spec:** `GET /v1/openapi.json`

Contents: [Conventions](#conventions) · [Auth](#auth-better-auth) · [Account](#account--settings) · [Media](#media) · [Goals](#goals) · [Foods](#foods) · [Recipes](#recipes) · [Saved meals](#saved-meals) · [Diary](#diary) · [Fasting](#fasting) · [Meal plans](#meal-plans) · [Body](#body--progress) · [Reports](#reports--analytics) · [Exercises](#exercises) · [Routines](#routines) · [Workouts](#workouts) · [Live workouts](#live-workouts) · [Social](#social) · [Feed & posts](#feed-posts--comments) · [Notifications](#notifications) · [Gamification](#gamification) · [AI](#ai) · [Sync](#mobile-sync) · [Billing](#billing) · [Webhooks](#webhooks) · [Admin](#admin) · [System](#system) · [WebSockets](#websocket-protocols) · [Async contracts](#internal-async-contracts)

---

## Conventions

| Topic | Convention |
|---|---|
| Format | JSON in, JSON out. Every request body and query string is validated with Zod. |
| Auth | **Web:** Better Auth session cookie (`HttpOnly`, `Secure`, `SameSite=Lax`). **Mobile:** the Better Auth Expo client keeps the session in SecureStore and attaches it to each request. |
| Access levels | **Public** = no session · **User** = signed in · **Premium** = active subscription · **Admin** = `role` is admin/moderator *and* a valid Cloudflare Access JWT |
| IDs | UUIDv7 strings. Create endpoints take an optional client-generated `id`, so retrying a create is safe and offline clients can reference rows before syncing. |
| Idempotency | Mutations that don't create a row (log a saved meal, copy a day, finish a workout) take an `Idempotency-Key` header. Results are cached for 24 h. |
| Pagination | Cursor-based: `?cursor=<opaque>&limit=20` (max 100). Responses look like `{ "data": [...], "nextCursor": "..." \| null }`. |
| Dates | Diary-style dates are `YYYY-MM-DD` in the user's local calendar. Timestamps are ISO-8601 UTC strings. |
| Units | Always metric (kg, cm, m, ml, g, kcal). Clients convert using the user's settings. |
| Errors | RFC 9457 `application/problem+json`: `{ type, title, status, detail, code, errors? }`. Codes are stable strings like `FOOD_NOT_FOUND`. |
| Rate limits | Workers Rate Limiting binding per user and IP. A limited request gets `429` with `Retry-After`. |
| Concurrency | Mutable resources return `updatedAt`. PATCH accepts `If-Match: <updatedAt>`, and a stale version gets `409`. |
| Privacy filter | Every read applies visibility (`private / followers / public`), private-account rules, and blocks in both directions. |
| Versioning | `/v1` only gets additive changes. Breaking changes ship as `/v2`. `GET /v1/config` returns the minimum supported mobile app version. |

---

## Auth (Better Auth)

Better Auth provides these routes. The paths below are its defaults; confirm against the installed version.

| Method | Path | Description | Access |
|---|---|---|---|
| POST | `/auth/sign-up/email` | Register with email + password (Turnstile token required on web) | Public |
| POST | `/auth/sign-in/email` | Sign in with email + password | Public |
| POST | `/auth/sign-in/username` | Sign in with username + password | Public |
| POST | `/auth/sign-in/social` | Start OAuth (Google, Apple) | Public |
| GET | `/auth/callback/:provider` | OAuth callback | Public |
| POST | `/auth/sign-out` | End the session | User |
| GET | `/auth/get-session` | Current session + user | User |
| GET | `/auth/list-sessions` | Active sessions on all devices | User |
| POST | `/auth/revoke-session` | Sign out one device | User |
| POST | `/auth/send-verification-email` | Resend verification | User |
| GET | `/auth/verify-email` | Verify an email from the link | Public |
| POST | `/auth/request-password-reset` | Email a reset link | Public |
| POST | `/auth/reset-password` | Set a new password with a token | Public |
| POST | `/auth/change-password` | Change password | User |
| POST | `/auth/change-email` | Change email (verification required) | User |

## Account & settings

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/v1/me` | Current user, profile, settings, and entitlements | User |
| PATCH | `/v1/me` | Update profile (display name, bio, avatar media ID, private account) | User |
| GET | `/v1/me/settings` | Units, timezone, privacy defaults, notification preferences | User |
| PATCH | `/v1/me/settings` | Update settings | User |
| GET | `/v1/usernames/:username/available` | Check username availability | Public |
| PATCH | `/v1/me/username` | Change username | User |
| POST | `/v1/me/onboarding` | Submit onboarding answers. Computes TDEE and creates the first goals. | User |
| GET | `/v1/me/devices` | List registered push devices | User |
| POST | `/v1/me/devices` | Register or refresh a push token | User |
| DELETE | `/v1/me/devices/:id` | Unregister a device | User |
| POST | `/v1/me/exports` | Request a full data export (starts a Workflow) | User |
| GET | `/v1/me/exports/:id` | Export status + signed download URL | User |
| DELETE | `/v1/me` | Schedule account deletion (30-day grace period, starts a Workflow) | User |
| POST | `/v1/me/restore` | Cancel a pending deletion during the grace period | User |

## Media

Uploads go **straight to R2** with presigned URLs, so large files never pass through a Worker.

| Method | Path | Description | Access |
|---|---|---|---|
| POST | `/v1/media/uploads` | Create a `media_assets` row and return a presigned R2 PUT URL (or a Stream direct-upload URL for video). Body: `{ kind, mimeType, sizeBytes }` | User |
| POST | `/v1/media/:id/complete` | Mark the upload done. Queues processing (moderation, dimensions). | User |
| GET | `/v1/media/:id` | Metadata + delivery URL (signed URL for private media; Images transformation params allowed) | User |
| DELETE | `/v1/media/:id` | Delete media | User |

## Goals

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/v1/goals/nutrition?date=` | Nutrition goals in effect for a date (defaults to today) | User |
| PUT | `/v1/goals/nutrition` | Set new goals from an `effectiveFrom` date, optionally per day of week | User |
| GET | `/v1/goals/nutrition/history` | Every goal version | User |
| GET | `/v1/goals/weight` | Active weight goal + projection | User |
| PUT | `/v1/goals/weight` | Set the weight goal (lose/maintain/gain, target, weekly rate) | User |
| POST | `/v1/goals/calculate` | Stateless TDEE/macro calculator. Returns recommended goals and safety warnings (minimum calories). | Public |

## Foods

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/v1/foods/search?q=&cursor=` | Hybrid search (FTS5 keyword + Vectorize semantic). The user's own foods and frequently logged foods rank first. | User |
| GET | `/v1/foods/barcode/:gtin` | Look up by barcode (KV cache → D1 → Open Food Facts fallback) | User |
| GET | `/v1/foods/:id` | Food detail with servings and full nutrients | User |
| POST | `/v1/foods` | Create a custom food | User |
| PATCH | `/v1/foods/:id` | Edit a custom food (owner only) | User |
| DELETE | `/v1/foods/:id` | Delete a custom food (owner only) | User |
| GET | `/v1/foods/recent?mealSlotId=` | Recently logged foods, optionally for one meal | User |
| GET | `/v1/foods/frequent` | Most frequently logged foods | User |
| GET | `/v1/foods/mine` | Custom foods I created | User |
| POST | `/v1/foods/:id/submissions` | Suggest a correction to a public food | User |
| POST | `/v1/foods/submissions` | Submit a missing food, e.g. after a failed barcode scan | User |

## Recipes

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/v1/recipes` | My recipes | User |
| POST | `/v1/recipes` | Create a recipe. Computes per-serving nutrition and creates a loggable `foods` row. | User |
| GET | `/v1/recipes/:id` | Recipe with ingredients + nutrition (visibility checked) | User |
| PATCH | `/v1/recipes/:id` | Update a recipe (nutrition is recomputed) | User |
| DELETE | `/v1/recipes/:id` | Delete a recipe | User |
| POST | `/v1/recipes/import` | Import from a URL (Browser Rendering + schema.org Recipe parsing + AI ingredient matching). Returns a draft. | Premium |
| POST | `/v1/recipes/:id/copy` | Copy someone else's public recipe | User |

## Saved meals

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/v1/saved-meals` | My saved meals | User |
| POST | `/v1/saved-meals` | Create from items, or from a diary meal (`{ fromDate, mealSlotId }`) | User |
| GET | `/v1/saved-meals/:id` | Saved meal detail | User |
| PATCH | `/v1/saved-meals/:id` | Update a saved meal | User |
| DELETE | `/v1/saved-meals/:id` | Delete a saved meal | User |
| POST | `/v1/saved-meals/:id/log` | Log all items into `{ date, mealSlotId }` | User |

## Diary

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/v1/meal-slots` | My meal slots (Breakfast, Lunch, …) | User |
| PUT | `/v1/meal-slots` | Replace meal slot names and order (max 6 active) | User |
| GET | `/v1/diary/:date` | Full day: entries by meal, totals, goal, remaining, water, exercise calories, notes, completed flag | User |
| GET | `/v1/diary?from=&to=` | Daily totals for a range (calendar, reports) | User |
| POST | `/v1/diary/:date/entries` | Log one food: `{ id?, mealSlotId, foodId, servingId, servings, source }` | User |
| POST | `/v1/diary/:date/entries/batch` | Log several at once (AI results, multi-select) | User |
| POST | `/v1/diary/:date/quick-add` | Quick-add calories/macros without a food | User |
| PATCH | `/v1/diary/entries/:id` | Change serving, quantity, meal, or date | User |
| DELETE | `/v1/diary/entries/:id` | Remove an entry | User |
| POST | `/v1/diary/:date/copy` | Copy a meal or the whole day from `{ fromDate, fromMealSlotId? }` | User |
| PUT | `/v1/diary/:date/notes` | Set the day's notes | User |
| POST | `/v1/diary/:date/complete` | Mark the day complete. Returns the "if every day were like today" weight projection. | User |
| DELETE | `/v1/diary/:date/complete` | Undo complete | User |
| POST | `/v1/diary/:date/water` | Log water `{ amountMl }` | User |
| DELETE | `/v1/diary/water/:id` | Remove a water log | User |
| PUT | `/v1/activity/:date` | Upsert steps and active energy from HealthKit or Health Connect | User |
| GET | `/v1/users/:username/diary/:date` | View a friend's diary (if their diary visibility allows it) | User |

## Fasting

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/v1/fasting/current` | Active fast, if any | User |
| POST | `/v1/fasting` | Start a fast `{ protocol, targetMinutes, startedAt? }` | User |
| PATCH | `/v1/fasting/:id` | Edit start time, end time, or target | User |
| POST | `/v1/fasting/:id/end` | End a fast | User |
| GET | `/v1/fasting/history` | Past fasts + stats | User |
| DELETE | `/v1/fasting/:id` | Delete a fast | User |

## Meal plans

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/v1/meal-plans` | My meal plans | Premium |
| POST | `/v1/meal-plans` | Create a plan manually | Premium |
| POST | `/v1/meal-plans/generate` | AI-generate a plan from goals and preferences | Premium |
| GET | `/v1/meal-plans/:id` | Plan detail | Premium |
| PATCH | `/v1/meal-plans/:id` | Edit a plan | Premium |
| DELETE | `/v1/meal-plans/:id` | Delete a plan | Premium |
| POST | `/v1/meal-plans/:id/apply` | Copy a plan day into the diary | Premium |
| GET | `/v1/meal-plans/:id/shopping-list` | Aggregated grocery list | Premium |

## Body & progress

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/v1/measurements?type=&from=&to=` | Measurement series (weight, body fat, waist, …) | User |
| POST | `/v1/measurements` | Log one or more measurements | User |
| PATCH | `/v1/measurements/:id` | Edit a measurement | User |
| DELETE | `/v1/measurements/:id` | Delete a measurement | User |
| GET | `/v1/progress-photos` | My progress photos | User |
| POST | `/v1/progress-photos` | Add a progress photo (media ID, pose, date) | User |
| PATCH | `/v1/progress-photos/:id` | Change pose, date, or visibility | User |
| DELETE | `/v1/progress-photos/:id` | Delete a progress photo | User |
| GET | `/v1/progress-photos/compare?a=&b=` | Two photos side by side with the measurement change between them | User |

## Reports & analytics

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/v1/reports/nutrition?from=&to=&nutrient=` | Daily intake vs goal for any nutrient | User |
| GET | `/v1/reports/macros?from=&to=` | Macro split over time | User |
| GET | `/v1/reports/weight?from=&to=` | Weight trend (moving average) + goal projection | User |
| GET | `/v1/reports/training?from=&to=` | Volume, sets, reps, duration, frequency | User |
| GET | `/v1/reports/muscles?from=&to=` | Sets per muscle group (body heatmap data) | User |
| GET | `/v1/reports/weekly?week=` | Weekly digest: nutrition adherence + training summary | User |
| GET | `/v1/reports/calendar?month=` | Calendar of diary-complete days and workout days | User |

## Exercises

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/v1/exercises?q=&muscle=&equipment=&type=` | Search the global library + my custom exercises | User |
| GET | `/v1/exercises/:id` | Exercise detail (instructions, muscles, demo media) | User |
| POST | `/v1/exercises` | Create a custom exercise | User |
| PATCH | `/v1/exercises/:id` | Edit a custom exercise (owner only) | User |
| DELETE | `/v1/exercises/:id` | Delete a custom exercise (owner only) | User |
| GET | `/v1/exercises/:id/history` | My past sets of this exercise, grouped by workout | User |
| GET | `/v1/exercises/:id/records` | My current PRs for this exercise | User |
| GET | `/v1/exercises/:id/stats?metric=&from=&to=` | Chart series: est. 1RM, heaviest weight, best set volume, total volume, reps | User |
| GET | `/v1/muscle-groups` | Muscle groups list | Public |

## Routines

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/v1/routine-folders` | My folders | User |
| POST | `/v1/routine-folders` | Create a folder | User |
| PATCH | `/v1/routine-folders/:id` | Rename or reorder a folder | User |
| DELETE | `/v1/routine-folders/:id` | Delete a folder (its routines move to unfiled) | User |
| GET | `/v1/routines` | My routines | User |
| POST | `/v1/routines` | Create a routine with exercises + target sets | User |
| GET | `/v1/routines/:id` | Routine detail, including last-performed values | User |
| PUT | `/v1/routines/:id` | Replace a routine's contents | User |
| PATCH | `/v1/routines/:id` | Rename, move folder, change visibility | User |
| DELETE | `/v1/routines/:id` | Delete a routine | User |
| POST | `/v1/routines/:id/copy` | Copy a routine (mine or someone else's public one) | User |
| POST | `/v1/routines/:id/share` | Create or rotate the public share slug | User |
| GET | `/v1/shared/routines/:slug` | View a shared routine (no account needed, has OG image) | Public |
| POST | `/v1/routines/from-workout/:workoutId` | Save a finished workout as a routine | User |
| GET | `/v1/explore/routines?goal=&level=&equipment=` | Curated program library | User |

## Workouts

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/v1/workouts?cursor=` | My workout history | User |
| POST | `/v1/workouts` | Save a completed workout (full payload, client `id`). Queues PR detection, stats, and feed fan-out. | User |
| GET | `/v1/workouts/:id` | Workout detail with exercises, sets, PR badges, media (visibility checked) | User |
| PUT | `/v1/workouts/:id` | Edit a past workout (PRs are recomputed) | User |
| PATCH | `/v1/workouts/:id` | Edit title, description, visibility, or media | User |
| DELETE | `/v1/workouts/:id` | Delete a workout (PRs are recomputed, post removed) | User |
| POST | `/v1/workouts/:id/copy` | Start a new live workout from this one (mine or a friend's) | User |
| GET | `/v1/workouts/:id/share-card` | Generated share image (PNG) | User |
| GET | `/v1/workouts/calendar?month=` | Days with workouts | User |
| POST | `/v1/workouts/import` | Import CSV from Hevy, Strong, or similar apps | User |

## Live workouts

In-progress workouts live in a per-user `LiveWorkout` Durable Object, so phone, web, and watch stay in sync and nothing is lost if the app crashes.

| Method | Path | Description | Access |
|---|---|---|---|
| POST | `/v1/live-workout` | Start (empty, or from `routineId` / `workoutId`). Returns state + WebSocket URL. | User |
| GET | `/v1/live-workout` | Current live workout state, or `404` | User |
| PATCH | `/v1/live-workout` | Apply ops over HTTP (fallback when WebSocket isn't available) | User |
| GET | `/v1/live-workout/ws` | WebSocket upgrade (see [protocols](#websocket-protocols)) | User |
| POST | `/v1/live-workout/finish` | Persist to D1 as a workout. Same side effects as `POST /v1/workouts`. | User |
| DELETE | `/v1/live-workout` | Discard | User |

## Social

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/v1/users/:username` | Public profile: counts, follow state, highlights | User |
| GET | `/v1/users/:username/workouts?cursor=` | Their workouts (visibility checked) | User |
| GET | `/v1/users/:username/routines` | Their public routines | User |
| GET | `/v1/users/:username/stats` | Public training stats + calendar | User |
| GET | `/v1/users/:username/followers?cursor=` | Followers | User |
| GET | `/v1/users/:username/following?cursor=` | Following | User |
| POST | `/v1/users/:id/follow` | Follow (becomes a request if the account is private) | User |
| DELETE | `/v1/users/:id/follow` | Unfollow, or cancel a request | User |
| GET | `/v1/me/follow-requests` | Pending incoming requests | User |
| POST | `/v1/me/follow-requests/:userId/accept` | Accept a request | User |
| POST | `/v1/me/follow-requests/:userId/decline` | Decline a request | User |
| DELETE | `/v1/me/followers/:userId` | Remove a follower | User |
| POST | `/v1/users/:id/block` | Block (removes follows both ways) | User |
| DELETE | `/v1/users/:id/block` | Unblock | User |
| GET | `/v1/me/blocks` | Blocked users | User |
| GET | `/v1/search/users?q=` | Search users by username or name | User |
| GET | `/v1/discover/users` | Suggested people (mutuals, similar training) | User |
| GET | `/v1/leaderboards/exercises/:exerciseId?scope=following&metric=est_1rm` | Rank me against people I follow on a lift | User |
| GET | `/v1/compare/:username` | Head-to-head stats with a friend | User |
| POST | `/v1/reports` | Report a post, comment, user, food, or recipe | User |

## Feed, posts & comments

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/v1/feed?cursor=` | Home feed (posts from people I follow + my own) | User |
| GET | `/v1/feed/discover?cursor=` | Public discover feed (popular and recent) | User |
| POST | `/v1/posts` | Create a non-workout post (meal, day, progress, text) | User |
| GET | `/v1/posts/:id` | Post detail | User |
| PATCH | `/v1/posts/:id` | Edit caption or visibility | User |
| DELETE | `/v1/posts/:id` | Delete a post | User |
| POST | `/v1/posts/:id/like` | Like | User |
| DELETE | `/v1/posts/:id/like` | Unlike | User |
| GET | `/v1/posts/:id/likes?cursor=` | Who liked | User |
| GET | `/v1/posts/:id/comments?cursor=` | Comments (threaded) | User |
| POST | `/v1/posts/:id/comments` | Comment or reply (`parentId`). `@mentions` are parsed. | User |
| PATCH | `/v1/comments/:id` | Edit my comment | User |
| DELETE | `/v1/comments/:id` | Delete a comment (mine, or any comment on my post) | User |
| POST | `/v1/comments/:id/like` | Like a comment | User |
| DELETE | `/v1/comments/:id/like` | Unlike a comment | User |

## Notifications

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/v1/notifications?cursor=` | Inbox | User |
| GET | `/v1/notifications/unread-count` | Badge count | User |
| POST | `/v1/notifications/read` | Mark read: `{ ids: [...] }` or `{ all: true }` | User |
| GET | `/v1/realtime` | WebSocket upgrade to my `UserHub` (live notifications, counters, cross-device sync pings) | User |

## Gamification

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/v1/me/streaks` | Diary, workout, and water streaks | User |
| GET | `/v1/achievements` | Every achievement + my progress toward each | User |
| GET | `/v1/users/:username/achievements` | Someone's earned badges | User |
| GET | `/v1/challenges?scope=mine\|public` | Challenges | User |
| POST | `/v1/challenges` | Create a challenge | User |
| GET | `/v1/challenges/:id` | Challenge detail | User |
| PATCH | `/v1/challenges/:id` | Edit (creator, before start) | User |
| POST | `/v1/challenges/:id/join` | Join | User |
| DELETE | `/v1/challenges/:id/join` | Leave | User |
| POST | `/v1/challenges/:id/invite` | Invite followers | User |
| GET | `/v1/challenges/:id/leaderboard` | Live ranking (served by the `ChallengeRoom` DO) | User |

## AI

All AI calls go through **AI Gateway** to Workers AI. They are rate limited per user and per plan.

| Method | Path | Description | Access |
|---|---|---|---|
| POST | `/v1/ai/food/parse` | Text like "2 eggs, toast with butter, black coffee" → matched foods + servings for review | User (daily cap) / Premium |
| POST | `/v1/ai/food/photo` | Meal photo (media ID) → identified foods + portion estimates for review | Premium |
| POST | `/v1/ai/food/label` | Nutrition-label photo → prefilled custom food | User |
| POST | `/v1/ai/workout/title` | Suggest a title and summary for a finished workout | User |
| POST | `/v1/ai/coach/chat` | Streaming coach chat grounded in the user's own data (SSE) | Premium |

## Mobile sync

Offline-first sync for the React Native app. The mobile app keeps a local SQLite copy (Expo SQLite + Drizzle, the same SQL dialect as D1).

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/v1/sync/pull?since=<cursor>&tables=` | Rows changed since the cursor (including soft-deletes) for diary, water, workouts, routines, measurements, settings, custom foods, and exercises. Returns a new cursor. | User |
| POST | `/v1/sync/push` | Batch of client mutations `[{ table, op, id, data, clientUpdatedAt }]`. Resolves conflicts per row (last write wins on `updated_at`; a workout is atomic). Returns accepted and rejected rows. | User |

## Billing

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/v1/billing/plans` | Plans + prices | Public |
| GET | `/v1/me/subscription` | Current entitlement | User |
| POST | `/v1/billing/checkout` | Create a Stripe Checkout session (web) | User |
| POST | `/v1/billing/portal` | Create a Stripe customer portal session (web) | User |

Mobile purchases go through the App Store or Play Store via RevenueCat, then reach the API through the webhook below.

## Webhooks

| Method | Path | Description | Access |
|---|---|---|---|
| POST | `/v1/webhooks/stripe` | Subscription lifecycle (signature verified) | Signed |
| POST | `/v1/webhooks/revenuecat` | Mobile IAP entitlement changes (auth header verified) | Signed |

## Admin

Mounted at `/admin/v1/*` (that is, `https://ironplate.app/api/admin/v1/*`). Protected by **Cloudflare Access** (Zero Trust) in front of the route, *plus* a role check in the Worker.

| Method | Path | Description |
|---|---|---|
| GET | `/admin/v1/reports?status=` | Moderation queue |
| PATCH | `/admin/v1/reports/:id` | Resolve: dismiss, remove content, warn, or suspend |
| GET | `/admin/v1/food-submissions?status=` | Food correction queue |
| PATCH | `/admin/v1/food-submissions/:id` | Approve or reject (approval applies the change and re-embeds) |
| POST | `/admin/v1/foods/import` | Start the `FoodCatalogImport` Workflow (`{ source: "usda" \| "off" }`) |
| GET | `/admin/v1/imports/:id` | Import Workflow status |
| GET / POST / PATCH / DELETE | `/admin/v1/exercises[/:id]` | Manage the global exercise library |
| GET / POST / PATCH | `/admin/v1/explore/routines[/:id]` | Manage curated programs |
| GET / POST / PATCH | `/admin/v1/achievements[/:id]` | Manage achievements |
| GET | `/admin/v1/users?q=` | Look up users |
| POST | `/admin/v1/users/:id/ban` | Ban or suspend |
| POST | `/admin/v1/users/:id/unban` | Lift a ban |
| GET / PUT | `/admin/v1/flags` | Feature flags + remote config (KV) |
| GET | `/admin/v1/metrics` | Key product metrics (queried from Analytics Engine) |

## System

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/v1/health` | Liveness + binding checks | Public |
| GET | `/v1/config` | Remote config: feature flags, minimum app version, maintenance banner | Public |
| GET | `/v1/openapi.json` | OpenAPI 3.1 spec | Public |

---

## WebSocket protocols

All sockets hibernate (Durable Object WebSocket Hibernation API), so idle connections cost nothing. Messages are JSON: `{ "t": "<type>", ... }`.

### `/v1/realtime` → `UserHub` DO (one per user)

| Direction | Type | Payload |
|---|---|---|
| server → client | `notification` | Full notification object |
| server → client | `unread` | `{ count }` |
| server → client | `sync` | `{ tables: [...] }`: data changed on another device, so pull |
| server → client | `live_workout` | `{ active: boolean }`: a live workout started or ended elsewhere |
| client → server | `ack` | `{ notificationIds }` |
| both | `ping` / `pong` | Heartbeat (handled by an auto-response, so it doesn't wake the DO) |

### `/v1/live-workout/ws` → `LiveWorkout` DO (one per user)

| Direction | Type | Payload |
|---|---|---|
| client → server | `op` | `{ opId, kind, ... }` where `kind` is one of: `add_exercise`, `remove_exercise`, `reorder`, `set_superset`, `add_set`, `update_set`, `complete_set`, `remove_set`, `set_notes`, `start_rest`, `skip_rest`, `rename` |
| server → client | `state` | Full state snapshot (on connect) |
| server → client | `patch` | `{ opId, version, ops }`: applied op, broadcast to every device |
| server → client | `rest` | `{ endsAt }`: rest timer started (a DO alarm sends a push if no client is connected) |
| server → client | `finished` | `{ workoutId }` |

---

## Internal async contracts

These aren't public endpoints. They are the messages Workers pass to each other through **Queues**, **Workflows**, and **Cron Triggers**.

### Queues

| Queue | Producer | Message | Consumer does |
|---|---|---|---|
| `feed-fanout` | Workout or post created | `{ postId, authorId }` | Insert `feed_entries` for each accepted follower (chunked; very large accounts are merged at read time instead) |
| `notifications` | Likes, comments, follows, PRs, … | `{ userId, actorId, type, refs }` | Write `notifications`, push to `UserHub`, send APNs/FCM/Web Push if the user is offline and allows that type |
| `email` | Auth, exports, digests | `{ template, to, data }` | Render + send through Cloudflare Email Service |
| `workout-processed` | Workout saved, edited, or deleted | `{ workoutId, userId, op }` | PR detection, derived totals, streaks, achievements, challenge progress, muscle stats |
| `media` | Upload complete | `{ mediaId }` | Validate type and size, Workers AI moderation, read dimensions, mark ready or rejected |
| `search-index` | Food, exercise, or routine changed | `{ entity, id }` | Generate an embedding (Workers AI) and upsert it into Vectorize |
| `*-dlq` | n/a | Failed messages | Alert + manual replay |

### Workflows

| Workflow | Trigger | Steps |
|---|---|---|
| `FoodCatalogImport` | Admin endpoint / monthly cron | Download dump → R2 → parse in chunks → upsert `catalog` D1 → rebuild FTS → embed → Vectorize |
| `AccountDeletion` | `DELETE /v1/me` | Mark pending → `sleep(30 days)` → if not restored: purge D1 rows, R2 objects, Vectorize entries, feed entries → confirmation email |
| `DataExport` | `POST /v1/me/exports` | Collect all user rows → JSON + CSV → zip to R2 → email a signed link (expires in 7 days) |
| `OnboardingDrip` | Sign-up | Day 1, 3, and 7 tips (email/push), skipping steps the user already did |
| `WeeklyReport` | Weekly cron fan-out | Compute digest → save → push/email |

### Cron Triggers

| Schedule | Job |
|---|---|
| Every 15 min | Timezone-aware reminders ("log your dinner", "you planned Leg Day today") for users whose local time matches their preference |
| Hourly | Close finished challenges, award winners |
| Daily 03:00 UTC | Reconcile denormalized counters, expire idempotency keys and old exports, purge soft-deleted rows older than 30 days |
| Weekly (Mon 06:00 UTC) | Start `WeeklyReport` fan-out |
| Monthly | `FoodCatalogImport` delta from USDA and Open Food Facts |
