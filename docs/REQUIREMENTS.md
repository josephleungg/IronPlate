# Requirements & Features

IronPlate combines a **MyFitnessPal-style nutrition tracker** with a **Hevy-style workout logger and social network**, on one account and one feed. This document lists every feature, the non-functional requirements, and the tools and services the app depends on.

- [Product scope](#product-scope)
- [User roles](#user-roles)
- [Release phases](#release-phases)
- [Functional requirements](#functional-requirements)
- [Non-functional requirements](#non-functional-requirements)
- [Tech stack & tools](#tech-stack--tools)
- [Cloudflare services used](#cloudflare-services-used)
- [Non-Cloudflare dependencies](#non-cloudflare-dependencies-unavoidable)
- [Free vs Premium](#free-vs-premium-proposal)
- [Out of scope / open questions](#out-of-scope--open-questions)

---

## Product scope

| From MyFitnessPal | From Hevy | New in IronPlate |
|---|---|---|
| Daily food diary by meal | Workout logger with sets, reps, weight, RPE, supersets | One feed for **workouts and meals/progress** |
| Huge food database, barcode scanner | Routines, folders, program library | Nutrition and training analytics side by side |
| Recipes, saved meals, quick add | Exercise library with demos and muscle maps | Calories burned in workouts feed the diary automatically |
| Calorie and macro goals, per-day goals | PR tracking and charts | Shared challenges spanning lifting *and* nutrition |
| Weight, measurements, progress photos | Follow, feed, likes, comments, profiles | Live workout sync across phone, web, and watch |
| Water, fasting, steps | Leaderboards vs friends | AI meal-photo and text logging on the edge |
| Reports, streaks, Complete Diary projection | Calendar, body heatmap, streaks | |

## User roles

| Role | Description |
|---|---|
| Guest | Can view public profiles, shared routines, and workout share pages. Can use the TDEE calculator. |
| User | Free account, all core features |
| Premium | Paid subscription that unlocks the advanced features [below](#free-vs-premium-proposal) |
| Moderator | Reviews reports and food submissions |
| Admin | Manages the exercise library, imports, feature flags, and users |
| Coach *(future)* | Manages client programs and views their diaries (with consent) |

## Release phases

| Phase | Goal | Contents (requirement IDs below) |
|---|---|---|
| **P1 — MVP (web)** | Replace MFP + Hevy for daily use | Accounts, onboarding, diary, food search, barcode (web camera), custom foods, goals, weight, workout logging, routines, exercise library, PRs, basic charts, follow, feed, likes, comments, in-app notifications |
| **P2 — Depth** | Feature parity and retention | Recipes, saved meals, AI logging, measurements, progress photos, water, fasting, reports, streaks, achievements, challenges, email, web push, Premium billing, data export and deletion |
| **P3 — Mobile** | React Native app | Expo app, offline sync, native barcode, HealthKit and Health Connect, push, Live Activities, widgets, IAP |
| **P4 — Expansion** | Differentiation | Meal plans, AI coach, coach accounts, Apple Watch and Wear OS, group clubs, recipe import, Hevy and Strong importers |

---

## Functional requirements

Each item carries a phase (P1–P4).

### Accounts & onboarding (ACC)

| ID | Requirement | Phase |
|---|---|---|
| ACC-01 | Sign up / sign in with email + password, with email verification | P1 |
| ACC-02 | Sign in with Google and Apple (Apple is required on iOS whenever social login is offered) | P1 |
| ACC-03 | Unique username, chosen at sign-up and changeable later | P1 |
| ACC-04 | Password reset, change email, change password | P1 |
| ACC-05 | Session list with remote sign-out per device | P2 |
| ACC-06 | Onboarding: sex, age, height, weight, activity level, goal (lose/maintain/gain + rate), units, experience level. Computes TDEE (Mifflin-St Jeor) and suggests calorie and macro goals. | P1 |
| ACC-07 | Profile: display name, avatar, bio, private-account toggle | P1 |
| ACC-08 | Settings: units (kg/lb, km/mi, kcal/kJ), timezone, week start, privacy defaults, notification preferences | P1 |
| ACC-09 | Wellbeing mode: hide calorie numbers, show only macros or habits | P2 |
| ACC-10 | Age gate (13+, and higher where local law requires it) | P1 |
| ACC-11 | Bot protection (Turnstile) on sign-up, sign-in, and password reset | P1 |
| ACC-12 | Optional two-factor authentication (TOTP) | P4 |

### Food database (FOOD)

| ID | Requirement | Phase |
|---|---|---|
| FOOD-01 | Search millions of foods by name and brand, with typo tolerance and synonyms ("soda" finds "pop") | P1 |
| FOOD-02 | Barcode lookup (camera scan on web and mobile) with Open Food Facts fallback when a barcode is unknown | P1 |
| FOOD-03 | Multiple servings per food (g, ml, cup, slice, container, …) with gram/ml equivalents | P1 |
| FOOD-04 | Full nutrition panel: calories, protein, carbs, fat, fiber, sugar, saturated fat, sodium, plus vitamins and minerals | P1 |
| FOOD-05 | Create private custom foods | P1 |
| FOOD-06 | Verified badge for curated foods, ranked first in results | P1 |
| FOOD-07 | Suggest corrections and submit missing foods, with moderator review | P2 |
| FOOD-08 | Recent, frequent, and "My Foods" tabs, ranked by meal slot | P1 |
| FOOD-09 | Scan a nutrition label photo to prefill a custom food (AI) | P2 |

### Nutrition diary (NUT)

| ID | Requirement | Phase |
|---|---|---|
| NUT-01 | Daily diary split by meal slots (default Breakfast, Lunch, Dinner, Snacks). Up to 6 renamable slots. | P1 |
| NUT-02 | Log a food with serving and quantity into a meal on any date | P1 |
| NUT-03 | Edit, move, or delete entries. Multi-select delete and move. | P1 |
| NUT-04 | Quick add calories and/or macros without a food | P1 |
| NUT-05 | Daily summary: goal − food + exercise = remaining, with a macro progress ring | P1 |
| NUT-06 | Copy a meal or a whole day from another date | P1 |
| NUT-07 | Day notes | P2 |
| NUT-08 | "Complete Diary" button with the "if every day were like today, you'd weigh X in 5 weeks" projection | P2 |
| NUT-09 | Water tracking with quick-add buttons and a daily goal | P2 |
| NUT-10 | Exercise calories from logged workouts and synced active energy are added to the day, with a setting to disable it | P2 |
| NUT-11 | Nutrient detail view for the day (every micronutrient vs goal) | P2 |
| NUT-12 | Intermittent fasting timer with presets (16:8, 18:6, 20:4, OMAD) and history | P2 |
| NUT-13 | Diary sharing: private / followers / public. Friends can view an allowed diary. | P2 |
| NUT-14 | Share a meal or a day to the feed as a post | P2 |
| NUT-15 | Timezone-aware meal reminders | P2 |

### Recipes & meals (RCP)

| ID | Requirement | Phase |
|---|---|---|
| RCP-01 | Recipe builder: ingredients from the food DB, number of servings, auto-computed nutrition per serving | P2 |
| RCP-02 | Log a recipe like a food | P2 |
| RCP-03 | Import a recipe from a URL (schema.org Recipe + AI ingredient matching) | P4 |
| RCP-04 | Saved meals ("My Meals"): save a group of foods, log them in one tap | P2 |
| RCP-05 | Share public recipes, and copy other people's recipes | P2 |
| RCP-06 | Meal plans: plan days ahead, apply to the diary, shopping list. AI plan generation. | P4 |

### AI logging (AI)

| ID | Requirement | Phase |
|---|---|---|
| AI-01 | Natural-language logging ("chicken burrito bowl and a diet coke") → reviewable list of matched foods | P2 |
| AI-02 | Meal photo logging → identified foods + portion estimates, always shown for review before saving | P2 |
| AI-03 | Auto-suggested workout titles ("Push Day — 3 PRs") | P2 |
| AI-04 | AI coach chat grounded in the user's own diary, training, and goals. Never gives medical advice. | P4 |
| AI-05 | AI image moderation for uploads | P2 |

### Goals & body tracking (BODY)

| ID | Requirement | Phase |
|---|---|---|
| BODY-01 | Calorie and macro goals in grams or %, versioned by date so history stays accurate | P1 |
| BODY-02 | Different goals for specific days of the week (e.g. higher carbs on training days) | P2 |
| BODY-03 | Micronutrient goals | P2 |
| BODY-04 | Weight goal (lose/maintain/gain, target weight, weekly rate) with projected date | P1 |
| BODY-05 | Log weight. Trend line with moving average. | P1 |
| BODY-06 | Body measurements (body fat %, waist, chest, hips, neck, arms, thighs, calves, …) | P2 |
| BODY-07 | Progress photos with poses, side-by-side compare, private by default | P2 |
| BODY-08 | Steps and active energy from HealthKit / Health Connect | P3 |
| BODY-09 | Safety guardrails: warn below minimum calorie levels and on rapid loss rates. Link to support resources. | P1 |

### Exercise library (EXR)

| ID | Requirement | Phase |
|---|---|---|
| EXR-01 | Global library of 400+ exercises with instructions, demo media, equipment, and primary/secondary muscles | P1 |
| EXR-02 | Search and filter by muscle, equipment, and type. Synonym search ("skull crusher"). | P1 |
| EXR-03 | Custom exercises with type (weight × reps, bodyweight, assisted, duration, distance, …) | P1 |
| EXR-04 | Per-exercise history, PRs, and charts (est. 1RM, heaviest weight, best set volume, total volume) | P1 |

### Routines (RTN)

| ID | Requirement | Phase |
|---|---|---|
| RTN-01 | Create routines: exercises, target sets (warmup/normal/failure/drop), rep ranges, rest timers, supersets, notes | P1 |
| RTN-02 | Organize routines in folders, with drag to reorder | P1 |
| RTN-03 | Start a workout from a routine, prefilled with last-time values | P1 |
| RTN-04 | Share a routine by public link (no account needed to view), and copy others' routines | P2 |
| RTN-05 | Explore library of curated programs (PPL, Upper/Lower, 5×5, beginner full-body, …) | P2 |
| RTN-06 | Save any finished workout as a routine | P1 |

### Workout logging (WKT)

| ID | Requirement | Phase |
|---|---|---|
| WKT-01 | Live workout: add exercises, log sets, mark sets complete, reorder, supersets, notes | P1 |
| WKT-02 | "Previous" column showing last-time weight × reps for each set | P1 |
| WKT-03 | Rest timer starts automatically on set completion, adjustable, with notification when done | P1 |
| WKT-04 | Set types: warmup, normal, failure, drop. Optional RPE. | P1 |
| WKT-05 | Supported metrics: weight × reps, bodyweight reps, weighted/assisted bodyweight, duration, distance + duration, weight + distance | P1 |
| WKT-06 | Plate calculator and warmup-set calculator | P2 |
| WKT-07 | Live PR detection during the workout ("new est. 1RM!") | P1 |
| WKT-08 | Finish screen: title, description, photos/video, visibility, summary (duration, volume, sets, PRs) | P1 |
| WKT-09 | In-progress workout survives refresh and crashes, and syncs across devices in real time | P1 |
| WKT-10 | Edit or delete past workouts. PRs and stats are recomputed. | P1 |
| WKT-11 | Log a past workout after the fact (manual date/time) | P1 |
| WKT-12 | Estimated calories burned (MET-based), optionally fed into the diary | P2 |
| WKT-13 | Share card image for social media | P2 |
| WKT-14 | Import history from Hevy and Strong CSV exports | P4 |

### Progress & analytics (STAT)

| ID | Requirement | Phase |
|---|---|---|
| STAT-01 | Training dashboard: workouts per week, volume, duration, sets per muscle group | P1 |
| STAT-02 | Muscle heatmap (front/back body diagram) for a date range | P2 |
| STAT-03 | Nutrition reports: calories, macros, and any nutrient over 7/30/90/365 days vs goal | P2 |
| STAT-04 | Weight vs calories overlay chart | P2 |
| STAT-05 | Calendar view: workout days and completed diary days | P1 |
| STAT-06 | Weekly digest (in-app + email/push) | P2 |

### Social (SOC)

| ID | Requirement | Phase |
|---|---|---|
| SOC-01 | Follow / unfollow. Private accounts require approved follow requests. | P1 |
| SOC-02 | Home feed: workouts (and optional meal/progress posts) from people I follow, newest first | P1 |
| SOC-03 | Workout post card: title, duration, volume, PRs, exercise summary, photos | P1 |
| SOC-04 | Like posts. Comment with threaded replies. Like comments. | P1 |
| SOC-05 | @mentions in captions and comments, with notifications | P2 |
| SOC-06 | Profile page: stats, calendar, recent workouts, public routines, achievements | P1 |
| SOC-07 | Per-item visibility (private / followers / public) with account-level defaults | P1 |
| SOC-08 | Search users. Suggested people (mutual follows, similar training). | P1 |
| SOC-09 | Discover feed of popular public posts | P2 |
| SOC-10 | Leaderboards vs people I follow, per exercise | P2 |
| SOC-11 | Compare stats with a friend | P2 |
| SOC-12 | Copy a friend's workout into my own live workout | P1 |
| SOC-13 | Block users, remove followers, report content | P1 |
| SOC-14 | Progress-photo posts (opt-in, never automatic) | P2 |

### Notifications (NTF)

| ID | Requirement | Phase |
|---|---|---|
| NTF-01 | In-app inbox with unread badge, updated in real time | P1 |
| NTF-02 | Types: like, comment, reply, mention, follow, follow request/accept, PR, achievement, challenge, streak, reminder | P1 |
| NTF-03 | Web push | P2 |
| NTF-04 | Mobile push (APNs / FCM) | P3 |
| NTF-05 | Transactional email (verification, reset, exports) and opt-in digests | P1 (transactional) / P2 (digest) |
| NTF-06 | Per-type, per-channel preferences, plus quiet hours | P2 |

### Gamification (GAME)

| ID | Requirement | Phase |
|---|---|---|
| GAME-01 | Streaks: diary logging, workouts per week, water, protein goal | P2 |
| GAME-02 | Achievements/badges (first workout, 100 workouts, 1,000,000 kg lifted, 30-day diary streak, …) | P2 |
| GAME-03 | Challenges: create or join time-boxed challenges on a metric (workouts, volume, active days, diary days, protein days, steps) with live leaderboard | P2 |
| GAME-04 | Group clubs (gym crews) with shared feed and challenges | P4 |

### Premium & billing (BILL)

| ID | Requirement | Phase |
|---|---|---|
| BILL-01 | Monthly and yearly Premium plans with free trial (Stripe on web) | P2 |
| BILL-02 | In-app purchases on iOS and Android (RevenueCat), same entitlement across platforms | P3 |
| BILL-03 | Feature gating by entitlement on API and UI | P2 |

### Privacy & data (PRIV)

| ID | Requirement | Phase |
|---|---|---|
| PRIV-01 | Export all of my data (JSON + CSV) | P2 |
| PRIV-02 | Delete my account with a 30-day grace period, then a full purge (D1, R2, Vectorize) | P2 |
| PRIV-03 | Diary, body data, and progress photos are private by default | P1 |
| PRIV-04 | Strip EXIF/GPS metadata from every delivered image | P1 |
| PRIV-05 | Cookie and consent handling (essential-only by default) | P1 |

### Admin & moderation (ADM)

| ID | Requirement | Phase |
|---|---|---|
| ADM-01 | Admin console behind Cloudflare Access (Zero Trust) | P1 |
| ADM-02 | Moderation queue for reports, with actions (remove, warn, suspend, ban) | P1 |
| ADM-03 | Food submission review | P2 |
| ADM-04 | Manage the exercise library, curated programs, and achievements | P1 |
| ADM-05 | Run and monitor food catalog imports | P1 |
| ADM-06 | Feature flags + remote config (minimum app version, maintenance banner) | P1 |
| ADM-07 | Product metrics dashboard | P2 |

### Mobile app (MOB): React Native, P3

| ID | Requirement |
|---|---|
| MOB-01 | Expo (React Native) app for iOS and Android using the same `/api/v1` |
| MOB-02 | Offline-first: diary and live workouts work without signal, then sync |
| MOB-03 | Native barcode scanning |
| MOB-04 | HealthKit / Health Connect: read steps, active energy, weight. Write workouts. |
| MOB-05 | Push notifications, including the rest-timer-done alert |
| MOB-06 | iOS Live Activity / Dynamic Island for the active workout and rest timer |
| MOB-07 | Home-screen widgets (calories remaining, streak) |
| MOB-08 | Apple Watch / Wear OS companion (P4) |
| MOB-09 | Deep links / universal links for profiles, workouts, and shared routines |

---

## Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | API p95 < 200 ms for reads and < 400 ms for writes, measured at the edge. Diary and feed first paint < 1.5 s on 4G. Food search results < 300 ms. |
| Availability | 99.9% monthly for the API. Live workout data must never be lost once the client has received an ack. |
| Scalability | Designed for 1M registered users / 100k DAU on the initial topology, with a documented sharding path ([DATABASE.md](DATABASE.md#scaling-path)) |
| Offline | Mobile: diary and workout logging fully usable offline. Web: the live workout survives tab refresh and network blips. |
| Security | Aligned with OWASP ASVS L2. Secure-cookie sessions. Authorization enforced in the API, never trusted to the client. Rate limiting on every write and AI endpoint. Secrets only in Wrangler secrets / Secrets Store. |
| Privacy | GDPR/CCPA rights (access, export, deletion). Health-adjacent data treated as sensitive. No selling of data. Minimal third-party scripts. |
| Accessibility | WCAG 2.2 AA. Full keyboard navigation for logging. Screen-reader labels on charts (data tables as fallback). |
| Internationalization | All strings externalized. Locale-aware number and date formatting. Metric/imperial throughout. |
| Responsible design | Calorie floor warnings, optional hidden numbers, no "shame" mechanics on streak loss, support resources for disordered eating |
| Observability | Structured logs, traces, error alerting, product analytics without third-party trackers |
| Compatibility | Last 2 versions of evergreen browsers. iOS 16+ and Android 10+ for mobile. |
| Maintainability | TypeScript strict across the monorepo. Shared Zod schemas are the single source of truth for API contracts. ≥ 80% coverage on domain logic (calculations, PRs, permissions). |

---

## Tech stack & tools

### Applications

| Layer | Choice | Notes |
|---|---|---|
| Web framework | **Next.js 16 (App Router), React 19** | Deployed to Cloudflare Workers with the **OpenNext Cloudflare adapter** (`@opennextjs/cloudflare`) |
| API framework | **Hono** on Cloudflare Workers | Tiny, Workers-native. `@hono/zod-openapi` generates the OpenAPI spec from Zod. Typed RPC client. |
| Language | **TypeScript** (strict) | Shared across web, API, jobs, and mobile |
| Validation | **Zod** | Shared request/response schemas in `packages/shared` |
| ORM / migrations | **Drizzle ORM** + **drizzle-kit** | First-class D1 support. The same schema dialect works for Expo SQLite on mobile. |
| Auth | **Better Auth** | Runs on Workers with D1 via the Drizzle adapter. Plugins: `username`, `admin`, `expo`, `twoFactor` (later). |
| Styling | **Tailwind CSS v4** + **shadcn/ui** (Radix primitives) | |
| Client data | **TanStack Query** | Caching, optimistic updates for logging. Also used on mobile. |
| Forms | **React Hook Form** + Zod resolver | |
| Charts | **Recharts** (or visx for the body heatmap) | |
| Barcode (web) | `BarcodeDetector` API with `@zxing/browser` fallback | |
| Dates | **date-fns** + `@date-fns/tz` | Timezone-correct diary days |
| Mobile (P3) | **Expo** (React Native) + Expo Router | `expo-camera`, `expo-secure-store`, `expo-notifications`, `expo-sqlite`, HealthKit / Health Connect modules |

### Tooling

| Purpose | Tool |
|---|---|
| Monorepo | **pnpm workspaces** + **Turborepo** |
| Cloudflare CLI / local dev | **Wrangler** (local D1, KV, R2, DO, Queues through Miniflare/workerd) |
| Lint + format | **Biome** |
| Unit / integration tests | **Vitest** + `@cloudflare/vitest-pool-workers` (tests run inside the real Workers runtime) |
| E2E tests | **Playwright** |
| API docs | OpenAPI 3.1 (generated) + Scalar UI at `/api/v1/docs` |
| CI/CD | **Cloudflare Workers Builds** (git-connected builds, preview URLs per branch) + GitHub Actions for tests and D1 migrations |
| Mobile builds (P3) | EAS Build + EAS Update |

---

## Cloudflare services used

Everything runs on Cloudflare except the few things in the [next section](#non-cloudflare-dependencies-unavoidable).

| Service | What IronPlate uses it for |
|---|---|
| **Workers** | Runs the API (`api`), the background jobs (`jobs`), and the Next.js app (`web`, via OpenNext) |
| **Workers Static Assets** | Serves Next.js static assets. (Cloudflare points new full-stack apps at Workers rather than Pages, and OpenNext targets Workers.) |
| **Pages** | Optional: marketing site / docs if kept separate from the app |
| **D1** | Primary relational DB: `core` (user data) + `catalog` (foods). Read replication through the Sessions API. FTS5 for keyword search. |
| **Durable Objects** | `UserHub` (realtime WebSockets, unread counts), `LiveWorkout` (in-progress workout state + rest-timer alarms), `ChallengeRoom` (live leaderboards) |
| **KV** | Barcode cache, public profile/explore caches, feature flags + remote config |
| **R2** | User media (avatars, workout, meal, and progress photos), data exports, food import dumps, OpenNext incremental cache |
| **Images** | Resize, crop, convert to WebP/AVIF, and strip metadata on delivery |
| **Stream** | Short workout videos (P2) |
| **Queues** | Feed fan-out, notifications, email, workout post-processing, media processing, search indexing |
| **Workflows** | Food catalog import, account deletion, data export, onboarding drip, weekly reports |
| **Cron Triggers** | Reminders, challenge closing, counter reconciliation, cleanup, scheduled imports |
| **Workers AI** | Meal-photo and label recognition (vision LLM), natural-language food parsing, embeddings, image moderation, AI coach |
| **AI Gateway** | Caching, rate limiting, logging, and model fallback for all AI calls |
| **Vectorize** | Semantic search over foods, exercises, and routines. Matching AI-parsed items to foods. |
| **Browser Rendering** | Recipe import from JavaScript-heavy recipe sites (P4) |
| **Email Service** | Transactional + digest email via the `send_email` binding (public beta as of April 2026) |
| **Email Routing** | `support@` / `privacy@` inbound addresses |
| **Turnstile** | Bot protection on auth forms |
| **Rate Limiting binding + WAF rules** | Per-user / per-IP limits in Workers, plus edge rules |
| **Analytics Engine** | Product events and API metrics, queried from the admin dashboard |
| **Web Analytics** | Privacy-first page analytics (no cookies) |
| **Workers Logs / Traces / Logpush** | Observability, with logs archived to R2 |
| **Secrets Store / Wrangler secrets** | API keys (Stripe, RevenueCat, APNs, FCM, VAPID) |
| **Zero Trust Access** | Locks the admin console and admin API to staff identities |
| **Registrar, DNS, CDN, SSL, DDoS** | Domain at cost, global edge, free certificates, attack protection |
| **Workers Builds** | Git-connected CI/CD with preview deployments |

## Non-Cloudflare dependencies (unavoidable)

| Need | Provider | Why not Cloudflare |
|---|---|---|
| Card payments (web) | **Stripe** | Cloudflare has no payments product |
| In-app purchases (mobile) | **App Store / Play Billing via RevenueCat** | Apple and Google require their own billing for digital subscriptions |
| Mobile push delivery | **APNs** (Apple) / **FCM** (Google) | The OS vendors own push. Workers call them directly. Web Push uses VAPID straight from a Worker. |
| OAuth identity | **Google**, **Apple** | Identity providers |
| Food data | **USDA FoodData Central** (public domain), **Open Food Facts** (ODbL: requires attribution, and the derived food database must stay open) | Data sources, imported into D1 |
| Exercise seed data | An openly licensed exercise dataset + commissioned demo media | Data source (check license before import) |
| Mobile builds and store submission | **Expo EAS**, App Store Connect, Google Play Console | Native toolchains |

## Free vs Premium (proposal)

| Feature | Free | Premium |
|---|---|---|
| Food diary, search, barcode, custom foods | ✅ | ✅ |
| Workout logging, routines, PRs | ✅ (up to 6 routines) | ✅ unlimited |
| Social: follow, feed, likes, comments | ✅ | ✅ |
| Basic charts (last 3 months) | ✅ | All-time + advanced |
| AI text logging | 5/day | Unlimited |
| AI photo logging | — | ✅ |
| Per-day macro goals, micronutrient goals | — | ✅ |
| Meal plans, AI coach, recipe import | — | ✅ |
| Custom exercise media, workout videos | — | ✅ |
| Ads | None | None |

## Out of scope / open questions

- **Medical/clinical use:** not a medical device. No diagnosis or treatment advice.
- **Coach marketplace:** deferred to P4+. Needs consent and permission modelling for client data.
- **Wearable integrations beyond HealthKit/Health Connect** (Garmin, Whoop, Oura): post-P4.
- **Open question:** should meal posts be on by default for public profiles? Proposed: no, opt-in per post.
- **Open question:** the Open Food Facts ODbL share-alike requirement affects how the merged food database can be licensed. Needs a decision (and possibly legal review) before launch.
