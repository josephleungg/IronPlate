import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { bool, createdAt, deletedAt, pk, ts, updatedAt } from "./_helpers";

export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  avatarMediaId: text("avatar_media_id"),
  isPrivate: bool("is_private").notNull().default(false),
  followersCount: integer("followers_count").notNull().default(0),
  followingCount: integer("following_count").notNull().default(0),
  workoutsCount: integer("workouts_count").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  sex: text("sex", { enum: ["male", "female", "unspecified"] }).notNull().default("unspecified"),
  birthDate: text("birth_date"), // YYYY-MM-DD
  heightCm: real("height_cm"),
  activityLevel: text("activity_level", {
    enum: ["sedentary", "light", "moderate", "active", "very_active"],
  }).notNull().default("light"),
  weightUnit: text("weight_unit", { enum: ["kg", "lb"] }).notNull().default("kg"),
  distanceUnit: text("distance_unit", { enum: ["km", "mi"] }).notNull().default("km"),
  // Unit for lifting weights only. null = follow weightUnit. Body weight always follows weightUnit.
  liftUnit: text("lift_unit", { enum: ["kg", "lb"] }),
  timezone: text("timezone").notNull().default("UTC"),
  weekStart: integer("week_start").notNull().default(1),
  diaryVisibility: text("diary_visibility", { enum: ["private", "followers", "public"] }).notNull().default("private"),
  defaultWorkoutVisibility: text("default_workout_visibility", {
    enum: ["private", "followers", "public"],
  }).notNull().default("followers"),
  onboardingCompletedAt: ts("onboarding_completed_at"),
  updatedAt: updatedAt(),
});

export const nutritionGoals = sqliteTable(
  "nutrition_goals",
  {
    id: pk(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    effectiveFrom: text("effective_from").notNull(), // YYYY-MM-DD; goals are versioned so history stays accurate
    calories: integer("calories").notNull(),
    proteinG: real("protein_g").notNull(),
    carbsG: real("carbs_g").notNull(),
    fatG: real("fat_g").notNull(),
    fiberG: real("fiber_g"),
    waterMl: integer("water_ml"),
    createdAt: createdAt(),
  },
  (t) => [index("nutrition_goals_user_from_idx").on(t.userId, t.effectiveFrom)],
);

export const weightGoals = sqliteTable("weight_goals", {
  id: pk(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  goalType: text("goal_type", { enum: ["lose", "maintain", "gain"] }).notNull(),
  startWeightKg: real("start_weight_kg").notNull(),
  targetWeightKg: real("target_weight_kg").notNull(),
  weeklyRateKg: real("weekly_rate_kg").notNull().default(0.5),
  startDate: text("start_date").notNull(),
  isActive: bool("is_active").notNull().default(true),
  createdAt: createdAt(),
});

export const MEASUREMENT_TYPES = [
  "weight", "body_fat", "waist", "chest", "hips", "neck", "shoulders",
  "bicep_l", "bicep_r", "forearm_l", "forearm_r", "thigh_l", "thigh_r", "calf_l", "calf_r",
] as const;

export const bodyMeasurements = sqliteTable(
  "body_measurements",
  {
    id: pk(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    type: text("type", { enum: MEASUREMENT_TYPES }).notNull(),
    value: real("value").notNull(), // kg, percent, or cm
    measuredAt: ts("measured_at").notNull(),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("body_measurements_user_type_idx").on(t.userId, t.type, t.measuredAt)],
);
