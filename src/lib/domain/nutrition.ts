export type Sex = "male" | "female" | "unspecified";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type GoalType = "lose" | "maintain" | "gain";

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Never recommend below these; below this level is not something an app should suggest on its own. */
export const CALORIE_FLOOR: Record<Sex, number> = { male: 1500, female: 1200, unspecified: 1300 };

const KCAL_PER_KG_FAT = 7700;

/** Mifflin-St Jeor basal metabolic rate (kcal/day). `unspecified` uses the midpoint of the two constants. */
export function bmr(p: { sex: Sex; weightKg: number; heightCm: number; age: number }): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  const k = p.sex === "male" ? 5 : p.sex === "female" ? -161 : -78;
  return base + k;
}

export function tdee(p: { sex: Sex; weightKg: number; heightCm: number; age: number; activity: ActivityLevel }): number {
  return bmr(p) * ACTIVITY_FACTORS[p.activity];
}

export type GoalRecommendation = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  tdee: number;
  warnings: string[];
};

/**
 * Daily calorie + macro targets for a goal. Weekly rate is kg/week (positive number;
 * direction comes from `goal`). Protein is set per kg of body weight, fat as a share
 * of calories, and carbs fill the rest.
 */
export function recommendGoals(p: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
  activity: ActivityLevel;
  goal: GoalType;
  weeklyRateKg?: number;
}): GoalRecommendation {
  const warnings: string[] = [];
  const maintenance = tdee(p);
  const rate = Math.abs(p.weeklyRateKg ?? 0.5);
  const dailyDelta = (rate * KCAL_PER_KG_FAT) / 7;

  let calories = p.goal === "lose" ? maintenance - dailyDelta : p.goal === "gain" ? maintenance + dailyDelta : maintenance;

  if (p.goal === "lose" && rate > 0.01 * p.weightKg) {
    warnings.push("This rate of loss is more than 1% of body weight per week, which is hard to sustain. Consider a slower rate.");
  }
  const floor = CALORIE_FLOOR[p.sex];
  if (calories < floor) {
    calories = floor;
    warnings.push(`Calories were raised to ${floor}, the minimum IronPlate will suggest. Talk to a professional before eating less.`);
  }

  calories = Math.round(calories / 10) * 10;
  const proteinG = Math.round(p.weightKg * (p.goal === "lose" ? 2.0 : 1.8));
  const fatG = Math.round((calories * 0.27) / 9);
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));

  return { calories, proteinG, carbsG, fatG, tdee: Math.round(maintenance), warnings };
}

export type Nutrients = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
};

type Per100 = {
  kcal100: number;
  protein100: number;
  carbs100: number;
  fat100: number;
  fiber100: number | null;
  sugar100: number | null;
  sodiumMg100: number | null;
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const scaleOpt = (v: number | null, f: number) => (v == null ? null : r1(v * f));

/** Nutrients for `amount` base units (g or ml) of a food. */
export function nutrientsForAmount(food: Per100, amount: number): Nutrients {
  const f = amount / 100;
  return {
    kcal: Math.round(food.kcal100 * f),
    proteinG: r1(food.protein100 * f),
    carbsG: r1(food.carbs100 * f),
    fatG: r1(food.fat100 * f),
    fiberG: scaleOpt(food.fiber100, f),
    sugarG: scaleOpt(food.sugar100, f),
    sodiumMg: food.sodiumMg100 == null ? null : Math.round(food.sodiumMg100 * f),
  };
}

export function sumNutrients(items: Pick<Nutrients, "kcal" | "proteinG" | "carbsG" | "fatG">[]) {
  return items.reduce(
    (a, i) => ({
      kcal: a.kcal + i.kcal,
      proteinG: r1(a.proteinG + i.proteinG),
      carbsG: r1(a.carbsG + i.carbsG),
      fatG: r1(a.fatG + i.fatG),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/** Energy burned by an activity: kcal = MET * 3.5 * kg / 200 * minutes. */
export function kcalFromMet(met: number, weightKg: number, minutes: number): number {
  return Math.round((met * 3.5 * weightKg * minutes) / 200);
}
