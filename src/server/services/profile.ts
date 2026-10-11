import { and, asc, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/driver";
import { bodyMeasurements, MEASUREMENT_TYPES, nutritionGoals, profiles, user, userSettings, weightGoals } from "@/db/schema";
import { ageFromBirthDate, localDate } from "@/lib/domain/dates";
import { recommendGoals } from "@/lib/domain/nutrition";
import { toKg } from "@/lib/domain/units";
import { badRequest, notFound, zDate } from "../http";
import { goalForDate } from "./diary";

export const settingsPatch = z.object({
  sex: z.enum(["male", "female", "unspecified"]).optional(),
  birthDate: zDate.nullable().optional(),
  heightCm: z.number().min(50).max(260).nullable().optional(),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).optional(),
  weightUnit: z.enum(["kg", "lb"]).optional(),
  distanceUnit: z.enum(["km", "mi"]).optional(),
  liftUnit: z.enum(["kg", "lb"]).nullable().optional(),
  timezone: z.string().max(64).refine((tz) => { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; } }, "Unknown timezone").optional(),
  weekStart: z.union([z.literal(0), z.literal(1)]).optional(),
  diaryVisibility: z.enum(["private", "followers", "public"]).optional(),
  defaultWorkoutVisibility: z.enum(["private", "followers", "public"]).optional(),
});

export const profilePatch = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  bio: z.string().trim().max(280).nullable().optional(),
  isPrivate: z.boolean().optional(),
  avatarMediaId: z.string().nullable().optional(),
});

export const goalInput = z.object({
  calories: z.number().int().min(800).max(10000),
  proteinG: z.number().min(0).max(1000),
  carbsG: z.number().min(0).max(2000),
  fatG: z.number().min(0).max(1000),
  fiberG: z.number().min(0).max(200).optional(),
  waterMl: z.number().int().min(0).max(10000).optional(),
  effectiveFrom: zDate.optional(),
});

export const onboardingInput = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  sex: z.enum(["male", "female", "unspecified"]),
  birthDate: zDate,
  heightCm: z.number().min(50).max(260),
  weightKg: z.number().min(20).max(500),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  goal: z.enum(["lose", "maintain", "gain"]),
  weeklyRateKg: z.number().min(0).max(1.5).default(0.5),
  targetWeightKg: z.number().min(20).max(500).optional(),
  weightUnit: z.enum(["kg", "lb"]).default("kg"),
  distanceUnit: z.enum(["km", "mi"]).default("km"),
  timezone: z.string().max(64).default("UTC"),
});

export const calculateInput = z.object({
  sex: z.enum(["male", "female", "unspecified"]),
  birthDate: zDate,
  heightCm: z.number().min(50).max(260),
  weightKg: z.number().min(20).max(500),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  goal: z.enum(["lose", "maintain", "gain"]),
  weeklyRateKg: z.number().min(0).max(1.5).default(0.5),
  timezone: z.string().default("UTC"),
});

export function calculateGoals(i: z.infer<typeof calculateInput>) {
  const age = ageFromBirthDate(i.birthDate, localDate(i.timezone));
  if (age < 13 || age > 120) throw badRequest("Age must be between 13 and 120", "INVALID_AGE");
  return recommendGoals({ sex: i.sex, weightKg: i.weightKg, heightCm: i.heightCm, age, activity: i.activityLevel, goal: i.goal, weeklyRateKg: i.weeklyRateKg });
}

export async function getMe(viewer: { id: string; email: string; username: string | null; role: string | null }) {
  const [[profile], [settings], weight] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, viewer.id)),
    db.select().from(userSettings).where(eq(userSettings.userId, viewer.id)),
    db.select().from(bodyMeasurements).where(and(eq(bodyMeasurements.userId, viewer.id), eq(bodyMeasurements.type, "weight"), isNull(bodyMeasurements.deletedAt))).orderBy(desc(bodyMeasurements.measuredAt)).limit(1),
  ]);
  const tz = settings?.timezone ?? "UTC";
  const goal = await goalForDate(viewer.id, localDate(tz));
  return {
    id: viewer.id, email: viewer.email, username: viewer.username, role: viewer.role,
    profile, settings, goal, latestWeightKg: weight[0]?.value ?? null,
    onboarded: Boolean(settings?.onboardingCompletedAt),
  };
}

export async function patchProfile(userId: string, patch: z.infer<typeof profilePatch>) {
  if (Object.keys(patch).length) {
    const stmts: any[] = [db.update(profiles).set(patch).where(eq(profiles.userId, userId))];
    if (patch.displayName) stmts.push(db.update(user).set({ name: patch.displayName }).where(eq(user.id, userId)));
    await db.batch(stmts as [any, ...any[]]);
  }
  const [p] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  return p;
}

export async function patchSettings(userId: string, patch: z.infer<typeof settingsPatch>) {
  if (Object.keys(patch).length) await db.update(userSettings).set(patch).where(eq(userSettings.userId, userId));
  const [s] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  return s;
}

export async function setNutritionGoal(userId: string, input: z.infer<typeof goalInput>) {
  const tz = (await db.select({ tz: userSettings.timezone }).from(userSettings).where(eq(userSettings.userId, userId)))[0]?.tz ?? "UTC";
  const effectiveFrom = input.effectiveFrom ?? localDate(tz);
  const { effectiveFrom: _e, ...values } = input;
  // One goal per effective date: replacing is "delete then insert" in a single atomic batch.
  await db.batch([
    db.delete(nutritionGoals).where(and(eq(nutritionGoals.userId, userId), eq(nutritionGoals.effectiveFrom, effectiveFrom))),
    db.insert(nutritionGoals).values({ userId, effectiveFrom, ...values }),
  ]);
  return goalForDate(userId, effectiveFrom);
}

export async function goalHistory(userId: string) {
  return db.select().from(nutritionGoals).where(eq(nutritionGoals.userId, userId)).orderBy(desc(nutritionGoals.effectiveFrom));
}

export async function completeOnboarding(userId: string, i: z.infer<typeof onboardingInput>) {
  const rec = calculateGoals(i);
  const today = localDate(i.timezone);
  const now = new Date();
  const stmts: any[] = [
    db.update(userSettings).set({
      sex: i.sex, birthDate: i.birthDate, heightCm: i.heightCm, activityLevel: i.activityLevel, weightUnit: i.weightUnit,
      distanceUnit: i.distanceUnit, timezone: i.timezone, onboardingCompletedAt: now,
    }).where(eq(userSettings.userId, userId)),
    db.delete(nutritionGoals).where(and(eq(nutritionGoals.userId, userId), eq(nutritionGoals.effectiveFrom, today))),
    db.insert(nutritionGoals).values({ userId, effectiveFrom: today, calories: rec.calories, proteinG: rec.proteinG, carbsG: rec.carbsG, fatG: rec.fatG, waterMl: 2500 }),
    db.insert(bodyMeasurements).values({ userId, type: "weight", value: i.weightKg, measuredAt: now }),
    db.update(weightGoals).set({ isActive: false }).where(eq(weightGoals.userId, userId)),
    db.insert(weightGoals).values({
      userId, goalType: i.goal, startWeightKg: i.weightKg, targetWeightKg: i.targetWeightKg ?? i.weightKg, weeklyRateKg: i.weeklyRateKg, startDate: today,
    }),
  ];
  if (i.displayName) {
    stmts.push(db.update(profiles).set({ displayName: i.displayName }).where(eq(profiles.userId, userId)));
    stmts.push(db.update(user).set({ name: i.displayName }).where(eq(user.id, userId)));
  }
  await db.batch(stmts as [any, ...any[]]);
  return { recommendation: rec };
}

export async function getWeightGoal(userId: string) {
  const [g] = await db.select().from(weightGoals).where(and(eq(weightGoals.userId, userId), eq(weightGoals.isActive, true))).orderBy(desc(weightGoals.createdAt)).limit(1);
  return g ?? null;
}

export const weightGoalInput = z.object({
  goalType: z.enum(["lose", "maintain", "gain"]),
  targetWeightKg: z.number().min(20).max(500),
  weeklyRateKg: z.number().min(0).max(1.5).default(0.5),
});

export async function setWeightGoal(userId: string, i: z.infer<typeof weightGoalInput>) {
  const [latest] = await db.select({ v: bodyMeasurements.value }).from(bodyMeasurements).where(and(eq(bodyMeasurements.userId, userId), eq(bodyMeasurements.type, "weight"), isNull(bodyMeasurements.deletedAt))).orderBy(desc(bodyMeasurements.measuredAt)).limit(1);
  const tz = await db.select({ tz: userSettings.timezone }).from(userSettings).where(eq(userSettings.userId, userId));
  await db.batch([
    db.update(weightGoals).set({ isActive: false }).where(eq(weightGoals.userId, userId)),
    db.insert(weightGoals).values({ userId, goalType: i.goalType, targetWeightKg: i.targetWeightKg, weeklyRateKg: i.weeklyRateKg, startWeightKg: latest?.v ?? i.targetWeightKg, startDate: localDate(tz[0]?.tz ?? "UTC") }),
  ]);
  return getWeightGoal(userId);
}

export const measurementInput = z.object({
  type: z.enum(MEASUREMENT_TYPES),
  value: z.number().positive().max(1000),
  unit: z.enum(["kg", "lb", "cm", "in", "pct"]).optional(),
  measuredAt: z.string().datetime().optional(),
  note: z.string().max(200).optional(),
});

export async function addMeasurement(userId: string, i: z.infer<typeof measurementInput>) {
  let value = i.value;
  if (i.type === "weight") value = toKg(i.value, i.unit === "lb" ? "lb" : "kg");
  else if (i.type !== "body_fat" && i.unit === "in") value = i.value * 2.54;
  if (i.type === "body_fat" && value > 70) throw badRequest("Body fat must be a percentage below 70");
  const [row] = await db.insert(bodyMeasurements).values({ userId, type: i.type, value: Math.round(value * 100) / 100, measuredAt: i.measuredAt ? new Date(i.measuredAt) : new Date(), note: i.note }).returning();
  return row;
}

export async function listMeasurements(userId: string, type: (typeof MEASUREMENT_TYPES)[number], from?: string, to?: string) {
  return db
    .select()
    .from(bodyMeasurements)
    .where(and(
      eq(bodyMeasurements.userId, userId), eq(bodyMeasurements.type, type), isNull(bodyMeasurements.deletedAt),
      from ? gte(bodyMeasurements.measuredAt, new Date(`${from}T00:00:00Z`)) : undefined,
      to ? lte(bodyMeasurements.measuredAt, new Date(`${to}T23:59:59Z`)) : undefined,
    ))
    .orderBy(asc(bodyMeasurements.measuredAt));
}

export async function deleteMeasurement(userId: string, id: string) {
  const res = await db.update(bodyMeasurements).set({ deletedAt: new Date() }).where(and(eq(bodyMeasurements.id, id), eq(bodyMeasurements.userId, userId), isNull(bodyMeasurements.deletedAt))).returning({ id: bodyMeasurements.id });
  if (!res.length) throw notFound("Measurement");
}
