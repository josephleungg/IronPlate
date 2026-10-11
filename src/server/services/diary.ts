import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/driver";
import {
  bodyMeasurements, diaryDays, diaryEntries, foodServings, foods, mealSlots, nutritionGoals, userSettings, waterLogs, workouts,
} from "@/db/schema";
import { addDays, dayRangeUtc, localDate } from "@/lib/domain/dates";
import { kcalFromMet, nutrientsForAmount, sumNutrients } from "@/lib/domain/nutrition";
import { uuidv7 } from "@/lib/id";
import { badRequest, notFound, zDate, zId } from "../http";

export const entryInput = z.object({
  id: zId.optional(),
  mealSlotId: zId,
  foodId: zId,
  servingId: zId.optional(),
  servings: z.number().positive().max(1000).default(1),
  source: z.enum(["search", "barcode", "recent", "copy", "ai_text"]).default("search"),
});
export const quickAddInput = z.object({
  mealSlotId: zId,
  name: z.string().trim().max(80).default("Quick add"),
  kcal: z.number().min(0).max(10000),
  proteinG: z.number().min(0).max(1000).default(0),
  carbsG: z.number().min(0).max(1000).default(0),
  fatG: z.number().min(0).max(1000).default(0),
});
export const entryPatch = z.object({
  servings: z.number().positive().max(1000).optional(),
  servingId: zId.optional(),
  mealSlotId: zId.optional(),
  date: zDate.optional(),
  kcal: z.number().min(0).max(10000).optional(),
  proteinG: z.number().min(0).optional(),
  carbsG: z.number().min(0).optional(),
  fatG: z.number().min(0).optional(),
});

const STRENGTH_MET = 4.0; // general resistance training; refined per exercise later

export async function getUserTimezone(userId: string): Promise<string> {
  const [s] = await db.select({ tz: userSettings.timezone }).from(userSettings).where(eq(userSettings.userId, userId));
  return s?.tz ?? "UTC";
}

export async function goalForDate(userId: string, date: string) {
  const [g] = await db
    .select()
    .from(nutritionGoals)
    .where(and(eq(nutritionGoals.userId, userId), lte(nutritionGoals.effectiveFrom, date)))
    .orderBy(desc(nutritionGoals.effectiveFrom), desc(nutritionGoals.createdAt))
    .limit(1);
  return g ?? null;
}

async function assertSlot(userId: string, mealSlotId: string) {
  const [s] = await db.select({ id: mealSlots.id }).from(mealSlots).where(and(eq(mealSlots.id, mealSlotId), eq(mealSlots.userId, userId)));
  if (!s) throw badRequest("Unknown meal", "UNKNOWN_MEAL_SLOT");
}

export async function listMealSlots(userId: string) {
  return db.select().from(mealSlots).where(and(eq(mealSlots.userId, userId), eq(mealSlots.isArchived, false))).orderBy(asc(mealSlots.position));
}

export async function getDay(userId: string, date: string) {
  const tz = await getUserTimezone(userId);
  const [start, end] = dayRangeUtc(date, tz);
  const [slots, entries, goal, water, day, dayWorkouts, weight] = await Promise.all([
    listMealSlots(userId),
    db.select().from(diaryEntries).where(and(eq(diaryEntries.userId, userId), eq(diaryEntries.date, date), isNull(diaryEntries.deletedAt))).orderBy(asc(diaryEntries.position), asc(diaryEntries.loggedAt)),
    goalForDate(userId, date),
    db.select().from(waterLogs).where(and(eq(waterLogs.userId, userId), eq(waterLogs.date, date), isNull(waterLogs.deletedAt))).orderBy(asc(waterLogs.loggedAt)),
    db.select().from(diaryDays).where(and(eq(diaryDays.userId, userId), eq(diaryDays.date, date))),
    db.select({ durationS: workouts.durationS }).from(workouts).where(and(eq(workouts.userId, userId), isNull(workouts.deletedAt), gte(workouts.startedAt, new Date(start)), lte(workouts.startedAt, new Date(end - 1)))),
    db.select({ value: bodyMeasurements.value }).from(bodyMeasurements).where(and(eq(bodyMeasurements.userId, userId), eq(bodyMeasurements.type, "weight"), isNull(bodyMeasurements.deletedAt))).orderBy(desc(bodyMeasurements.measuredAt)).limit(1),
  ]);

  const weightKg = weight[0]?.value ?? 70;
  const exerciseKcal = dayWorkouts.reduce((a, w) => a + kcalFromMet(STRENGTH_MET, weightKg, w.durationS / 60), 0);
  const meals = slots.map((s) => {
    const items = entries.filter((e) => e.mealSlotId === s.id);
    return { slot: s, entries: items, totals: sumNutrients(items) };
  });
  return {
    date,
    meals,
    totals: sumNutrients(entries),
    goal,
    water: { totalMl: water.reduce((a, w) => a + w.amountMl, 0), goalMl: goal?.waterMl ?? 2500, logs: water },
    exerciseKcal,
    workoutCount: dayWorkouts.length,
    notes: day[0]?.notes ?? null,
    completedAt: day[0]?.completedAt ?? null,
  };
}

export async function getRange(userId: string, from: string, to: string) {
  if (from > to) throw badRequest("`from` must be on or before `to`");
  const rows = await db
    .select({
      date: diaryEntries.date,
      kcal: sql<number>`sum(${diaryEntries.kcal})`,
      proteinG: sql<number>`sum(${diaryEntries.proteinG})`,
      carbsG: sql<number>`sum(${diaryEntries.carbsG})`,
      fatG: sql<number>`sum(${diaryEntries.fatG})`,
    })
    .from(diaryEntries)
    .where(and(eq(diaryEntries.userId, userId), isNull(diaryEntries.deletedAt), gte(diaryEntries.date, from), lte(diaryEntries.date, to)))
    .groupBy(diaryEntries.date)
    .orderBy(asc(diaryEntries.date));
  return rows.map((r) => ({ ...r, kcal: Math.round(r.kcal), proteinG: Math.round(r.proteinG), carbsG: Math.round(r.carbsG), fatG: Math.round(r.fatG) }));
}

async function nextPosition(userId: string, date: string, mealSlotId: string) {
  const [r] = await db
    .select({ n: sql<number>`coalesce(max(${diaryEntries.position}), -1) + 1` })
    .from(diaryEntries)
    .where(and(eq(diaryEntries.userId, userId), eq(diaryEntries.date, date), eq(diaryEntries.mealSlotId, mealSlotId)));
  return r?.n ?? 0;
}

async function snapshot(viewerId: string, foodId: string, servingId: string | undefined, servings: number) {
  const [food] = await db.select().from(foods).where(and(eq(foods.id, foodId), isNull(foods.deletedAt)));
  if (!food || (food.visibility === "private" && food.ownerId !== viewerId)) throw notFound("Food");
  const all = await db.select().from(foodServings).where(eq(foodServings.foodId, foodId)).orderBy(asc(foodServings.position));
  const serving = (servingId ? all.find((s) => s.id === servingId) : undefined) ?? all.find((s) => s.isDefault) ?? all[0];
  if (servingId && serving?.id !== servingId) throw badRequest("That serving doesn't belong to this food", "UNKNOWN_SERVING");
  const amount = (serving?.amount ?? 100) * servings;
  return { food, serving, amount, n: nutrientsForAmount(food, amount) };
}

export async function addEntry(userId: string, date: string, input: z.infer<typeof entryInput>) {
  await assertSlot(userId, input.mealSlotId);
  const id = input.id ?? uuidv7();
  const [existing] = await db.select().from(diaryEntries).where(eq(diaryEntries.id, id));
  if (existing) {
    if (existing.userId !== userId) throw badRequest("ID already in use", "ID_CONFLICT");
    return existing; // retried create: idempotent
  }
  const { food, serving, amount, n } = await snapshot(userId, input.foodId, input.servingId, input.servings);
  const position = await nextPosition(userId, date, input.mealSlotId);
  await db.batch([
    db.insert(diaryEntries).values({
      id, userId, date, mealSlotId: input.mealSlotId, foodId: food.id, servingId: serving?.id ?? null, servings: input.servings, amount,
      name: food.name, brand: food.brand, kcal: n.kcal, proteinG: n.proteinG, carbsG: n.carbsG, fatG: n.fatG,
      fiberG: n.fiberG, sugarG: n.sugarG, sodiumMg: n.sodiumMg, source: input.source, position,
    }),
    db.update(foods).set({ popularity: sql`${foods.popularity} + 1` }).where(eq(foods.id, food.id)),
  ]);
  const [row] = await db.select().from(diaryEntries).where(eq(diaryEntries.id, id));
  return row;
}

export async function quickAdd(userId: string, date: string, input: z.infer<typeof quickAddInput>) {
  await assertSlot(userId, input.mealSlotId);
  const id = uuidv7();
  await db.insert(diaryEntries).values({
    id, userId, date, mealSlotId: input.mealSlotId, name: input.name, kcal: input.kcal, proteinG: input.proteinG,
    carbsG: input.carbsG, fatG: input.fatG, source: "quick_add", position: await nextPosition(userId, date, input.mealSlotId),
  });
  const [row] = await db.select().from(diaryEntries).where(eq(diaryEntries.id, id));
  return row;
}

export async function updateEntry(userId: string, id: string, patch: z.infer<typeof entryPatch>) {
  const [row] = await db.select().from(diaryEntries).where(and(eq(diaryEntries.id, id), eq(diaryEntries.userId, userId), isNull(diaryEntries.deletedAt)));
  if (!row) throw notFound("Entry");
  const set: Partial<typeof diaryEntries.$inferInsert> = {};
  if (patch.mealSlotId) {
    await assertSlot(userId, patch.mealSlotId);
    set.mealSlotId = patch.mealSlotId;
  }
  if (patch.date) set.date = patch.date;
  if (row.foodId && (patch.servings !== undefined || patch.servingId)) {
    const { serving, amount, n } = await snapshot(userId, row.foodId, patch.servingId ?? row.servingId ?? undefined, patch.servings ?? row.servings);
    Object.assign(set, {
      servings: patch.servings ?? row.servings, servingId: serving?.id ?? null, amount,
      kcal: n.kcal, proteinG: n.proteinG, carbsG: n.carbsG, fatG: n.fatG, fiberG: n.fiberG, sugarG: n.sugarG, sodiumMg: n.sodiumMg,
    });
  } else if (!row.foodId) {
    if (patch.kcal !== undefined) set.kcal = patch.kcal;
    if (patch.proteinG !== undefined) set.proteinG = patch.proteinG;
    if (patch.carbsG !== undefined) set.carbsG = patch.carbsG;
    if (patch.fatG !== undefined) set.fatG = patch.fatG;
  }
  if (Object.keys(set).length) await db.update(diaryEntries).set(set).where(eq(diaryEntries.id, id));
  const [out] = await db.select().from(diaryEntries).where(eq(diaryEntries.id, id));
  return out;
}

export async function deleteEntry(userId: string, id: string) {
  const [row] = await db.select({ id: diaryEntries.id }).from(diaryEntries).where(and(eq(diaryEntries.id, id), eq(diaryEntries.userId, userId), isNull(diaryEntries.deletedAt)));
  if (!row) throw notFound("Entry");
  await db.update(diaryEntries).set({ deletedAt: new Date() }).where(eq(diaryEntries.id, id));
}

/** Copy a meal (or the whole day) from another date. Copies the stored snapshot, so it's exact. */
export async function copyEntries(userId: string, toDate: string, input: { fromDate: string; fromMealSlotId?: string; toMealSlotId?: string }) {
  if (input.fromDate === toDate && !input.toMealSlotId) throw badRequest("Pick a different date or meal to copy into");
  if (input.toMealSlotId) await assertSlot(userId, input.toMealSlotId);
  const src = await db
    .select()
    .from(diaryEntries)
    .where(and(eq(diaryEntries.userId, userId), eq(diaryEntries.date, input.fromDate), isNull(diaryEntries.deletedAt), input.fromMealSlotId ? eq(diaryEntries.mealSlotId, input.fromMealSlotId) : undefined))
    .orderBy(asc(diaryEntries.position));
  if (!src.length) return { copied: 0 };
  const positions = new Map<string, number>();
  const stmts: any[] = [];
  for (const e of src) {
    const slot = input.toMealSlotId ?? e.mealSlotId;
    if (!positions.has(slot)) positions.set(slot, await nextPosition(userId, toDate, slot));
    const pos = positions.get(slot)!;
    positions.set(slot, pos + 1);
    const { id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, ...rest } = e;
    stmts.push(db.insert(diaryEntries).values({ ...rest, id: uuidv7(), date: toDate, mealSlotId: slot, source: "copy", position: pos, loggedAt: new Date() }));
  }
  await db.batch(stmts as [any, ...any[]]);
  return { copied: src.length };
}

export async function setNotes(userId: string, date: string, notes: string | null) {
  await db.insert(diaryDays).values({ userId, date, notes }).onConflictDoUpdate({ target: [diaryDays.userId, diaryDays.date], set: { notes, updatedAt: new Date() } });
}

export async function setCompleted(userId: string, date: string, completed: boolean) {
  const completedAt = completed ? new Date() : null;
  await db.insert(diaryDays).values({ userId, date, completedAt }).onConflictDoUpdate({ target: [diaryDays.userId, diaryDays.date], set: { completedAt, updatedAt: new Date() } });
  return { completedAt };
}

export async function addWater(userId: string, date: string, amountMl: number) {
  const id = uuidv7();
  await db.insert(waterLogs).values({ id, userId, date, amountMl });
  return { id, amountMl };
}

export async function deleteWater(userId: string, id: string) {
  const res = await db.update(waterLogs).set({ deletedAt: new Date() }).where(and(eq(waterLogs.id, id), eq(waterLogs.userId, userId), isNull(waterLogs.deletedAt))).returning({ id: waterLogs.id });
  if (!res.length) throw notFound("Water log");
}

/** Consecutive days (ending today or yesterday) with at least one diary entry. */
export async function diaryStreak(userId: string, tz: string): Promise<number> {
  const today = localDate(tz);
  const rows = await db
    .selectDistinct({ date: diaryEntries.date })
    .from(diaryEntries)
    .where(and(eq(diaryEntries.userId, userId), isNull(diaryEntries.deletedAt), gte(diaryEntries.date, addDays(today, -400))))
    .orderBy(desc(diaryEntries.date));
  const have = new Set(rows.map((r) => r.date));
  let cursor = have.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (have.has(cursor)) {
    n += 1;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export { inArray };
