import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { bool, createdAt, deletedAt, pk, ts, updatedAt } from "./_helpers";

export const foods = sqliteTable(
  "foods",
  {
    id: pk(),
    source: text("source", { enum: ["seed", "usda", "off", "user"] }).notNull(),
    sourceRef: text("source_ref"),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    brand: text("brand"),
    baseUnit: text("base_unit", { enum: ["g", "ml"] }).notNull().default("g"),
    visibility: text("visibility", { enum: ["public", "private"] }).notNull().default("public"),
    isVerified: bool("is_verified").notNull().default(false),
    // nutrients per 100 g / 100 ml
    kcal100: real("kcal_100").notNull(),
    protein100: real("protein_100").notNull().default(0),
    carbs100: real("carbs_100").notNull().default(0),
    fat100: real("fat_100").notNull().default(0),
    fiber100: real("fiber_100"),
    sugar100: real("sugar_100"),
    satFat100: real("sat_fat_100"),
    sodiumMg100: real("sodium_mg_100"),
    popularity: integer("popularity").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("foods_name_idx").on(t.name),
    index("foods_owner_idx").on(t.ownerId),
    uniqueIndex("foods_source_ref_idx").on(t.source, t.sourceRef),
  ],
);

export const foodServings = sqliteTable(
  "food_servings",
  {
    id: pk(),
    foodId: text("food_id").notNull().references(() => foods.id, { onDelete: "cascade" }),
    label: text("label").notNull(), // "1 cup", "1 slice"
    amount: real("amount").notNull(), // in base units (g or ml)
    isDefault: bool("is_default").notNull().default(false),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("food_servings_food_idx").on(t.foodId)],
);

export const foodBarcodes = sqliteTable("food_barcodes", {
  barcode: text("barcode").primaryKey(),
  foodId: text("food_id").notNull().references(() => foods.id, { onDelete: "cascade" }),
});

export const mealSlots = sqliteTable(
  "meal_slots",
  {
    id: pk(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    isArchived: bool("is_archived").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("meal_slots_user_idx").on(t.userId)],
);

export const diaryDays = sqliteTable(
  "diary_days",
  {
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    notes: text("notes"),
    completedAt: ts("completed_at"),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

export const ENTRY_SOURCES = ["search", "barcode", "recent", "copy", "quick_add", "ai_text"] as const;

export const diaryEntries = sqliteTable(
  "diary_entries",
  {
    id: pk(), // client may supply a UUIDv7 so retries are idempotent
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    mealSlotId: text("meal_slot_id").notNull().references(() => mealSlots.id),
    foodId: text("food_id").references(() => foods.id, { onDelete: "set null" }), // null for quick add
    servingId: text("serving_id"),
    servings: real("servings").notNull().default(1),
    amount: real("amount"), // base units consumed
    // Snapshot of the food at the time of logging, so edits to a food never rewrite history.
    name: text("name").notNull(),
    brand: text("brand"),
    kcal: real("kcal").notNull(),
    proteinG: real("protein_g").notNull().default(0),
    carbsG: real("carbs_g").notNull().default(0),
    fatG: real("fat_g").notNull().default(0),
    fiberG: real("fiber_g"),
    sugarG: real("sugar_g"),
    sodiumMg: real("sodium_mg"),
    source: text("source", { enum: ENTRY_SOURCES }).notNull().default("search"),
    position: integer("position").notNull().default(0),
    loggedAt: ts("logged_at").notNull().$defaultFn(() => new Date()),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("diary_entries_user_date_idx").on(t.userId, t.date),
    index("diary_entries_user_food_idx").on(t.userId, t.foodId, t.loggedAt),
  ],
);

export const waterLogs = sqliteTable(
  "water_logs",
  {
    id: pk(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    amountMl: integer("amount_ml").notNull(),
    loggedAt: ts("logged_at").notNull().$defaultFn(() => new Date()),
    deletedAt: deletedAt(),
  },
  (t) => [index("water_logs_user_date_idx").on(t.userId, t.date)],
);
