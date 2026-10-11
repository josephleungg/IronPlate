# LockedIn

> Track what you eat. Log what you lift. Do it with your friends.

LockedIn is a full-stack fitness app that combines a **MyFitnessPal-style nutrition tracker** with a **Hevy-style workout logger and social feed**. It's built with **Next.js** and runs entirely on **Cloudflare** (Workers, D1, R2, KV, Durable Objects, Queues, Workflows, Workers AI, Vectorize). The API is designed from day one to also serve a future **React Native (Expo)** mobile app.

> **Status:** Planning. This repo currently holds the design docs. No application code yet.
>
> **Name:** "LockedIn" is a working title. See [candidate names](#candidate-names).

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
| **Web** | Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · shadcn/ui · TanStack Query, deployed to Workers via OpenNext |
| **API** | Hono on Cloudflare Workers · Zod + OpenAPI · Better Auth |
| **Data** | Cloudflare D1 (SQLite) via Drizzle ORM · KV · R2 · Vectorize · Durable Objects |
| **Async** | Cloudflare Queues · Workflows · Cron Triggers |
| **AI** | Workers AI via AI Gateway |
| **Edge & security** | Cloudflare DNS, CDN, WAF, Turnstile, Zero Trust Access, Email Service |
| **Mobile (planned)** | Expo / React Native · Expo Router · Expo SQLite + Drizzle (offline sync) |
| **Tooling** | pnpm + Turborepo · TypeScript strict · Biome · Vitest (`vitest-pool-workers`) · Playwright · Wrangler · Workers Builds |

Outside Cloudflare, the app only depends on: Stripe (web payments), RevenueCat / app stores (mobile IAP), APNs/FCM (push), Google/Apple (OAuth), and USDA / Open Food Facts (food data).

---

## Documentation

| Doc | What's inside |
|---|---|
| [Requirements & Features](docs/REQUIREMENTS.md) | Every feature (with IDs and phases), non-functional requirements, tools, Cloudflare service map, Free vs Premium |
| [Architecture](docs/ARCHITECTURE.md) | System diagram, Workers layout, monorepo structure, data/realtime/async design, key sequence flows, security, CI/CD, mobile plan, platform limits |
| [Database](docs/DATABASE.md) | UML ER diagrams for every table, conventions, indexes, scaling path |
| [API](docs/API.md) | All REST endpoints, WebSocket protocols, webhooks, and internal queue/workflow/cron contracts |

---

## Planned repository layout

```
apps/
  web/        Next.js app (OpenNext → Cloudflare Workers)
  api/        Hono REST API + Better Auth + Durable Objects
  jobs/       Queue consumers, Cron Triggers, Workflows
  mobile/     Expo app (phase 3)
packages/
  db/         Drizzle schema + D1 migrations + seeds
  shared/     Zod schemas, types, nutrition and training math
  api-client/ Typed API client for web and mobile
  ui/         Web design system
  config/     Shared tsconfig / biome / tailwind
docs/
```

## Getting started (once scaffolded)

These commands describe the intended workflow. They won't run until the apps exist.

```bash
pnpm install
```

```bash
pnpm db:migrate:local
```

```bash
pnpm db:seed:local
```

```bash
pnpm dev
```

`pnpm dev` will run `next dev` for `apps/web` and `wrangler dev` for `apps/api` and `apps/jobs`, all against local D1, KV, and R2.

---

## Roadmap

| Phase | Focus |
|---|---|
| **P1 — MVP (web)** | Accounts, diary, food search + barcode, goals, weight, workout logger, routines, exercise library, PRs, follow/feed/likes/comments, in-app notifications |
| **P2 — Depth** | Recipes, saved meals, AI logging, measurements, progress photos, water, fasting, reports, streaks, achievements, challenges, push/email, Premium |
| **P3 — Mobile** | Expo app, offline sync, native barcode, HealthKit / Health Connect, push, Live Activities, widgets, IAP |
| **P4 — Expansion** | Meal plans, AI coach, coach accounts, watch apps, clubs, recipe import, Hevy/Strong importers |

---

## Candidate names

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
| 10 | **Lockstep** | Training and eating in lockstep with your crew. A nod to "LockedIn". |

Check trademark and domain/app-store availability before committing to any of these.

---

## Data attribution

Food data will include content from [Open Food Facts](https://world.openfoodfacts.org) (ODbL) and [USDA FoodData Central](https://fdc.nal.usda.gov) (public domain). Attribution will be shown in-app as each license requires.
