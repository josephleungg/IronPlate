import { and, asc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db/driver";
import { exerciseMuscles, exercises, muscleGroups, workoutExercises, workoutSets, workouts } from "@/db/schema";
import { startOfWeek } from "@/lib/domain/dates";

export async function trainingReport(userId: string, from: string, to: string, weekStart: 0 | 1 = 1, tz = "UTC") {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T23:59:59Z`);
  const [ws, muscles] = await Promise.all([
    db.select({ id: workouts.id, startedAt: workouts.startedAt, durationS: workouts.durationS, volume: workouts.totalVolumeKg, sets: workouts.totalSets, prs: workouts.prCount })
      .from(workouts).where(and(eq(workouts.userId, userId), isNull(workouts.deletedAt), gte(workouts.startedAt, start), lte(workouts.startedAt, end))).orderBy(asc(workouts.startedAt)),
    db.select({ slug: muscleGroups.slug, name: muscleGroups.name, sets: sql<number>`count(*)` })
      .from(workoutSets)
      .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.workoutExerciseId))
      .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
      .innerJoin(exerciseMuscles, and(eq(exerciseMuscles.exerciseId, workoutExercises.exerciseId), eq(exerciseMuscles.role, "primary")))
      .innerJoin(muscleGroups, eq(muscleGroups.id, exerciseMuscles.muscleGroupId))
      .where(and(eq(workouts.userId, userId), isNull(workouts.deletedAt), gte(workouts.startedAt, start), lte(workouts.startedAt, end), sql`${workoutSets.setType} != 'warmup'`))
      .groupBy(muscleGroups.slug, muscleGroups.name).orderBy(sql`count(*) desc`),
  ]);
  const weeks = new Map<string, { week: string; workouts: number; volumeKg: number; durationS: number; sets: number }>();
  for (const w of ws) {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(w.startedAt);
    const key = startOfWeek(day, weekStart);
    const cur = weeks.get(key) ?? { week: key, workouts: 0, volumeKg: 0, durationS: 0, sets: 0 };
    cur.workouts += 1; cur.volumeKg += w.volume; cur.durationS += w.durationS; cur.sets += w.sets;
    weeks.set(key, cur);
  }
  return {
    totals: { workouts: ws.length, volumeKg: Math.round(ws.reduce((a, w) => a + w.volume, 0)), durationS: ws.reduce((a, w) => a + w.durationS, 0), sets: ws.reduce((a, w) => a + w.sets, 0), prs: ws.reduce((a, w) => a + w.prs, 0) },
    weeks: [...weeks.values()].map((w) => ({ ...w, volumeKg: Math.round(w.volumeKg) })),
    muscles,
  };
}

export { exercises, inArray };
