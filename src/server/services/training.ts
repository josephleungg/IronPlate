import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/driver";
import {
  EQUIPMENT, EXERCISE_TYPES, exerciseMuscles, exercises, mediaAssets, muscleGroups, personalRecords, postMedia, posts, profiles,
  routineExercises, routineFolders, routineSets, routines, SET_TYPES, user, VISIBILITY, workoutExercises, workoutSets, workouts,
} from "@/db/schema";
import { bestCandidates, workoutTotals, type ExerciseType, type PRType, type SetInput } from "@/lib/domain/training";
import { uuidv7 } from "@/lib/id";
import { badRequest, conflict, decodeCursor, encodeCursor, forbidden, notFound, zId } from "../http";
import { canViewUserContent } from "../permissions";

const chunk = <T,>(arr: T[], n: number): T[][] => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// ---------------------------------------------------------------- exercises

export const exerciseInput = z.object({
  name: z.string().trim().min(1).max(80),
  exerciseType: z.enum(EXERCISE_TYPES).default("weight_reps"),
  equipment: z.enum(EQUIPMENT).default("none"),
  primaryMuscles: z.array(z.string()).max(6).default([]),
  secondaryMuscles: z.array(z.string()).max(6).default([]),
  instructions: z.string().max(2000).optional(),
});

async function withMuscles<T extends { id: string }>(rows: T[]) {
  if (!rows.length) return [] as (T & { primaryMuscles: string[]; secondaryMuscles: string[] })[];
  const links = await db
    .select({ exerciseId: exerciseMuscles.exerciseId, slug: muscleGroups.slug, role: exerciseMuscles.role })
    .from(exerciseMuscles)
    .innerJoin(muscleGroups, eq(muscleGroups.id, exerciseMuscles.muscleGroupId))
    .where(inArray(exerciseMuscles.exerciseId, rows.map((r) => r.id)));
  return rows.map((r) => ({
    ...r,
    primaryMuscles: links.filter((l) => l.exerciseId === r.id && l.role === "primary").map((l) => l.slug),
    secondaryMuscles: links.filter((l) => l.exerciseId === r.id && l.role === "secondary").map((l) => l.slug),
  }));
}

export async function listExercises(viewerId: string, f: { q?: string; muscle?: string; equipment?: string; type?: string; limit?: number }) {
  const tokens = (f.q ?? "").toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
  const rows = await db
    .select()
    .from(exercises)
    .where(and(
      isNull(exercises.deletedAt),
      or(isNull(exercises.ownerId), eq(exercises.ownerId, viewerId)),
      ...tokens.map((t) => sql`${exercises.name} like ${`%${t.replace(/[\\%_]/g, (m) => `\\${m}`)}%`} escape '\\'`),
      f.equipment ? eq(exercises.equipment, f.equipment as (typeof EQUIPMENT)[number]) : undefined,
      f.type ? eq(exercises.exerciseType, f.type as (typeof EXERCISE_TYPES)[number]) : undefined,
      f.muscle
        ? sql`exists (select 1 from exercise_muscles em join muscle_groups mg on mg.id = em.muscle_group_id where em.exercise_id = ${exercises.id} and mg.slug = ${f.muscle})`
        : undefined,
    ))
    .orderBy(sql`case when ${exercises.ownerId} is null then 1 else 0 end`, asc(exercises.name))
    .limit(f.limit ?? 60);
  return withMuscles(rows);
}

export async function getExercise(viewerId: string, id: string) {
  const [row] = await db.select().from(exercises).where(and(eq(exercises.id, id), isNull(exercises.deletedAt), or(isNull(exercises.ownerId), eq(exercises.ownerId, viewerId))));
  if (!row) throw notFound("Exercise");
  return (await withMuscles([row]))[0];
}

export async function createExercise(viewerId: string, i: z.infer<typeof exerciseInput>) {
  const muscles = await db.select().from(muscleGroups);
  const bySlug = new Map(muscles.map((m) => [m.slug, m.id]));
  for (const s of [...i.primaryMuscles, ...i.secondaryMuscles]) if (!bySlug.has(s)) throw badRequest(`Unknown muscle group: ${s}`);
  const id = uuidv7();
  const slug = i.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  await db.batch([
    db.insert(exercises).values({ id, ownerId: viewerId, name: i.name, slug, exerciseType: i.exerciseType, equipment: i.equipment, instructions: i.instructions }),
    ...i.primaryMuscles.map((s) => db.insert(exerciseMuscles).values({ exerciseId: id, muscleGroupId: bySlug.get(s)!, role: "primary" })),
    ...i.secondaryMuscles.filter((s) => !i.primaryMuscles.includes(s)).map((s) => db.insert(exerciseMuscles).values({ exerciseId: id, muscleGroupId: bySlug.get(s)!, role: "secondary" })),
  ] as [any, ...any[]]);
  return getExercise(viewerId, id);
}

export async function deleteExercise(viewerId: string, id: string) {
  const [row] = await db.select({ ownerId: exercises.ownerId }).from(exercises).where(eq(exercises.id, id));
  if (!row) throw notFound("Exercise");
  if (row.ownerId !== viewerId) throw forbidden("You can only delete exercises you created");
  await db.update(exercises).set({ deletedAt: new Date() }).where(eq(exercises.id, id));
}

export const listMuscleGroups = () => db.select().from(muscleGroups).orderBy(asc(muscleGroups.name));

// ---------------------------------------------------------------- workouts

const num = z.number().finite();
export const setInputSchema = z.object({
  setType: z.enum(SET_TYPES).default("normal"),
  weightKg: num.min(0).max(2000).nullish(),
  reps: z.number().int().min(0).max(1000).nullish(),
  durationS: z.number().int().min(0).max(86_400).nullish(),
  distanceM: num.min(0).max(1_000_000).nullish(),
  rpe: num.min(1).max(10).nullish(),
});

export const workoutInput = z.object({
  id: zId.optional(),
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).nullish(),
  routineId: zId.nullish(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  visibility: z.enum(VISIBILITY).default("followers"),
  share: z.boolean().default(true),
  caption: z.string().trim().max(500).nullish(),
  mediaIds: z.array(zId).max(10).default([]),
  exercises: z.array(z.object({
    exerciseId: zId,
    supersetGroup: z.number().int().min(1).max(20).nullish(),
    restSeconds: z.number().int().min(0).max(1800).nullish(),
    notes: z.string().max(500).nullish(),
    sets: z.array(setInputSchema).min(1).max(60),
  })).min(1).max(40),
});
export type WorkoutInput = z.infer<typeof workoutInput>;

async function loadExerciseTypes(viewerId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  const rows = await db.select({ id: exercises.id, type: exercises.exerciseType }).from(exercises)
    .where(and(inArray(exercises.id, unique), isNull(exercises.deletedAt), or(isNull(exercises.ownerId), eq(exercises.ownerId, viewerId))));
  if (rows.length !== unique.length) throw badRequest("One or more exercises don't exist", "UNKNOWN_EXERCISE");
  return new Map(rows.map((r) => [r.id, r.type as ExerciseType]));
}

/**
 * Personal records are derived data. Rebuilding an exercise from its full history after every
 * write keeps them correct through edits, deletes and back-dated workouts.
 */
export async function rebuildRecords(userId: string, exerciseIds: string[]) {
  await Promise.all([...new Set(exerciseIds)].map(async (exerciseId) => {
    const [ex] = await db.select({ type: exercises.exerciseType }).from(exercises).where(eq(exercises.id, exerciseId));
    if (!ex) return;
    const rows = await db
      .select({
        workoutId: workouts.id, startedAt: workouts.startedAt, setType: workoutSets.setType, weightKg: workoutSets.weightKg,
        reps: workoutSets.reps, durationS: workoutSets.durationS, distanceM: workoutSets.distanceM,
      })
      .from(workoutSets)
      .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.workoutExerciseId))
      .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
      .where(and(eq(workouts.userId, userId), isNull(workouts.deletedAt), eq(workoutExercises.exerciseId, exerciseId)))
      .orderBy(asc(workouts.startedAt), asc(workouts.id));

    const byWorkout = new Map<string, { startedAt: Date; sets: SetInput[] }>();
    for (const r of rows) {
      const w = byWorkout.get(r.workoutId) ?? { startedAt: r.startedAt, sets: [] };
      w.sets.push({ setType: r.setType, weightKg: r.weightKg, reps: r.reps, durationS: r.durationS, distanceM: r.distanceM });
      byWorkout.set(r.workoutId, w);
    }
    const running = new Map<PRType, number>();
    const out: (typeof personalRecords.$inferInsert)[] = [];
    let first = true;
    for (const [workoutId, w] of byWorkout) {
      for (const [type, value] of bestCandidates(ex.type as ExerciseType, w.sets)) {
        if (value > (running.get(type) ?? 0)) {
          running.set(type, value);
          out.push({ userId, exerciseId, recordType: type, value, workoutId, isBaseline: first, achievedAt: w.startedAt });
        }
      }
      first = false;
    }
    await db.batch([
      db.delete(personalRecords).where(and(eq(personalRecords.userId, userId), eq(personalRecords.exerciseId, exerciseId))),
      ...chunk(out, 12).map((rows) => db.insert(personalRecords).values(rows)),
    ] as [any, ...any[]]);
  }));
  await db.run(sql`update workouts set pr_count = (select count(*) from personal_records pr where pr.workout_id = workouts.id and pr.is_baseline = 0) where user_id = ${userId}`);
}

export async function saveWorkout(viewerId: string, input: WorkoutInput, editingId?: string) {
  const startedAt = new Date(input.startedAt);
  const endedAt = new Date(input.endedAt);
  if (endedAt <= startedAt) throw badRequest("A workout must end after it starts");
  if (endedAt.getTime() - startedAt.getTime() > 24 * 3600_000) throw badRequest("A workout can't be longer than 24 hours");
  if (endedAt.getTime() > Date.now() + 5 * 60_000) throw badRequest("A workout can't end in the future");

  const types = await loadExerciseTypes(viewerId, input.exercises.map((e) => e.exerciseId));
  const id = editingId ?? input.id ?? uuidv7();

  const [existing] = await db.select().from(workouts).where(eq(workouts.id, id));
  if (existing && existing.userId !== viewerId) throw conflict("That workout ID is already in use");
  if (existing && !editingId && !existing.deletedAt) return getWorkout(viewerId, id); // retried create: idempotent
  if (editingId && (!existing || existing.deletedAt)) throw notFound("Workout");

  if (input.routineId) {
    const [r] = await db.select({ id: routines.id }).from(routines).where(and(eq(routines.id, input.routineId), eq(routines.userId, viewerId)));
    if (!r) throw badRequest("Unknown routine", "UNKNOWN_ROUTINE");
  }

  const totals = workoutTotals(input.exercises.map((e) => ({ type: types.get(e.exerciseId)!, sets: e.sets.map((s) => ({ ...s, setType: s.setType ?? "normal" })) })));
  const durationS = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);
  const base = {
    title: input.title, description: input.description ?? null, routineId: input.routineId ?? null, startedAt, endedAt, durationS,
    visibility: input.visibility, ...totals,
  };

  const previousExerciseIds = editingId
    ? (await db.select({ id: workoutExercises.exerciseId }).from(workoutExercises).where(eq(workoutExercises.workoutId, id))).map((r) => r.id)
    : [];

  const exRows: (typeof workoutExercises.$inferInsert)[] = [];
  const setRows: (typeof workoutSets.$inferInsert)[] = [];
  input.exercises.forEach((e, position) => {
    const weId = uuidv7();
    exRows.push({ id: weId, workoutId: id, exerciseId: e.exerciseId, position, supersetGroup: e.supersetGroup ?? null, restSeconds: e.restSeconds ?? null, notes: e.notes ?? null });
    e.sets.forEach((s, i) => setRows.push({
      workoutExerciseId: weId, position: i, setType: s.setType, weightKg: s.weightKg ?? null, reps: s.reps ?? null,
      durationS: s.durationS ?? null, distanceM: s.distanceM ?? null, rpe: s.rpe ?? null, completedAt: endedAt,
    }));
  });

  // Photos must be the viewer's own, finished uploads.
  let mediaIds: string[] = [];
  if (input.mediaIds.length) {
    const own = await db.select({ id: mediaAssets.id }).from(mediaAssets).where(and(inArray(mediaAssets.id, input.mediaIds), eq(mediaAssets.ownerId, viewerId), eq(mediaAssets.status, "ready")));
    mediaIds = own.map((m) => m.id);
  }

  const shareable = input.share && input.visibility !== "private";
  const postVisibility = input.visibility === "public" ? "public" : "followers";
  const [existingPost] = await db.select().from(posts).where(eq(posts.workoutId, id));

  const stmts: any[] = [];
  if (editingId) {
    stmts.push(db.update(workouts).set(base).where(eq(workouts.id, id)));
    stmts.push(db.delete(workoutExercises).where(eq(workoutExercises.workoutId, id))); // sets cascade
  } else if (existing) {
    stmts.push(db.update(workouts).set({ ...base, deletedAt: null }).where(eq(workouts.id, id)));
    stmts.push(db.delete(workoutExercises).where(eq(workoutExercises.workoutId, id)));
  } else {
    stmts.push(db.insert(workouts).values({ id, userId: viewerId, ...base }));
    stmts.push(db.update(profiles).set({ workoutsCount: sql`${profiles.workoutsCount} + 1` }).where(eq(profiles.userId, viewerId)));
  }
  for (const rows of chunk(exRows, 12)) stmts.push(db.insert(workoutExercises).values(rows));
  for (const rows of chunk(setRows, 8)) stmts.push(db.insert(workoutSets).values(rows));

  let postId = existingPost?.id;
  if (shareable) {
    if (existingPost) stmts.push(db.update(posts).set({ body: input.caption ?? null, visibility: postVisibility, deletedAt: null }).where(eq(posts.id, existingPost.id)));
    else {
      postId = uuidv7();
      stmts.push(db.insert(posts).values({ id: postId, userId: viewerId, type: "workout", workoutId: id, body: input.caption ?? null, visibility: postVisibility }));
    }
    if (mediaIds.length) {
      stmts.push(db.delete(postMedia).where(eq(postMedia.postId, postId!)));
      stmts.push(db.insert(postMedia).values(mediaIds.map((mediaId, position) => ({ postId: postId!, mediaId, position }))));
    }
  } else if (existingPost && !existingPost.deletedAt) {
    stmts.push(db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, existingPost.id)));
  }

  await db.batch(stmts as [any, ...any[]]);
  await rebuildRecords(viewerId, [...input.exercises.map((e) => e.exerciseId), ...previousExerciseIds]);
  return getWorkout(viewerId, id);
}

export async function deleteWorkout(viewerId: string, id: string) {
  const [w] = await db.select().from(workouts).where(and(eq(workouts.id, id), isNull(workouts.deletedAt)));
  if (!w) throw notFound("Workout");
  if (w.userId !== viewerId) throw forbidden();
  const exerciseIds = (await db.select({ id: workoutExercises.exerciseId }).from(workoutExercises).where(eq(workoutExercises.workoutId, id))).map((r) => r.id);
  const now = new Date();
  await db.batch([
    db.update(workouts).set({ deletedAt: now }).where(eq(workouts.id, id)),
    db.update(posts).set({ deletedAt: now }).where(eq(posts.workoutId, id)),
    db.update(profiles).set({ workoutsCount: sql`max(${profiles.workoutsCount} - 1, 0)` }).where(eq(profiles.userId, viewerId)),
  ]);
  await rebuildRecords(viewerId, exerciseIds);
}

export async function getWorkout(viewerId: string | null, id: string) {
  const [w] = await db.select().from(workouts).where(and(eq(workouts.id, id), isNull(workouts.deletedAt)));
  if (!w) throw notFound("Workout");
  if (!(await canViewUserContent(viewerId, w.userId, w.visibility))) throw notFound("Workout"); // don't reveal it exists
  const [author] = await db
    .select({ id: user.id, username: user.username, displayName: profiles.displayName })
    .from(user).innerJoin(profiles, eq(profiles.userId, user.id)).where(eq(user.id, w.userId));
  const exRows = await db
    .select({ we: workoutExercises, name: exercises.name, type: exercises.exerciseType, equipment: exercises.equipment })
    .from(workoutExercises).innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .where(eq(workoutExercises.workoutId, id)).orderBy(asc(workoutExercises.position));
  const [sets, prs, [post]] = await Promise.all([
    exRows.length ? db.select().from(workoutSets).where(inArray(workoutSets.workoutExerciseId, exRows.map((r) => r.we.id))).orderBy(asc(workoutSets.position)) : Promise.resolve([]),
    db.select({ exerciseId: personalRecords.exerciseId, recordType: personalRecords.recordType, value: personalRecords.value }).from(personalRecords).where(and(eq(personalRecords.workoutId, id), eq(personalRecords.isBaseline, false))),
    db.select({ id: posts.id }).from(posts).where(and(eq(posts.workoutId, id), isNull(posts.deletedAt))),
  ]);
  return {
    ...w, author, postId: post?.id ?? null,
    exercises: exRows.map((r) => ({
      id: r.we.id, exerciseId: r.we.exerciseId, name: r.name, type: r.type, equipment: r.equipment, position: r.we.position,
      supersetGroup: r.we.supersetGroup, restSeconds: r.we.restSeconds, notes: r.we.notes,
      sets: sets.filter((s) => s.workoutExerciseId === r.we.id),
      records: prs.filter((p) => p.exerciseId === r.we.exerciseId),
    })),
  };
}

export async function listWorkouts(userId: string, opts: { cursor?: string; limit: number }) {
  const c = decodeCursor<{ t: number; id: string }>(opts.cursor);
  const rows = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, userId), isNull(workouts.deletedAt), c ? or(lt(workouts.startedAt, new Date(c.t)), and(eq(workouts.startedAt, new Date(c.t)), lt(workouts.id, c.id))) : undefined))
    .orderBy(desc(workouts.startedAt), desc(workouts.id))
    .limit(opts.limit + 1);
  const page = rows.slice(0, opts.limit);
  const summaries = page.length
    ? await db
        .select({
          workoutId: workoutExercises.workoutId, name: exercises.name, position: workoutExercises.position,
          setCount: sql<number>`(select count(*) from workout_sets s where s.workout_exercise_id = ${workoutExercises.id} and s.set_type != 'warmup')`,
        })
        .from(workoutExercises).innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
        .where(inArray(workoutExercises.workoutId, page.map((w) => w.id))).orderBy(asc(workoutExercises.position))
    : [];
  const last = page[page.length - 1];
  return {
    data: page.map((w) => ({ ...w, exercises: summaries.filter((s) => s.workoutId === w.id).map((s) => ({ name: s.name, sets: s.setCount })) })),
    nextCursor: rows.length > opts.limit && last ? encodeCursor({ t: last.startedAt.getTime(), id: last.id }) : null,
  };
}

/** What the user did last time for each exercise, shown as the "Previous" column in the logger. */
export async function previousSets(userId: string, exerciseIds: string[]) {
  const entries = await Promise.all(exerciseIds.slice(0, 30).map(async (exerciseId) => {
    const [we] = await db
      .select({ id: workoutExercises.id })
      .from(workoutExercises).innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
      .where(and(eq(workouts.userId, userId), isNull(workouts.deletedAt), eq(workoutExercises.exerciseId, exerciseId)))
      .orderBy(desc(workouts.startedAt)).limit(1);
    if (!we) return [exerciseId, []] as const;
    const sets = await db.select({ setType: workoutSets.setType, weightKg: workoutSets.weightKg, reps: workoutSets.reps, durationS: workoutSets.durationS, distanceM: workoutSets.distanceM })
      .from(workoutSets).where(eq(workoutSets.workoutExerciseId, we.id)).orderBy(asc(workoutSets.position));
    return [exerciseId, sets] as const;
  }));
  return Object.fromEntries(entries);
}

export async function exerciseStats(userId: string, exerciseId: string) {
  const rows = await db
    .select({ workoutId: workouts.id, startedAt: workouts.startedAt, setType: workoutSets.setType, weightKg: workoutSets.weightKg, reps: workoutSets.reps, durationS: workoutSets.durationS, distanceM: workoutSets.distanceM, type: exercises.exerciseType })
    .from(workoutSets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.workoutExerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .where(and(eq(workouts.userId, userId), isNull(workouts.deletedAt), eq(workoutExercises.exerciseId, exerciseId)))
    .orderBy(asc(workouts.startedAt));
  const by = new Map<string, { date: Date; type: ExerciseType; sets: SetInput[] }>();
  for (const r of rows) {
    const w = by.get(r.workoutId) ?? { date: r.startedAt, type: r.type as ExerciseType, sets: [] };
    w.sets.push({ setType: r.setType, weightKg: r.weightKg, reps: r.reps, durationS: r.durationS, distanceM: r.distanceM });
    by.set(r.workoutId, w);
  }
  const records = await db.select().from(personalRecords).where(and(eq(personalRecords.userId, userId), eq(personalRecords.exerciseId, exerciseId))).orderBy(asc(personalRecords.achievedAt));
  const current: Record<string, number> = {};
  for (const r of records) current[r.recordType] = Math.max(current[r.recordType] ?? 0, r.value);
  return {
    series: [...by.entries()].map(([workoutId, w]) => {
      const best = bestCandidates(w.type, w.sets);
      const t = workoutTotals([{ type: w.type, sets: w.sets }]);
      return {
        workoutId, date: w.date, est1rm: best.get("est_1rm") ?? null, maxWeight: best.get("max_weight") ?? null,
        bestSetVolume: best.get("max_set_volume") ?? null, volume: t.totalVolumeKg, reps: t.totalReps,
      };
    }),
    records: current,
    recordHistory: records.filter((r) => !r.isBaseline),
  };
}

// ---------------------------------------------------------------- routines

const routineSetInput = z.object({
  setType: z.enum(SET_TYPES).default("normal"),
  targetWeightKg: num.min(0).max(2000).nullish(),
  targetRepsMin: z.number().int().min(0).max(1000).nullish(),
  targetRepsMax: z.number().int().min(0).max(1000).nullish(),
  targetDurationS: z.number().int().min(0).max(86_400).nullish(),
  targetDistanceM: num.min(0).nullish(),
  targetRpe: num.min(1).max(10).nullish(),
});
export const routineInput = z.object({
  name: z.string().trim().min(1).max(80),
  notes: z.string().max(1000).nullish(),
  folderId: zId.nullish(),
  exercises: z.array(z.object({
    exerciseId: zId,
    supersetGroup: z.number().int().min(1).max(20).nullish(),
    restSeconds: z.number().int().min(0).max(1800).nullish(),
    notes: z.string().max(500).nullish(),
    sets: z.array(routineSetInput).min(1).max(60),
  })).max(40),
});
export type RoutineInput = z.infer<typeof routineInput>;

function routineWriteStmts(routineId: string, i: RoutineInput) {
  const exRows: (typeof routineExercises.$inferInsert)[] = [];
  const setRows: (typeof routineSets.$inferInsert)[] = [];
  i.exercises.forEach((e, position) => {
    const reId = uuidv7();
    exRows.push({ id: reId, routineId, exerciseId: e.exerciseId, position, supersetGroup: e.supersetGroup ?? null, restSeconds: e.restSeconds ?? null, notes: e.notes ?? null });
    e.sets.forEach((s, n) => setRows.push({
      routineExerciseId: reId, position: n, setType: s.setType, targetWeightKg: s.targetWeightKg ?? null, targetRepsMin: s.targetRepsMin ?? null,
      targetRepsMax: s.targetRepsMax ?? null, targetDurationS: s.targetDurationS ?? null, targetDistanceM: s.targetDistanceM ?? null, targetRpe: s.targetRpe ?? null,
    }));
  });
  return [...chunk(exRows, 12).map((r) => db.insert(routineExercises).values(r)), ...chunk(setRows, 8).map((r) => db.insert(routineSets).values(r))];
}

export async function createRoutine(viewerId: string, i: RoutineInput) {
  await loadExerciseTypes(viewerId, i.exercises.map((e) => e.exerciseId));
  if (i.folderId) await assertFolder(viewerId, i.folderId);
  const id = uuidv7();
  await db.batch([
    db.insert(routines).values({ id, userId: viewerId, name: i.name, notes: i.notes ?? null, folderId: i.folderId ?? null }),
    ...routineWriteStmts(id, i),
  ] as [any, ...any[]]);
  return getRoutine(viewerId, id);
}

async function assertFolder(userId: string, folderId: string) {
  const [f] = await db.select({ id: routineFolders.id }).from(routineFolders).where(and(eq(routineFolders.id, folderId), eq(routineFolders.userId, userId), isNull(routineFolders.deletedAt)));
  if (!f) throw badRequest("Unknown folder", "UNKNOWN_FOLDER");
}

export async function replaceRoutine(viewerId: string, id: string, i: RoutineInput) {
  const [r] = await db.select().from(routines).where(and(eq(routines.id, id), isNull(routines.deletedAt)));
  if (!r || r.userId !== viewerId) throw notFound("Routine");
  await loadExerciseTypes(viewerId, i.exercises.map((e) => e.exerciseId));
  if (i.folderId) await assertFolder(viewerId, i.folderId);
  await db.batch([
    db.update(routines).set({ name: i.name, notes: i.notes ?? null, folderId: i.folderId ?? null }).where(eq(routines.id, id)),
    db.delete(routineExercises).where(eq(routineExercises.routineId, id)),
    ...routineWriteStmts(id, i),
  ] as [any, ...any[]]);
  return getRoutine(viewerId, id);
}

export async function getRoutine(viewerId: string | null, id: string) {
  const [r] = await db.select().from(routines).where(and(eq(routines.id, id), isNull(routines.deletedAt)));
  if (!r) throw notFound("Routine");
  if (!(await canViewUserContent(viewerId, r.userId, r.visibility))) throw notFound("Routine");
  return hydrateRoutine(r);
}

export async function getRoutineBySlug(slug: string) {
  const [r] = await db.select().from(routines).where(and(eq(routines.shareSlug, slug), isNull(routines.deletedAt), eq(routines.visibility, "public")));
  if (!r) throw notFound("Routine");
  return hydrateRoutine(r);
}

async function hydrateRoutine(r: typeof routines.$inferSelect) {
  const exRows = await db
    .select({ re: routineExercises, name: exercises.name, type: exercises.exerciseType })
    .from(routineExercises).innerJoin(exercises, eq(exercises.id, routineExercises.exerciseId))
    .where(eq(routineExercises.routineId, r.id)).orderBy(asc(routineExercises.position));
  const sets = exRows.length ? await db.select().from(routineSets).where(inArray(routineSets.routineExerciseId, exRows.map((x) => x.re.id))).orderBy(asc(routineSets.position)) : [];
  const [author] = await db.select({ username: user.username, displayName: profiles.displayName }).from(user).innerJoin(profiles, eq(profiles.userId, user.id)).where(eq(user.id, r.userId));
  return {
    ...r, author,
    exercises: exRows.map((x) => ({ ...x.re, name: x.name, type: x.type, sets: sets.filter((s) => s.routineExerciseId === x.re.id) })),
  };
}

export async function listRoutines(userId: string) {
  const [rows, folders] = await Promise.all([
    db.select().from(routines).where(and(eq(routines.userId, userId), isNull(routines.deletedAt))).orderBy(asc(routines.position), desc(routines.createdAt)),
    db.select().from(routineFolders).where(and(eq(routineFolders.userId, userId), isNull(routineFolders.deletedAt))).orderBy(asc(routineFolders.position)),
  ]);
  const ex = rows.length
    ? await db.select({ routineId: routineExercises.routineId, name: exercises.name }).from(routineExercises).innerJoin(exercises, eq(exercises.id, routineExercises.exerciseId)).where(inArray(routineExercises.routineId, rows.map((r) => r.id))).orderBy(asc(routineExercises.position))
    : [];
  return { folders, routines: rows.map((r) => ({ ...r, exerciseNames: ex.filter((e) => e.routineId === r.id).map((e) => e.name) })) };
}

export async function deleteRoutine(userId: string, id: string) {
  const res = await db.update(routines).set({ deletedAt: new Date() }).where(and(eq(routines.id, id), eq(routines.userId, userId), isNull(routines.deletedAt))).returning({ id: routines.id });
  if (!res.length) throw notFound("Routine");
}

export async function patchRoutine(userId: string, id: string, patch: { name?: string; notes?: string | null; folderId?: string | null; visibility?: (typeof VISIBILITY)[number] }) {
  if (patch.folderId) await assertFolder(userId, patch.folderId);
  const res = await db.update(routines).set(patch).where(and(eq(routines.id, id), eq(routines.userId, userId), isNull(routines.deletedAt))).returning({ id: routines.id });
  if (!res.length) throw notFound("Routine");
  return getRoutine(userId, id);
}

export async function shareRoutine(userId: string, id: string) {
  const slug = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  const res = await db.update(routines).set({ shareSlug: slug, visibility: "public" }).where(and(eq(routines.id, id), eq(routines.userId, userId), isNull(routines.deletedAt))).returning({ id: routines.id });
  if (!res.length) throw notFound("Routine");
  return { slug };
}

/** Copy a routine the viewer is allowed to see into their own list. */
export async function copyRoutine(viewerId: string, id: string) {
  const src = await getRoutine(viewerId, id);
  const copy = await createRoutine(viewerId, {
    name: src.userId === viewerId ? `${src.name} (copy)` : src.name,
    notes: src.notes,
    exercises: src.exercises.map((e) => ({
      exerciseId: e.exerciseId, supersetGroup: e.supersetGroup, restSeconds: e.restSeconds, notes: e.notes,
      sets: e.sets.map((s) => ({ setType: s.setType, targetWeightKg: s.targetWeightKg, targetRepsMin: s.targetRepsMin, targetRepsMax: s.targetRepsMax, targetDurationS: s.targetDurationS, targetDistanceM: s.targetDistanceM, targetRpe: s.targetRpe })),
    })),
  });
  if (src.userId !== viewerId) {
    await db.update(routines).set({ sourceRoutineId: id }).where(eq(routines.id, copy.id));
    await db.update(routines).set({ copyCount: sql`${routines.copyCount} + 1` }).where(eq(routines.id, id));
  }
  return copy;
}

export async function routineFromWorkout(viewerId: string, workoutId: string, name?: string) {
  const w = await getWorkout(viewerId, workoutId);
  return createRoutine(viewerId, {
    name: name?.trim() || w.title,
    exercises: w.exercises.map((e) => ({
      exerciseId: e.exerciseId, supersetGroup: e.supersetGroup, restSeconds: e.restSeconds,
      sets: e.sets.map((s) => ({ setType: s.setType, targetWeightKg: s.weightKg, targetRepsMin: s.reps, targetRepsMax: s.reps, targetDurationS: s.durationS, targetDistanceM: s.distanceM })),
    })),
  });
}
