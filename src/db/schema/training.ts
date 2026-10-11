import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { bool, createdAt, deletedAt, pk, ts, updatedAt } from "./_helpers";

export const EXERCISE_TYPES = [
  "weight_reps", "bodyweight_reps", "weighted_bodyweight", "assisted_bodyweight",
  "duration", "distance_duration", "weight_distance", "reps_only",
] as const;
export const EQUIPMENT = [
  "barbell", "dumbbell", "machine", "cable", "kettlebell", "band", "plate", "bodyweight", "other", "none",
] as const;
export const SET_TYPES = ["warmup", "normal", "failure", "drop"] as const;
export const VISIBILITY = ["private", "followers", "public"] as const;

export const muscleGroups = sqliteTable("muscle_groups", {
  id: pk(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  region: text("region", { enum: ["upper", "lower", "core", "full_body"] }).notNull(),
});

export const exercises = sqliteTable(
  "exercises",
  {
    id: pk(),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "cascade" }), // null = global library
    name: text("name").notNull(),
    slug: text("slug"),
    exerciseType: text("exercise_type", { enum: EXERCISE_TYPES }).notNull().default("weight_reps"),
    equipment: text("equipment", { enum: EQUIPMENT }).notNull().default("none"),
    isUnilateral: bool("is_unilateral").notNull().default(false),
    instructions: text("instructions"),
    met: real("met"), // for calorie estimates
    aliases: text("aliases", { mode: "json" }).$type<string[]>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("exercises_name_idx").on(t.name), index("exercises_owner_idx").on(t.ownerId)],
);

export const exerciseMuscles = sqliteTable(
  "exercise_muscles",
  {
    exerciseId: text("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
    muscleGroupId: text("muscle_group_id").notNull().references(() => muscleGroups.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["primary", "secondary"] }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.exerciseId, t.muscleGroupId] }), index("exercise_muscles_muscle_idx").on(t.muscleGroupId)],
);

export const routineFolders = sqliteTable("routine_folders", {
  id: pk(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: deletedAt(),
});

export const routines = sqliteTable(
  "routines",
  {
    id: pk(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    folderId: text("folder_id").references(() => routineFolders.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    notes: text("notes"),
    position: integer("position").notNull().default(0),
    visibility: text("visibility", { enum: VISIBILITY }).notNull().default("private"),
    shareSlug: text("share_slug").unique(),
    sourceRoutineId: text("source_routine_id"),
    copyCount: integer("copy_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("routines_user_idx").on(t.userId)],
);

export const routineExercises = sqliteTable(
  "routine_exercises",
  {
    id: pk(),
    routineId: text("routine_id").notNull().references(() => routines.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id").notNull().references(() => exercises.id),
    position: integer("position").notNull(),
    supersetGroup: integer("superset_group"),
    restSeconds: integer("rest_seconds"),
    notes: text("notes"),
  },
  (t) => [index("routine_exercises_routine_idx").on(t.routineId, t.position)],
);

export const routineSets = sqliteTable(
  "routine_sets",
  {
    id: pk(),
    routineExerciseId: text("routine_exercise_id").notNull().references(() => routineExercises.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    setType: text("set_type", { enum: SET_TYPES }).notNull().default("normal"),
    targetWeightKg: real("target_weight_kg"),
    targetRepsMin: integer("target_reps_min"),
    targetRepsMax: integer("target_reps_max"),
    targetDurationS: integer("target_duration_s"),
    targetDistanceM: real("target_distance_m"),
    targetRpe: real("target_rpe"),
  },
  (t) => [index("routine_sets_exercise_idx").on(t.routineExerciseId, t.position)],
);

export const workouts = sqliteTable(
  "workouts",
  {
    id: pk(), // client-generated UUIDv7 so a retried save is a no-op
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    routineId: text("routine_id").references(() => routines.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    startedAt: ts("started_at").notNull(),
    endedAt: ts("ended_at").notNull(),
    durationS: integer("duration_s").notNull(),
    visibility: text("visibility", { enum: VISIBILITY }).notNull().default("followers"),
    // Derived on save and recomputed on edit
    totalVolumeKg: real("total_volume_kg").notNull().default(0),
    totalSets: integer("total_sets").notNull().default(0),
    totalReps: integer("total_reps").notNull().default(0),
    prCount: integer("pr_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("workouts_user_started_idx").on(t.userId, t.startedAt)],
);

export const workoutExercises = sqliteTable(
  "workout_exercises",
  {
    id: pk(),
    workoutId: text("workout_id").notNull().references(() => workouts.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id").notNull().references(() => exercises.id),
    position: integer("position").notNull(),
    supersetGroup: integer("superset_group"),
    restSeconds: integer("rest_seconds"),
    notes: text("notes"),
  },
  (t) => [index("workout_exercises_workout_idx").on(t.workoutId, t.position), index("workout_exercises_exercise_idx").on(t.exerciseId)],
);

export const workoutSets = sqliteTable(
  "workout_sets",
  {
    id: pk(),
    workoutExerciseId: text("workout_exercise_id").notNull().references(() => workoutExercises.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    setType: text("set_type", { enum: SET_TYPES }).notNull().default("normal"),
    weightKg: real("weight_kg"),
    reps: integer("reps"),
    durationS: integer("duration_s"),
    distanceM: real("distance_m"),
    rpe: real("rpe"),
    completedAt: ts("completed_at"),
  },
  (t) => [index("workout_sets_exercise_idx").on(t.workoutExerciseId, t.position)],
);

export const PR_TYPES = ["max_weight", "est_1rm", "max_set_volume", "max_reps", "max_duration", "max_distance"] as const;

export const personalRecords = sqliteTable(
  "personal_records",
  {
    id: pk(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
    recordType: text("record_type", { enum: PR_TYPES }).notNull(),
    value: real("value").notNull(),
    workoutId: text("workout_id").notNull().references(() => workouts.id, { onDelete: "cascade" }),
    // The first workout with an exercise sets the baseline; it is stored but not celebrated as a PR.
    isBaseline: bool("is_baseline").notNull().default(false),
    achievedAt: ts("achieved_at").notNull(),
  },
  (t) => [index("personal_records_lookup_idx").on(t.userId, t.exerciseId, t.recordType)],
);
