# IronPlate

> Track what you eat. Log what you lift. Do it with your friends.

IronPlate is a full-stack fitness app that combines a **MyFitnessPal-style nutrition tracker** with a **Hevy-style workout logger and social feed**. It's built with **Next.js** on **Vercel**, with **Cloudflare** providing the database (D1), photo storage (R2), and AI (Workers AI). The API is versioned and designed from day one to also serve a future **React Native (Expo)** mobile app.

> **Status:** Working app. The backend and the mobile-first web UI are built and tested. Deploying needs your Cloudflare and Vercel accounts: see [docs/SETUP.md](docs/SETUP.md). Not built yet: photo upload screens, camera barcode scanning, the React Native app. See [what's built](#whats-built).

---

## Features

**Nutrition (MyFitnessPal-style)**
- Daily food diary by meal, with quick add, copy meal/day, notes, and Complete Diary weight projection
- Millions of foods (USDA + Open Food Facts), barcode scanning, custom foods, verified entries
- Recipes, saved meals, and (later) meal plans with shopping lists
- Calorie, macro, and micronutrient goals, with optional per-day-of-week goals
- Water, intermittent fasting, weight, body measurements, progress photos
- AI logging: type "2 eggs and toast" or snap a photo of your plate, then review and save

**Training (Hevy-style)**
- Live workout logger: sets × reps × weight, RPE, warmup/failure/drop sets, supersets, rest timer, previous-set values
- Routines, folders, shareable routine links, curated program library
- 400+ exercise library with demos and muscle maps, plus custom exercises
- Automatic PRs (est. 1RM, heaviest weight, best set volume, reps), per-exercise charts
- Real-time sync of the in-progress workout across phone, web, and watch

**Social**
- Follow friends (public or private accounts), home feed, likes, threaded comments, @mentions
- Share workouts, meals, full days, progress, and milestones, with per-post visibility
- Leaderboards vs friends, head-to-head compare, challenges, streaks, achievements
- Real-time notifications (in-app, web push, mobile push, email)

The full feature list with IDs and release phases is in [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md).

---

## Tech stack

| | |
|---|---|
| **Web + API** | Next.js 16 (App Router, route handlers) on Vercel · React 19 · Tailwind CSS v4 · TanStack Query |
| **Auth** | Better Auth (email + password, usernames, admin role, invite code) |
| **Data** | Cloudflare D1 (SQLite) through Drizzle ORM · local SQLite file in development |
| **D1 access** | A small Cloudflare Worker (`workers/gateway`) that Vercel calls over HTTPS with a secret token |
| **Photos** | Cloudflare R2 with presigned direct uploads |
| **AI** | Workers AI through the same gateway (natural-language food logging) |
| **Food data** | Curated starter set + Open Food Facts barcode lookups, cached into the database |
| **Brand** | Space Grotesk + Inter, Midnight Navy / Electric Lime / Soft Lavender / Warm White ([PRODUCT.md](PRODUCT.md)) |
| **Mobile (planned)** | Expo / React Native against the same `/api/v1` |
| **Tooling** | TypeScript strict · Zod validation · Vitest · Wrangler · a 75-check API smoke test |

Outside Cloudflare and Vercel the app only depends on Open Food Facts (barcode data). Realtime notifications use polling, because Vercel functions can't hold WebSockets.

---

## What's built

| Area | Status |
|---|---|
| Accounts: sign up (with invite code), sign in, profile, settings, onboarding with TDEE and macro goals | Done |
| Food diary: search, barcode lookup, custom foods, meals, quick add, copy, water, notes, day totals | Done |
| Body: weight and measurements, nutrition and weight goals | Done |
| Workouts: logging, edit and delete, volume and set totals, automatic PRs (rebuilt from history) | Done |
| Exercises and routines: 97 seeded exercises, custom exercises, routines, save workout as routine, share link | Done |
| Social: follow (with private accounts), block, feed, discover, posts, likes, comments, notifications | Done |
| Photos (R2), AI food parsing | Done, needs your Cloudflare setup |
| Reports: training totals, weekly volume, sets per muscle | Done |
| **Web UI**: sign-in, onboarding, diary, live workout logger with rest timer, routines, workout summaries, friends feed, profiles, progress charts, settings, notifications | Done, in light and dark |
| Photo upload screens, camera barcode scanning (barcode numbers can be typed in) | Not built yet |
| Mobile app, meal plans, recipes, challenges, fasting | Planned, see [requirements](docs/REQUIREMENTS.md) |

## Documentation

| Doc | What's inside |
|---|---|
| [Setup and deployment](docs/SETUP.md) | What you need to do in Cloudflare and Vercel, step by step, plus troubleshooting |
| [Requirements & Features](docs/REQUIREMENTS.md) | Every feature (with IDs and phases), non-functional requirements, tools, Cloudflare service map, Free vs Premium |
| [Architecture](docs/ARCHITECTURE.md) | System diagram, Workers layout, monorepo structure, data/realtime/async design, key sequence flows, security, CI/CD, mobile plan, platform limits |
| [Database](docs/DATABASE.md) | UML ER diagrams for every table, conventions, indexes, scaling path |
| [API](docs/API.md) | All REST endpoints, WebSocket protocols, webhooks, and internal queue/workflow/cron contracts |

---

## Repository layout

```
src/
  app/              Web UI: (flow) sign-in, sign-up, onboarding; (app) diary, train, friends, progress, settings
  components/       Design system (cards, buttons, sheets, charts) and app shell
  app/api/          REST API route handlers (/api/v1/...) and the auth handler
  server/           HTTP helper, permission rules, domain services
  db/               Drizzle schema, seed data, local and gateway database driver
  lib/domain/       Pure, unit-tested logic: units, dates, TDEE and macros, 1RM, volume, PRs
workers/gateway/    Cloudflare Worker that gives Vercel access to D1 and Workers AI
drizzle/            Generated SQL migrations
scripts/            Local migrate, seed, and the API smoke test
tests/              Unit tests
docs/               Design and setup docs
```

## Getting started

Requires Node 24 or newer. Local development needs no Cloudflare account.

```bash
npm install
```

```bash
cp .env.example .env.local
```

Put a random value in `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), then:

```bash
npm run db:setup:local
```

```bash
npm run dev
```

To exercise the whole API against the running server:

```bash
scripts/smoke.sh
```

To deploy, follow [docs/SETUP.md](docs/SETUP.md).

---

## Roadmap

| Phase | Focus |
|---|---|
| **P1 — MVP (web)** (done) | Accounts, diary, food search + barcode, goals, weight, workout logger, routines, exercise library, PRs, follow/feed/likes/comments, in-app notifications |
| **P2 — Depth** | Recipes, saved meals, AI logging, measurements, progress photos, water, fasting, reports, streaks, achievements, challenges, push/email, Premium |
| **P3 — Mobile** | Expo app, offline sync, native barcode, HealthKit / Health Connect, push, Live Activities, widgets, IAP |
| **P4 — Expansion** | Meal plans, AI coach, coach accounts, watch apps, clubs, recipe import, Hevy/Strong importers |

---

## Name

The app is called **IronPlate**. These were the other candidates:

| # | Name | Why it works |
|---|---|---|
| 1 | **Kilo** | One word covering both units you track: *kilo*calories and *kilo*grams |
| 2 | **IronPlate** | The plate you lift and the plate you eat off |
| 3 | **Spotter** | The gym friend who has your back, which fits the social side |
| 4 | **Barbite** | Barbell + bite. Short and memorable. |
| 5 | **Stackd** | Stack plates, stack macros, stack streaks |
| 6 | **RepFuel** | Reps and the fuel behind them |
| 7 | **Macrolift** | Macros + lifting in one word |
| 8 | **Plate & PR** | Eat right, hit PRs. Works well as a logo lockup. |
| 9 | **Gainsboard** | Gains + leaderboard/dashboard. Leans into the social competition. |
| 10 | **Lockstep** | Training and eating in lockstep with your crew. |

Check trademark and domain/app-store availability before committing to any of these.

---

## Data attribution

Food data will include content from [Open Food Facts](https://world.openfoodfacts.org) (ODbL) and [USDA FoodData Central](https://fdc.nal.usda.gov) (public domain). Attribution will be shown in-app as each license requires.
