export type ExerciseType =
  | "weight_reps" | "bodyweight_reps" | "weighted_bodyweight" | "assisted_bodyweight"
  | "duration" | "distance_duration" | "weight_distance" | "reps_only";
export type SetType = "warmup" | "normal" | "failure" | "drop";
export type PRType = "max_weight" | "est_1rm" | "max_set_volume" | "max_reps" | "max_duration" | "max_distance";

export type SetInput = {
  setType: SetType;
  weightKg?: number | null;
  reps?: number | null;
  durationS?: number | null;
  distanceM?: number | null;
};

/** Which inputs the logger should show for an exercise type. */
export const EXERCISE_FIELDS: Record<ExerciseType, { weight: boolean; reps: boolean; duration: boolean; distance: boolean; weightLabel?: string }> = {
  weight_reps: { weight: true, reps: true, duration: false, distance: false },
  bodyweight_reps: { weight: false, reps: true, duration: false, distance: false },
  reps_only: { weight: false, reps: true, duration: false, distance: false },
  weighted_bodyweight: { weight: true, reps: true, duration: false, distance: false, weightLabel: "+kg" },
  assisted_bodyweight: { weight: true, reps: true, duration: false, distance: false, weightLabel: "-kg" },
  duration: { weight: false, reps: false, duration: true, distance: false },
  distance_duration: { weight: false, reps: false, duration: true, distance: true },
  weight_distance: { weight: true, reps: false, duration: false, distance: true },
};

/** Epley estimate. Beyond 12 reps the estimate is unreliable, so those sets don't produce an e1RM. */
export function estimate1RM(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps <= 0 || reps > 12) return null;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

/** Warmups never count toward volume or PRs. */
export const countsTowardStats = (s: SetInput) => s.setType !== "warmup";

/** Volume in kg for one set. Assisted weight is subtracted conceptually, so it contributes no volume. */
export function setVolumeKg(type: ExerciseType, s: SetInput): number {
  if (!countsTowardStats(s)) return 0;
  const w = s.weightKg ?? 0;
  const r = s.reps ?? 0;
  if (type === "weight_reps" || type === "weighted_bodyweight") return w * r;
  return 0;
}

export function workoutTotals(
  exercises: { type: ExerciseType; sets: SetInput[] }[],
): { totalVolumeKg: number; totalSets: number; totalReps: number } {
  let totalVolumeKg = 0, totalSets = 0, totalReps = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (!countsTowardStats(s)) continue;
      totalSets += 1;
      totalReps += s.reps ?? 0;
      totalVolumeKg += setVolumeKg(ex.type, s);
    }
  }
  return { totalVolumeKg: Math.round(totalVolumeKg * 10) / 10, totalSets, totalReps };
}

export type PRCandidate = { type: PRType; value: number };

/** The records a single set could set, given the exercise type. */
export function prCandidatesForSet(type: ExerciseType, s: SetInput): PRCandidate[] {
  if (!countsTowardStats(s)) return [];
  const out: PRCandidate[] = [];
  const w = s.weightKg ?? 0;
  const r = s.reps ?? 0;
  if (type === "weight_reps" || type === "weighted_bodyweight") {
    if (w > 0 && r > 0) {
      out.push({ type: "max_weight", value: w });
      out.push({ type: "max_set_volume", value: Math.round(w * r * 10) / 10 });
      const e = estimate1RM(w, r);
      if (e) out.push({ type: "est_1rm", value: e });
    }
  } else if (type === "bodyweight_reps" || type === "reps_only") {
    if (r > 0) out.push({ type: "max_reps", value: r });
  } else if (type === "duration") {
    if ((s.durationS ?? 0) > 0) out.push({ type: "max_duration", value: s.durationS! });
  } else if (type === "distance_duration" || type === "weight_distance") {
    if ((s.distanceM ?? 0) > 0) out.push({ type: "max_distance", value: s.distanceM! });
  }
  return out;
}

/** Best value per record type across all sets of an exercise in one workout. */
export function bestCandidates(type: ExerciseType, sets: SetInput[]): Map<PRType, number> {
  const best = new Map<PRType, number>();
  for (const s of sets) {
    for (const c of prCandidatesForSet(type, s)) {
      if (c.value > (best.get(c.type) ?? 0)) best.set(c.type, c.value);
    }
  }
  return best;
}

/**
 * Compare this workout's bests with the user's existing records. Returns only the
 * ones that strictly beat the record. A first-ever set is not a "PR" worth celebrating
 * for the heaviest-weight style records unless there is history, so `hasHistory`
 * suppresses the very first workout of an exercise.
 */
export function detectPRs(
  best: Map<PRType, number>,
  existing: Map<PRType, number>,
  hasHistory: boolean,
): PRCandidate[] {
  const out: PRCandidate[] = [];
  for (const [type, value] of best) {
    const prev = existing.get(type) ?? 0;
    if (value > prev) out.push({ type, value });
  }
  return hasHistory ? out : [];
}
