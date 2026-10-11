# Database Design

IronPlate stores relational data in **Cloudflare D1** (serverless SQLite), accessed through **Drizzle ORM**. This document holds the full schema as UML entity-relationship diagrams, plus conventions, indexes, and scaling notes.

> **As built (v0).** The schema in `src/db/schema/` follows this design with these differences: one database instead of `core` + `catalog`; Better Auth's tables are named `user`, `session`, `account`, `verification` (singular); there is no `feed_entries` table (the feed is a query); `personal_records` has an `is_baseline` flag; and recipes, saved meals, meal plans, fasting, achievements, and challenges are not created yet. Statement batches go through `db.batch()` because D1 has no interactive transactions.

- [Conventions](#conventions)
- [Database split](#database-split)
- [Overview diagram](#overview)
- [1. Identity & platform](#1-identity--platform)
- [2. Goals, body & activity](#2-goals-body--activity)
- [3. Food catalog (catalog DB)](#3-food-catalog-catalog-db)
- [4. Nutrition diary, recipes & meals](#4-nutrition-diary-recipes--meals)
- [5. Training](#5-training)
- [6. Social](#6-social)
- [7. Gamification](#7-gamification)
- [Indexes](#indexes)
- [Data that does not live in D1](#data-that-does-not-live-in-d1)
- [Scaling path](#scaling-path)

---

## Conventions

| Topic | Rule |
|---|---|
| Primary keys | `text` **UUIDv7**, generated **on the client** where possible (web and mobile). IDs sort by time, and a retried create is a no-op (`INSERT ... ON CONFLICT DO NOTHING`). That makes offline sync and retries safe. |
| Timestamps | Stored as `integer` epoch milliseconds (UTC). Shown as `timestamp` in diagrams. |
| Calendar dates | Diary days, water, activity, and goals use the user's **local** date as `text` `YYYY-MM-DD` (shown as `date`). The user's IANA timezone is in `user_settings.timezone`. |
| Units | Always canonical metric: kg, cm, m, ml, g, kcal. Clients convert for display using `user_settings`. |
| Booleans | `integer` 0/1 (shown as `bool`). |
| JSON | `text` holding JSON (shown as `json`). Used for micronutrients, notification preferences, and snapshots. |
| Soft deletes | Tables that mobile devices sync have `updated_at` + `deleted_at` so `GET /v1/sync/pull` can return deletions. Hard purge happens in the `AccountDeletion` workflow and nightly cleanup. |
| Nutrition snapshots | `diary_entries` copy the food name and nutrient values at the time of logging. Later edits to a food never rewrite history, and reading a diary never needs the catalog DB. |
| Denormalized counters | `profiles.followers_count`, `posts.like_count`, and similar counters are updated in the same `batch()` as the write. Nightly jobs reconcile them. |
| Enums | Stored as `text` with a `CHECK` constraint. Allowed values are listed in the diagram comments. |
| D1 parameter limit | A D1 query can bind at most **100 parameters**. Multi-row inserts (such as a workout with 40 sets) go through `db.batch([...])` with one statement per row, never a single giant `VALUES` list. |

## Database split

| D1 database | Contents | Why separate |
|---|---|---|
| `core` | Users, auth, settings, goals, body data, diary, recipes, training, social, gamification | Source of truth for user data. Read replication is on, accessed through the D1 Sessions API. |
| `catalog` | `foods`, `food_servings`, `food_barcodes`, `food_submissions`, `foods_fts` | Millions of rows and mostly reads. Bulk imports of USDA and Open Food Facts data must not contend with the `core` writer or eat its 10 GB limit. |

References from `core` into `catalog` (for example `diary_entries.food_id`) are **logical foreign keys**. D1 cannot enforce them across databases, so the API validates them. They are drawn as dashed lines below.

---

## Overview

The spine of the app, without attributes:

```mermaid
erDiagram
    users ||--|| profiles : "has"
    users ||--o{ diary_entries : "logs"
    foods ||..o{ diary_entries : "logged as"
    users ||--o{ workouts : "performs"
    workouts ||--o{ workout_exercises : "contains"
    exercises ||--o{ workout_exercises : "performed as"
    workout_exercises ||--o{ workout_sets : "has"
    users ||--o{ routines : "owns"
    routines |o--o{ workouts : "template for"
    users ||--o{ posts : "authors"
    workouts |o--o| posts : "shared as"
    users ||--o{ follows : "follows"
    posts ||--o{ likes : "receives"
    posts ||--o{ comments : "receives"
    posts ||--o{ feed_entries : "fanned out to"
    users ||--o{ notifications : "receives"
```

---

## 1. Identity & platform

`users`, `sessions`, `accounts`, and `verifications` are the tables **Better Auth** owns. They come from its schema generator, with the `username` and `admin` plugins enabled. Everything else is app-owned.

```mermaid
erDiagram
    users ||--o{ sessions : "has"
    users ||--o{ accounts : "authenticates via"
    users ||--|| profiles : "has public"
    users ||--|| user_settings : "has private"
    users ||--o{ devices : "registers"
    users ||--o{ subscriptions : "pays via"
    users ||--o{ media_assets : "uploads"
    users ||--o{ data_exports : "requests"
    media_assets |o--o| profiles : "avatar of"

    users {
        text id PK "UUIDv7"
        text email UK
        bool email_verified
        text name
        text image
        text username UK "username plugin"
        text display_username
        text role "user|moderator|admin"
        bool banned
        text ban_reason
        timestamp ban_expires
        timestamp created_at
        timestamp updated_at
    }
    sessions {
        text id PK
        text user_id FK
        text token UK
        timestamp expires_at
        text ip_address
        text user_agent
        timestamp created_at
        timestamp updated_at
    }
    accounts {
        text id PK
        text user_id FK
        text provider_id "credential|google|apple"
        text account_id "provider user id"
        text password "hash, credential only"
        text access_token
        text refresh_token
        text id_token
        timestamp access_token_expires_at
        text scope
        timestamp created_at
        timestamp updated_at
    }
    verifications {
        text id PK
        text identifier "email or token purpose"
        text value
        timestamp expires_at
        timestamp created_at
    }
    profiles {
        text user_id PK, FK
        text display_name
        text bio
        text avatar_media_id FK
        bool is_private "follow requests required"
        int followers_count
        int following_count
        int workouts_count
        timestamp created_at
        timestamp updated_at
    }
    user_settings {
        text user_id PK, FK
        text sex "male|female|unspecified"
        date birth_date
        real height_cm
        text activity_level "sedentary|light|moderate|active|very_active"
        text weight_unit "kg|lb"
        text distance_unit "km|mi"
        text energy_unit "kcal|kj"
        text timezone "IANA, e.g. America/Toronto"
        text locale
        int week_start "0=Sun 1=Mon"
        text diary_visibility "private|followers|public"
        text default_workout_visibility "private|followers|public"
        bool hide_numbers "wellbeing mode"
        json notification_prefs
        timestamp onboarding_completed_at
        timestamp updated_at
    }
    devices {
        text id PK
        text user_id FK
        text platform "ios|android|web"
        text push_provider "apns|fcm|webpush"
        text push_token UK
        text app_version
        timestamp last_seen_at
        timestamp created_at
    }
    subscriptions {
        text id PK
        text user_id FK
        text provider "stripe|revenuecat"
        text provider_customer_id
        text provider_subscription_id UK
        text plan "premium_monthly|premium_yearly"
        text status "trialing|active|past_due|canceled|expired"
        timestamp current_period_end
        bool cancel_at_period_end
        timestamp created_at
        timestamp updated_at
    }
    media_assets {
        text id PK
        text owner_id FK
        text kind "avatar|workout_photo|workout_video|progress_photo|meal_photo|recipe_photo|exercise_media"
        text storage "r2|stream"
        text r2_key
        text stream_uid
        text mime_type
        int size_bytes
        int width
        int height
        real duration_s
        text status "pending|ready|rejected"
        text moderation_status "unchecked|ok|flagged"
        timestamp created_at
        timestamp deleted_at
    }
    data_exports {
        text id PK
        text user_id FK
        text status "queued|running|ready|expired|failed"
        text r2_key
        timestamp requested_at
        timestamp completed_at
        timestamp expires_at
    }
```

---

## 2. Goals, body & activity

```mermaid
erDiagram
    users ||--o{ nutrition_goals : "sets"
    users ||--o{ weight_goals : "sets"
    users ||--o{ body_measurements : "records"
    users ||--o{ progress_photos : "takes"
    media_assets ||--o| progress_photos : "image of"
    users ||--o{ activity_days : "syncs"
    users ||--o{ fasting_sessions : "fasts"

    nutrition_goals {
        text id PK
        text user_id FK
        date effective_from "versioned, past days keep old goals"
        int day_of_week "null = every day, 0-6 = per-day override"
        text macro_mode "grams|percent"
        int calories
        real protein_g
        real carbs_g
        real fat_g
        real fiber_g
        real sugar_g
        real sodium_mg
        int water_ml
        json micros "optional micronutrient targets"
        timestamp created_at
    }
    weight_goals {
        text id PK
        text user_id FK
        text goal_type "lose|maintain|gain"
        real start_weight_kg
        real target_weight_kg
        real weekly_rate_kg
        date start_date
        bool is_active
        timestamp created_at
    }
    body_measurements {
        text id PK
        text user_id FK
        text type "weight|body_fat|waist|chest|hips|neck|shoulders|bicep_l|bicep_r|forearm_l|forearm_r|thigh_l|thigh_r|calf_l|calf_r"
        real value "kg, percent, or cm"
        timestamp measured_at
        text source "manual|healthkit|health_connect|smart_scale"
        text note
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }
    progress_photos {
        text id PK
        text user_id FK
        text media_id FK
        date taken_on
        text pose "front|side|back|other"
        text visibility "private|followers|public"
        timestamp created_at
        timestamp deleted_at
    }
    activity_days {
        text user_id PK, FK
        date date PK
        int steps
        int active_kcal "from HealthKit or Health Connect"
        text source
        timestamp updated_at
    }
    fasting_sessions {
        text id PK
        text user_id FK
        text protocol "16:8|18:6|20:4|OMAD|custom"
        int target_minutes
        timestamp started_at
        timestamp ended_at
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }
```

---

## 3. Food catalog (catalog DB)

Seeded from **USDA FoodData Central** (public domain) and **Open Food Facts** (ODbL), then extended by user-created foods and recipes. Nutrients are stored **per 100 g or 100 ml** (`base_unit`). Servings convert to base units.

```mermaid
erDiagram
    foods ||--o{ food_servings : "measured in"
    foods ||--o{ food_barcodes : "identified by"
    foods |o--o{ food_submissions : "corrected by"
    foods ||--|| foods_fts : "indexed in"

    foods {
        text id PK
        text source "usda|off|user|recipe|verified"
        text source_ref "external id, e.g. FDC id"
        text owner_id "logical FK core.users, custom foods"
        text recipe_id "logical FK core.recipes"
        text name
        text brand
        text base_unit "g|ml"
        text visibility "public|private"
        bool is_verified
        real kcal_100
        real protein_100
        real carbs_100
        real fat_100
        real fiber_100
        real sugar_100
        real sat_fat_100
        real sodium_mg_100
        json micros_100 "vitamins and minerals"
        int popularity "log count, for ranking"
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }
    food_servings {
        text id PK
        text food_id FK
        text label "1 cup, 1 slice, 1 container"
        real amount "in base units (g or ml)"
        bool is_default
        int position
    }
    food_barcodes {
        text barcode PK "normalized GTIN-13"
        text food_id FK
    }
    food_submissions {
        text id PK
        text food_id FK "null = brand new food"
        text submitted_by "logical FK core.users"
        json payload "proposed values"
        text status "pending|approved|rejected"
        text reviewed_by
        timestamp created_at
        timestamp reviewed_at
    }
    foods_fts {
        text name "FTS5 virtual table"
        text brand
    }
```

---

## 4. Nutrition diary, recipes & meals

Dashed lines are logical references into the `catalog` database.

```mermaid
erDiagram
    users ||--o{ meal_slots : "defines"
    users ||--o{ diary_days : "keeps"
    users ||--o{ diary_entries : "logs"
    diary_days ||--o{ diary_entries : "contains"
    meal_slots ||--o{ diary_entries : "groups"
    foods ||..o{ diary_entries : "logged as"
    food_servings ||..o{ diary_entries : "measured by"
    users ||--o{ water_logs : "drinks"
    users ||--o{ recipes : "creates"
    recipes ||--o{ recipe_ingredients : "contains"
    foods ||..o{ recipe_ingredients : "used in"
    recipes ||..|| foods : "published as"
    users ||--o{ saved_meals : "saves"
    saved_meals ||--o{ saved_meal_items : "contains"
    foods ||..o{ saved_meal_items : "used in"
    users ||--o{ meal_plans : "plans"
    meal_plans ||--o{ meal_plan_entries : "contains"
    meal_slots ||--o{ meal_plan_entries : "slotted in"
    foods ||..o{ meal_plan_entries : "used in"

    meal_slots {
        text id PK
        text user_id FK
        text name "Breakfast, Lunch, Dinner, Snacks, custom"
        int position
        bool is_archived
        timestamp created_at
        timestamp updated_at
    }
    diary_days {
        text user_id PK, FK
        date date PK
        text notes
        timestamp completed_at "Complete Diary pressed"
        timestamp updated_at
    }
    diary_entries {
        text id PK "client UUIDv7"
        text user_id FK
        date date
        text meal_slot_id FK
        text food_id "logical FK, null for quick add"
        text serving_id "logical FK"
        real servings "number of servings"
        real amount "base units consumed"
        text name "snapshot"
        text brand "snapshot"
        real kcal "snapshot totals for this entry"
        real protein_g
        real carbs_g
        real fat_g
        real fiber_g
        real sugar_g
        real sodium_mg
        json micros
        text source "search|barcode|recent|saved_meal|recipe|copy|quick_add|ai_photo|ai_text|meal_plan"
        int position
        timestamp logged_at
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }
    water_logs {
        text id PK
        text user_id FK
        date date
        int amount_ml
        timestamp logged_at
        timestamp updated_at
        timestamp deleted_at
    }
    recipes {
        text id PK
        text user_id FK
        text food_id "logical FK, loggable catalog row"
        text name
        text description
        text instructions
        real servings
        int prep_minutes
        int cook_minutes
        text image_media_id FK
        text source_url "imported from"
        text visibility "private|followers|public"
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }
    recipe_ingredients {
        text id PK
        text recipe_id FK
        text food_id "logical FK"
        text serving_id "logical FK"
        real servings
        real amount "base units"
        text name "snapshot"
        text note
        int position
    }
    saved_meals {
        text id PK
        text user_id FK
        text name
        text image_media_id FK
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }
    saved_meal_items {
        text id PK
        text saved_meal_id FK
        text food_id "logical FK"
        text serving_id "logical FK"
        real servings
        int position
    }
    meal_plans {
        text id PK
        text user_id FK
        text name
        date start_date
        int days
        bool is_active
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }
    meal_plan_entries {
        text id PK
        text meal_plan_id FK
        int day_index
        text meal_slot_id FK
        text food_id "logical FK"
        text serving_id "logical FK"
        real servings
    }
```

---

## 5. Training

Exercise types follow Hevy's model. The type controls which set fields apply:

| `exercise_type` | Fields used on a set |
|---|---|
| `weight_reps` | `weight_kg`, `reps` |
| `bodyweight_reps` / `reps_only` | `reps` |
| `weighted_bodyweight` | `weight_kg` (added), `reps` |
| `assisted_bodyweight` | `weight_kg` (assistance), `reps` |
| `duration` | `duration_s` |
| `distance_duration` | `distance_m`, `duration_s` |
| `weight_distance` | `weight_kg`, `distance_m` (e.g. farmer's carry) |

```mermaid
erDiagram
    muscle_groups ||--o{ exercise_muscles : "worked by"
    exercises ||--o{ exercise_muscles : "targets"
    users |o--o{ exercises : "creates custom"
    media_assets |o--o{ exercises : "demo for"
    users ||--o{ routine_folders : "organizes"
    routine_folders |o--o{ routines : "holds"
    users ||--o{ routines : "owns"
    routines |o--o{ routines : "copied from"
    routines ||--o{ routine_exercises : "contains"
    exercises ||--o{ routine_exercises : "planned as"
    routine_exercises ||--o{ routine_sets : "plans"
    users ||--o{ workouts : "performs"
    routines |o--o{ workouts : "template for"
    workouts ||--o{ workout_exercises : "contains"
    exercises ||--o{ workout_exercises : "performed as"
    workout_exercises ||--o{ workout_sets : "has"
    workouts ||--o{ workout_media : "has"
    media_assets ||--o{ workout_media : "attached as"
    users ||--o{ personal_records : "holds"
    exercises ||--o{ personal_records : "for"
    workout_sets ||--o{ personal_records : "set by"

    muscle_groups {
        text id PK
        text slug UK "chest, lats, quads"
        text name
        text region "upper|lower|core|full_body"
    }
    exercises {
        text id PK
        text owner_id FK "null = global library"
        text name
        text slug
        text exercise_type "see table above"
        text equipment "barbell|dumbbell|machine|cable|kettlebell|band|plate|bodyweight|other|none"
        bool is_unilateral
        text instructions
        text media_id FK "demo video or gif"
        real met "for calorie estimates"
        json aliases "search synonyms"
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }
    exercise_muscles {
        text exercise_id PK, FK
        text muscle_group_id PK, FK
        text role "primary|secondary"
    }
    routine_folders {
        text id PK
        text user_id FK
        text name
        int position
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }
    routines {
        text id PK
        text user_id FK
        text folder_id FK
        text name
        text notes
        int position
        text visibility "private|followers|public"
        text share_slug UK "public share link"
        text source_routine_id FK "copied from"
        int copy_count
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }
    routine_exercises {
        text id PK
        text routine_id FK
        text exercise_id FK
        int position
        int superset_group "same number = superset"
        int rest_seconds
        text notes
    }
    routine_sets {
        text id PK
        text routine_exercise_id FK
        int position
        text set_type "warmup|normal|failure|drop"
        real target_weight_kg
        int target_reps_min
        int target_reps_max
        int target_duration_s
        real target_distance_m
        real target_rpe
    }
    workouts {
        text id PK "client UUIDv7"
        text user_id FK
        text routine_id FK
        text title
        text description
        timestamp started_at
        timestamp ended_at
        int duration_s
        text visibility "private|followers|public"
        real total_volume_kg "derived"
        int total_sets "derived"
        int total_reps "derived"
        int est_kcal "derived from MET"
        int pr_count "derived"
        text source "app|import|healthkit"
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }
    workout_exercises {
        text id PK
        text workout_id FK
        text exercise_id FK
        int position
        int superset_group
        int rest_seconds
        text notes
    }
    workout_sets {
        text id PK
        text workout_exercise_id FK
        int position
        text set_type "warmup|normal|failure|drop"
        real weight_kg
        int reps
        int duration_s
        real distance_m
        real rpe
        timestamp completed_at
    }
    workout_media {
        text workout_id PK, FK
        text media_id PK, FK
        int position
    }
    personal_records {
        text id PK
        text user_id FK
        text exercise_id FK
        text record_type "max_weight|est_1rm|max_set_volume|max_reps|max_duration|max_distance|best_pace"
        real value
        text workout_id FK
        text workout_set_id FK
        bool is_current
        timestamp achieved_at
    }
```

---

## 6. Social

Visibility (`private | followers | public`) lives on workouts, routines, recipes, progress photos, and posts. Private accounts (`profiles.is_private`) require an accepted follow before any `followers` content is visible. A block hides content both ways and removes follows in both directions.

```mermaid
erDiagram
    users ||--o{ follows : "follower"
    users ||--o{ follows : "followee"
    users ||--o{ blocks : "blocker"
    users ||--o{ blocks : "blocked"
    users ||--o{ posts : "authors"
    workouts |o--o| posts : "shared as"
    posts ||--o{ post_media : "shows"
    media_assets ||--o{ post_media : "attached as"
    posts ||--o{ likes : "receives"
    users ||--o{ likes : "gives"
    posts ||--o{ comments : "has"
    users ||--o{ comments : "writes"
    comments |o--o{ comments : "replies to"
    comments ||--o{ comment_likes : "receives"
    users ||--o{ comment_likes : "gives"
    users ||--o{ mentions : "mentioned in"
    posts |o--o{ mentions : "contains"
    comments |o--o{ mentions : "contains"
    users ||--o{ feed_entries : "reads"
    posts ||--o{ feed_entries : "fanned out to"
    users ||--o{ notifications : "receives"
    users |o--o{ notifications : "triggers"
    users ||--o{ reports : "files"

    follows {
        text follower_id PK, FK
        text followee_id PK, FK
        text status "accepted|pending"
        timestamp created_at
        timestamp accepted_at
    }
    blocks {
        text blocker_id PK, FK
        text blocked_id PK, FK
        timestamp created_at
    }
    posts {
        text id PK
        text user_id FK
        text type "workout|meal|day|progress|milestone|text"
        text workout_id FK, UK "type = workout"
        date diary_date "type = meal or day"
        text body "caption"
        json meta "snapshot for milestones, e.g. PR values"
        text visibility "followers|public"
        int like_count
        int comment_count
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }
    post_media {
        text post_id PK, FK
        text media_id PK, FK
        int position
    }
    likes {
        text user_id PK, FK
        text post_id PK, FK
        timestamp created_at
    }
    comments {
        text id PK
        text post_id FK
        text user_id FK
        text parent_id FK "reply thread"
        text body
        int like_count
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }
    comment_likes {
        text user_id PK, FK
        text comment_id PK, FK
        timestamp created_at
    }
    mentions {
        text id PK
        text mentioned_user_id FK
        text post_id FK
        text comment_id FK
        timestamp created_at
    }
    feed_entries {
        text owner_id PK, FK "whose feed"
        text post_id PK, FK
        text author_id FK
        timestamp created_at "copied from post, sort key"
    }
    notifications {
        text id PK
        text user_id FK "recipient"
        text actor_id FK
        text type "like|comment|reply|mention|follow|follow_request|follow_accepted|pr|achievement|challenge|streak|system"
        text post_id FK
        text comment_id FK
        json data
        timestamp read_at
        timestamp created_at
    }
    reports {
        text id PK
        text reporter_id FK
        text target_type "post|comment|user|food|exercise|recipe"
        text target_id
        text reason "spam|harassment|nudity|misinformation|unsafe_diet|other"
        text details
        text status "open|actioned|dismissed"
        text resolved_by FK
        timestamp created_at
        timestamp resolved_at
    }
```

---

## 7. Gamification

```mermaid
erDiagram
    achievements ||--o{ user_achievements : "earned as"
    users ||--o{ user_achievements : "earns"
    users ||--o{ streaks : "maintains"
    users ||--o{ challenges : "creates"
    challenges ||--o{ challenge_participants : "has"
    users ||--o{ challenge_participants : "joins"

    achievements {
        text id PK
        text key UK "first_workout, 100_workouts, 30_day_diary"
        text name
        text description
        text icon
        text category "training|nutrition|social|consistency"
        real threshold
    }
    user_achievements {
        text user_id PK, FK
        text achievement_id PK, FK
        timestamp earned_at
    }
    streaks {
        text user_id PK, FK
        text type PK "diary|workout|water|protein"
        int current
        int longest
        date last_date
        timestamp updated_at
    }
    challenges {
        text id PK
        text creator_id FK
        text name
        text description
        text metric "workout_count|volume_kg|active_days|diary_days|protein_goal_days|steps"
        real target
        date starts_on
        date ends_on
        text visibility "invite|followers|public"
        int participant_count
        timestamp created_at
    }
    challenge_participants {
        text challenge_id PK, FK
        text user_id PK, FK
        real progress
        int rank
        timestamp joined_at
        timestamp completed_at
    }
```

---

## Indexes

Beyond primary keys and unique constraints:

| Table | Index | Serves |
|---|---|---|
| `diary_entries` | `(user_id, date) WHERE deleted_at IS NULL` | Diary day view |
| `diary_entries` | `(user_id, food_id, logged_at DESC)` | Recent and frequent foods |
| `diary_entries`, `workouts`, `routines`, `body_measurements`, `water_logs` | `(user_id, updated_at)` | Mobile sync pull |
| `nutrition_goals` | `(user_id, effective_from DESC)` | Goal in effect for a date |
| `body_measurements` | `(user_id, type, measured_at DESC)` | Weight and measurement charts |
| `workouts` | `(user_id, started_at DESC)` | History, calendar |
| `workout_exercises` | `(workout_id, position)`, `(exercise_id)` | Workout detail, per-exercise history |
| `personal_records` | `(user_id, exercise_id, record_type) WHERE is_current = 1` | PR detection |
| `exercise_muscles` | `(muscle_group_id)` | Filter the library by muscle |
| `follows` | `(followee_id, status)` | Followers list, fan-out targets |
| `feed_entries` | `(owner_id, created_at DESC)` | Home feed |
| `posts` | `(user_id, created_at DESC)`, `(visibility, created_at DESC)` | Profile, discover feed |
| `comments` | `(post_id, created_at)` | Comment threads |
| `notifications` | `(user_id, created_at DESC)`, `(user_id) WHERE read_at IS NULL` | Inbox, unread badge |
| `foods` | `(owner_id)`, `(source, source_ref)` | My foods, import upserts |
| `foods_fts` | FTS5 on `name`, `brand` | Keyword food search |
| `profiles` | FTS5 on `users.username`, `display_name` | User search |

## Data that does not live in D1

| Data | Where | Why |
|---|---|---|
| In-progress workout state | Durable Object `LiveWorkout` (its own SQLite storage) | Strongly consistent across phone, web, and watch. Survives app crashes. Persisted to D1 when the workout finishes. |
| Realtime connections, unread counters | Durable Object `UserHub` | Hibernating WebSockets, one per user |
| Challenge leaderboards (live) | Durable Object `ChallengeRoom` | Ordered in-memory ranking, written back to D1 periodically |
| Photos, videos, exports, OpenNext cache | R2 (Stream for video) | Object storage, zero egress |
| Food and exercise embeddings | Vectorize | Semantic search, AI logging matches |
| Barcode cache, public profile cache, flags | KV | Hot, read-heavy, tolerates eventual consistency |
| Product analytics events | Workers Analytics Engine | High-volume, time series |

## Scaling path

D1 gives each database a single primary writer and a 10 GB size limit (on the paid plan). The schema is built so that splitting later is mechanical:

1. **Now:** `core` + `catalog`, with read replication on `core` through the Sessions API.
2. **Feed and notifications grow:** move `feed_entries` and `notifications` into a third D1 database (`social`). Both are append-heavy and only ever queried by `owner_id`/`user_id`.
3. **Write volume outgrows one primary:** shard user-owned tables by `user_id` across N D1 databases, with a routing map in KV. Every user-owned table already leads with `user_id`, so no query crosses shards except social reads, which go through `feed_entries`.
4. **Alternative:** give each user a Durable Object with SQLite storage for diary and training data. Cross-user data (social, catalog, leaderboards) stays in D1.
