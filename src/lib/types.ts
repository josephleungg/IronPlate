// Shapes returned by /api/v1. Only the fields the UI reads are listed.
export type Visibility = "private" | "followers" | "public";
export type ExerciseType =
  | "weight_reps" | "bodyweight_reps" | "weighted_bodyweight" | "assisted_bodyweight"
  | "duration" | "distance_duration" | "weight_distance" | "reps_only";
export type SetType = "warmup" | "normal" | "failure" | "drop";

export type Settings = {
  sex: "male" | "female" | "unspecified"; birthDate: string | null; heightCm: number | null;
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  weightUnit: "kg" | "lb"; distanceUnit: "km" | "mi"; timezone: string; weekStart: number;
  diaryVisibility: Visibility; defaultWorkoutVisibility: Visibility;
};
export type Goal = { id: string; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number | null; waterMl: number | null; effectiveFrom: string };
export type Me = {
  id: string; email: string; username: string | null; role: string | null; onboarded: boolean; latestWeightKg: number | null;
  profile: { displayName: string; bio: string | null; isPrivate: boolean; followersCount: number; followingCount: number; workoutsCount: number };
  settings: Settings; goal: Goal | null;
};

export type Serving = { id: string; label: string; amount: number; isDefault: boolean };
export type Food = {
  id: string; name: string; brand: string | null; baseUnit: "g" | "ml"; isVerified: boolean;
  kcal100: number; protein100: number; carbs100: number; fat100: number;
  fiber100: number | null; sugar100: number | null; sodiumMg100: number | null; servings: Serving[];
};
export type Entry = {
  id: string; mealSlotId: string; foodId: string | null; servingId: string | null; servings: number; name: string; brand: string | null;
  kcal: number; proteinG: number; carbsG: number; fatG: number; source: string;
};
export type Totals = { kcal: number; proteinG: number; carbsG: number; fatG: number };
export type DayData = {
  date: string;
  meals: { slot: { id: string; name: string }; entries: Entry[]; totals: Totals }[];
  totals: Totals; goal: Goal | null;
  water: { totalMl: number; goalMl: number; logs: { id: string; amountMl: number }[] };
  exerciseKcal: number; workoutCount: number; notes: string | null;
};

export type Exercise = {
  id: string; name: string; exerciseType: ExerciseType; equipment: string; ownerId: string | null;
  primaryMuscles: string[]; secondaryMuscles: string[];
};
export type WorkoutSet = { id?: string; setType: SetType; weightKg: number | null; reps: number | null; durationS: number | null; distanceM: number | null };
export type WorkoutSummary = {
  id: string; title: string; startedAt: string; durationS: number; totalVolumeKg: number; totalSets: number; prCount: number;
  visibility: Visibility; exercises: { name: string; sets: number }[];
};
export type WorkoutDetail = Omit<WorkoutSummary, "exercises"> & {
  description: string | null; postId: string | null;
  author: { id: string; username: string | null; displayName: string };
  exercises: { id: string; exerciseId: string; name: string; type: ExerciseType; sets: WorkoutSet[]; records: { recordType: string; value: number }[] }[];
};
export type Routine = { id: string; name: string; exerciseNames: string[]; visibility: Visibility };
export type RoutineDetail = {
  id: string; name: string;
  exercises: { exerciseId: string; name: string; type: ExerciseType; restSeconds: number | null; sets: { setType: SetType; targetWeightKg: number | null; targetRepsMin: number | null; targetRepsMax: number | null; targetDurationS: number | null; targetDistanceM: number | null }[] }[];
};

export type Author = { id: string; username: string | null; displayName: string };
export type Post = {
  id: string; type: string; body: string | null; createdAt: string; likeCount: number; commentCount: number; likedByMe: boolean;
  author: Author;
  workout: null | { id: string; title: string; startedAt: string; durationS: number; totalVolumeKg: number; totalSets: number; prCount: number; exercises: { name: string; sets: number }[] };
  media: { id: string; url: string }[];
};
export type Comment = { id: string; parentId: string | null; body: string; createdAt: string; author: Author };
export type Notification = { id: string; type: string; postId: string | null; readAt: string | null; createdAt: string; actor: Author | null; data: Record<string, unknown> | null };
export type Page<T> = { data: T[]; nextCursor: string | null };
export type ProfileView = {
  id: string; username: string | null; displayName: string; bio: string | null; isPrivate: boolean;
  followers: number; following: number; workouts: number;
  relationship: { isSelf: boolean; following: boolean; requested: boolean }; canViewContent: boolean;
};
export type Measurement = { id: string; value: number; measuredAt: string };
