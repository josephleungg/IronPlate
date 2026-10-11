/**
 * Seeds foods, muscle groups and exercises. Idempotent. Runs against the local
 * SQLite file by default, or against D1 when D1_GATEWAY_URL/TOKEN are set.
 */
import { db } from "../src/db/driver";
import { exerciseMuscles, exercises, foodServings, foods, muscleGroups } from "../src/db/schema";
import { EXERCISES, FOODS, MUSCLES } from "../src/db/seed-data";
import { eq, isNull } from "drizzle-orm";
import { uuidv7 } from "../src/lib/id";

const CHUNK = 40; // statements per batch

async function batched(stmts: any[]) {
  for (let i = 0; i < stmts.length; i += CHUNK) {
    const part = stmts.slice(i, i + CHUNK);
    if (part.length) await db.batch(part as [any, ...any[]]);
  }
}

async function main() {
  // Muscle groups
  const existingMuscles = await db.select().from(muscleGroups);
  const muscleBySlug = new Map(existingMuscles.map((m) => [m.slug, m.id]));
  const newMuscles = MUSCLES.filter(([slug]) => !muscleBySlug.has(slug));
  await batched(
    newMuscles.map(([slug, name, region]) => {
      const id = uuidv7();
      muscleBySlug.set(slug, id);
      return db.insert(muscleGroups).values({ id, slug, name, region });
    }),
  );

  // Foods (seed rows are identified by source + sourceRef = slug of the name)
  const existingFoods = await db.select({ ref: foods.sourceRef }).from(foods).where(eq(foods.source, "seed"));
  const haveFood = new Set(existingFoods.map((f) => f.ref));
  const foodStmts: any[] = [];
  for (const [name, unit, kcal, p, c, f, fiber, sugar, sodium, servings] of FOODS) {
    const ref = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (haveFood.has(ref)) continue;
    const id = uuidv7();
    foodStmts.push(
      db.insert(foods).values({
        id, source: "seed", sourceRef: ref, name, baseUnit: unit, isVerified: true, visibility: "public",
        kcal100: kcal, protein100: p, carbs100: c, fat100: f, fiber100: fiber, sugar100: sugar, sodiumMg100: sodium,
      }),
    );
    // every food can also be logged by weight/volume directly
    const all: [string, number, boolean][] = [[`100 ${unit}`, 100, false], [`1 ${unit}`, 1, false]];
    const rows = [...servings.map(([l, a], i) => ({ label: l, amount: a, isDefault: i === 0 })), ...all.map(([l, a]) => ({ label: l, amount: a, isDefault: false }))];
    rows.forEach((s, i) =>
      foodStmts.push(db.insert(foodServings).values({ foodId: id, label: s.label, amount: s.amount, isDefault: s.isDefault, position: i })),
    );
  }
  await batched(foodStmts);

  // Exercises (global library: ownerId null, matched by slug)
  const existingEx = await db.select({ slug: exercises.slug }).from(exercises).where(isNull(exercises.ownerId));
  const haveEx = new Set(existingEx.map((e) => e.slug));
  const exStmts: any[] = [];
  for (const [name, type, equipment, primary, secondary, met] of EXERCISES) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    if (haveEx.has(slug)) continue;
    const id = uuidv7();
    exStmts.push(db.insert(exercises).values({ id, name, slug, exerciseType: type, equipment, met: met ?? null }));
    for (const [slugs, role] of [[primary, "primary"], [secondary, "secondary"]] as const)
      for (const m of slugs) exStmts.push(db.insert(exerciseMuscles).values({ exerciseId: id, muscleGroupId: muscleBySlug.get(m)!, role }));
  }
  await batched(exStmts);

  const [{ n: foodCount }] = (await db.select({ n: db.$count(foods) }).from(foods)) as any;
  console.log(`seed complete: +${newMuscles.length} muscles, +${foodStmts.filter(Boolean).length} food statements, +${exStmts.length} exercise statements (foods total: ${foodCount ?? "?"})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
