import { describe, expect, it } from "vitest";
import { addDays, ageFromBirthDate, isValidDate, localDate, startOfWeek } from "../src/lib/domain/dates";
import { bmr, kcalFromMet, nutrientsForAmount, recommendGoals, sumNutrients, tdee } from "../src/lib/domain/nutrition";
import { bestCandidates, detectPRs, estimate1RM, setVolumeKg, workoutTotals } from "../src/lib/domain/training";
import { displayWeight, formatDuration, kgToLb, lbToKg } from "../src/lib/domain/units";
import { uuidv7 } from "../src/lib/id";

describe("units", () => {
  it("round-trips kg and lb", () => {
    expect(lbToKg(kgToLb(80))).toBeCloseTo(80, 6);
    expect(kgToLb(100)).toBeCloseTo(220.46, 2);
    expect(displayWeight(100, "lb")).toBe(220.5);
  });
  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(125)).toBe("2m 5s");
    expect(formatDuration(3720)).toBe("1h 2m");
  });
});

describe("dates", () => {
  it("validates real calendar dates only", () => {
    expect(isValidDate("2026-02-28")).toBe(true);
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-2-3")).toBe(false);
  });
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("computes the local date in a timezone", () => {
    const at = new Date("2026-10-11T02:30:00Z");
    expect(localDate("America/Los_Angeles", at)).toBe("2026-10-10");
    expect(localDate("Asia/Tokyo", at)).toBe("2026-10-11");
  });
  it("computes age and week start", () => {
    expect(ageFromBirthDate("1990-10-12", "2026-10-11")).toBe(35);
    expect(ageFromBirthDate("1990-10-11", "2026-10-11")).toBe(36);
    expect(startOfWeek("2026-10-11", 1)).toBe("2026-10-05"); // Sunday -> previous Monday
    expect(startOfWeek("2026-10-11", 0)).toBe("2026-10-11");
  });
});

describe("nutrition", () => {
  const p = { sex: "male" as const, weightKg: 80, heightCm: 180, age: 30 };
  it("matches the Mifflin-St Jeor formula", () => {
    expect(bmr(p)).toBe(10 * 80 + 6.25 * 180 - 5 * 30 + 5); // 1780
    expect(tdee({ ...p, activity: "moderate" })).toBeCloseTo(1780 * 1.55, 5);
  });
  it("applies a deficit and surplus", () => {
    const base = { ...p, activity: "moderate" as const };
    const maintain = recommendGoals({ ...base, goal: "maintain" });
    const lose = recommendGoals({ ...base, goal: "lose", weeklyRateKg: 0.5 });
    const gain = recommendGoals({ ...base, goal: "gain", weeklyRateKg: 0.25 });
    expect(maintain.calories - lose.calories).toBeGreaterThan(450);
    expect(maintain.calories - lose.calories).toBeLessThan(650);
    expect(gain.calories).toBeGreaterThan(maintain.calories);
  });
  it("never recommends below the calorie floor and says so", () => {
    const r = recommendGoals({ sex: "female", weightKg: 50, heightCm: 155, age: 40, activity: "sedentary", goal: "lose", weeklyRateKg: 1 });
    expect(r.calories).toBe(1200);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("macros roughly add back up to calories", () => {
    const r = recommendGoals({ ...p, activity: "active", goal: "maintain" });
    const back = r.proteinG * 4 + r.carbsG * 4 + r.fatG * 9;
    expect(Math.abs(back - r.calories)).toBeLessThan(15);
  });
  it("scales food nutrients by amount and sums them", () => {
    const chicken = { kcal100: 165, protein100: 31, carbs100: 0, fat100: 3.6, fiber100: 0, sugar100: null, sodiumMg100: 74 };
    const n = nutrientsForAmount(chicken, 172);
    expect(n.kcal).toBe(284);
    expect(n.proteinG).toBe(53.3);
    expect(n.sugarG).toBeNull();
    const total = sumNutrients([n, n]);
    expect(total.kcal).toBe(568);
  });
  it("estimates calories from MET", () => {
    expect(kcalFromMet(8, 70, 60)).toBe(588);
  });
});

describe("training", () => {
  it("estimates 1RM and ignores unreliable high-rep sets", () => {
    expect(estimate1RM(100, 1)).toBe(100);
    expect(estimate1RM(100, 5)).toBe(116.7);
    expect(estimate1RM(100, 20)).toBeNull();
    expect(estimate1RM(0, 5)).toBeNull();
  });
  it("excludes warmups from volume and totals", () => {
    const sets = [
      { setType: "warmup" as const, weightKg: 40, reps: 10 },
      { setType: "normal" as const, weightKg: 100, reps: 5 },
      { setType: "failure" as const, weightKg: 90, reps: 8 },
    ];
    expect(setVolumeKg("weight_reps", sets[0])).toBe(0);
    expect(workoutTotals([{ type: "weight_reps", sets }])).toEqual({ totalVolumeKg: 1220, totalSets: 2, totalReps: 13 });
  });
  it("gives bodyweight and assisted sets no volume", () => {
    expect(setVolumeKg("bodyweight_reps", { setType: "normal", reps: 10 })).toBe(0);
    expect(setVolumeKg("assisted_bodyweight", { setType: "normal", weightKg: 30, reps: 8 })).toBe(0);
  });
  it("finds the best candidate per record type", () => {
    const best = bestCandidates("weight_reps", [
      { setType: "normal", weightKg: 100, reps: 5 },
      { setType: "normal", weightKg: 110, reps: 2 },
    ]);
    expect(best.get("max_weight")).toBe(110);
    expect(best.get("max_set_volume")).toBe(500);
    expect(best.get("est_1rm")).toBe(117.3);
  });
  it("detects only strictly better records, and not on the very first workout", () => {
    const best = new Map([["max_weight" as const, 110], ["est_1rm" as const, 117.3]]);
    const existing = new Map([["max_weight" as const, 110], ["est_1rm" as const, 110]]);
    expect(detectPRs(best, existing, true)).toEqual([{ type: "est_1rm", value: 117.3 }]);
    expect(detectPRs(best, new Map(), false)).toEqual([]);
  });
});

describe("ids", () => {
  it("generates sortable, well-formed UUIDv7s", () => {
    const a = uuidv7();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const later = new Date(Date.now() + 5).getTime();
    while (Date.now() < later) {}
    expect(uuidv7() > a).toBe(true);
  });
});
