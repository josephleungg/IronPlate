import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/driver";
import { diaryEntries, foodBarcodes, foodServings, foods } from "@/db/schema";
import { badRequest, forbidden, notFound } from "../http";

type FoodRow = typeof foods.$inferSelect;
type ServingRow = typeof foodServings.$inferSelect;
export type FoodDTO = FoodRow & { servings: ServingRow[] };

export const foodInput = z.object({
  name: z.string().trim().min(1).max(120),
  brand: z.string().trim().max(80).optional(),
  baseUnit: z.enum(["g", "ml"]).default("g"),
  kcal100: z.number().min(0).max(1000),
  protein100: z.number().min(0).max(100).default(0),
  carbs100: z.number().min(0).max(100).default(0),
  fat100: z.number().min(0).max(100).default(0),
  fiber100: z.number().min(0).max(100).optional(),
  sugar100: z.number().min(0).max(100).optional(),
  sodiumMg100: z.number().min(0).max(40000).optional(),
  servings: z.array(z.object({ label: z.string().trim().min(1).max(40), amount: z.number().positive().max(5000) })).max(10).default([]),
  barcode: z.string().optional(),
});
export type FoodInput = z.infer<typeof foodInput>;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

async function withServings(rows: FoodRow[]): Promise<FoodDTO[]> {
  if (!rows.length) return [];
  const servings = await db
    .select()
    .from(foodServings)
    .where(inArray(foodServings.foodId, rows.map((r) => r.id)))
    .orderBy(foodServings.position);
  const by = new Map<string, ServingRow[]>();
  for (const s of servings) by.set(s.foodId, [...(by.get(s.foodId) ?? []), s]);
  return rows.map((r) => ({ ...r, servings: by.get(r.id) ?? [] }));
}

export async function searchFoods(viewerId: string, q: string, limit = 25): Promise<FoodDTO[]> {
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  if (!tokens.length) return [];
  const match = tokens.map((t) => {
    const pat = `%${escapeLike(t)}%`;
    return or(sql`${foods.name} like ${pat} escape '\\'`, sql`${foods.brand} like ${pat} escape '\\'`)!;
  });
  const prefix = `${escapeLike(tokens[0])}%`;
  const rows = await db
    .select()
    .from(foods)
    .where(and(isNull(foods.deletedAt), or(eq(foods.visibility, "public"), eq(foods.ownerId, viewerId)), ...match))
    .orderBy(
      sql`case when lower(${foods.name}) like ${prefix} escape '\\' then 0 else 1 end`,
      sql`case when ${foods.ownerId} = ${viewerId} then 0 else 1 end`,
      desc(foods.isVerified),
      desc(foods.popularity),
      sql`length(${foods.name})`,
    )
    .limit(limit);
  return withServings(rows);
}

export async function getFood(viewerId: string, id: string): Promise<FoodDTO> {
  const [row] = await db.select().from(foods).where(and(eq(foods.id, id), isNull(foods.deletedAt)));
  if (!row) throw notFound("Food");
  if (row.visibility === "private" && row.ownerId !== viewerId) throw notFound("Food");
  return (await withServings([row]))[0];
}

function servingRows(foodId: string, unit: "g" | "ml", extra: { label: string; amount: number }[]) {
  const all = [...extra, { label: `100 ${unit}`, amount: 100 }, { label: `1 ${unit}`, amount: 1 }];
  return all.map((s, i) => ({ foodId, label: s.label, amount: s.amount, isDefault: i === 0, position: i }));
}

export function normalizeGtin(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 14) throw badRequest("A barcode has 8 to 14 digits", "INVALID_BARCODE");
  return digits.length === 12 ? `0${digits}` : digits;
}

export async function createFood(viewerId: string, input: FoodInput, opts?: { source?: "user" | "off"; sourceRef?: string }): Promise<FoodDTO> {
  const id = crypto.randomUUID();
  const barcode = input.barcode ? normalizeGtin(input.barcode) : undefined;
  const stmts = [
    db.insert(foods).values({
      id,
      source: opts?.source ?? "user",
      sourceRef: opts?.sourceRef ?? null,
      ownerId: opts?.source === "off" ? null : viewerId,
      visibility: opts?.source === "off" ? "public" : "private",
      name: input.name,
      brand: input.brand ?? null,
      baseUnit: input.baseUnit,
      kcal100: input.kcal100,
      protein100: input.protein100,
      carbs100: input.carbs100,
      fat100: input.fat100,
      fiber100: input.fiber100 ?? null,
      sugar100: input.sugar100 ?? null,
      sodiumMg100: input.sodiumMg100 ?? null,
    }),
    db.insert(foodServings).values(servingRows(id, input.baseUnit, input.servings)),
    ...(barcode ? [db.insert(foodBarcodes).values({ foodId: id, barcode }).onConflictDoNothing()] : []),
  ] as const;
  await db.batch(stmts as unknown as [any, ...any[]]);
  return getFood(viewerId, id);
}

export async function updateFood(viewerId: string, id: string, patch: Partial<FoodInput>) {
  const [row] = await db.select().from(foods).where(and(eq(foods.id, id), isNull(foods.deletedAt)));
  if (!row) throw notFound("Food");
  if (row.ownerId !== viewerId) throw forbidden("You can only edit foods you created");
  const { servings, barcode: _b, ...fields } = patch;
  const stmts: any[] = [db.update(foods).set(fields).where(eq(foods.id, id))];
  if (servings) {
    stmts.push(db.delete(foodServings).where(eq(foodServings.foodId, id)));
    stmts.push(db.insert(foodServings).values(servingRows(id, patch.baseUnit ?? row.baseUnit, servings)));
  }
  await db.batch(stmts as [any, ...any[]]);
  return getFood(viewerId, id);
}

export async function deleteFood(viewerId: string, id: string) {
  const [row] = await db.select({ ownerId: foods.ownerId }).from(foods).where(eq(foods.id, id));
  if (!row) throw notFound("Food");
  if (row.ownerId !== viewerId) throw forbidden("You can only delete foods you created");
  // Soft delete: past diary entries keep their nutrient snapshot and stay intact.
  await db.update(foods).set({ deletedAt: new Date() }).where(eq(foods.id, id));
}

export async function myFoods(viewerId: string): Promise<FoodDTO[]> {
  const rows = await db.select().from(foods).where(and(eq(foods.ownerId, viewerId), isNull(foods.deletedAt))).orderBy(desc(foods.createdAt)).limit(100);
  return withServings(rows);
}

export async function recentFoods(viewerId: string, limit = 20): Promise<FoodDTO[]> {
  const recent = await db
    .select({ foodId: diaryEntries.foodId, last: sql<number>`max(${diaryEntries.loggedAt})` })
    .from(diaryEntries)
    .where(and(eq(diaryEntries.userId, viewerId), isNull(diaryEntries.deletedAt), sql`${diaryEntries.foodId} is not null`))
    .groupBy(diaryEntries.foodId)
    .orderBy(desc(sql`max(${diaryEntries.loggedAt})`))
    .limit(limit);
  const ids = recent.map((r) => r.foodId!).filter(Boolean);
  if (!ids.length) return [];
  const rows = await db.select().from(foods).where(and(inArray(foods.id, ids), isNull(foods.deletedAt)));
  const order = new Map(ids.map((id, i) => [id, i]));
  return withServings(rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!));
}

type OffProduct = {
  product_name?: string;
  brands?: string;
  serving_quantity?: number | string;
  serving_size?: string;
  nutriments?: Record<string, number | string | undefined>;
};

async function fetchOpenFoodFacts(gtin: string): Promise<OffProduct | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${gtin}.json?fields=product_name,brands,serving_quantity,serving_size,nutriments`,
      { headers: { "user-agent": "IronPlate/0.1 (personal project)" }, signal: AbortSignal.timeout(6000), cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { status?: number; product?: OffProduct };
    return json.status === 1 && json.product ? json.product : null;
  } catch {
    return null;
  }
}

const num = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? Number(v) : (v as number | undefined);
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : undefined;
};

/** Barcode lookup: local database first, then Open Food Facts (cached into the database on a hit). */
export async function lookupBarcode(viewerId: string, rawGtin: string): Promise<FoodDTO> {
  const gtin = normalizeGtin(rawGtin);
  const [hit] = await db
    .select({ foodId: foodBarcodes.foodId })
    .from(foodBarcodes)
    .innerJoin(foods, eq(foods.id, foodBarcodes.foodId))
    .where(and(eq(foodBarcodes.barcode, gtin), isNull(foods.deletedAt)));
  if (hit) return getFood(viewerId, hit.foodId);

  const p = await fetchOpenFoodFacts(gtin);
  const n = p?.nutriments ?? {};
  const kcal = num(n["energy-kcal_100g"]) ?? (num(n["energy_100g"]) !== undefined ? Math.round(num(n["energy_100g"])! / 4.184) : undefined);
  if (!p || !p.product_name || kcal === undefined) throw notFound("Product for that barcode");

  const serving = num(p.serving_quantity);
  const sodiumG = num(n["sodium_100g"]);
  return createFood(
    viewerId,
    {
      name: p.product_name.trim().slice(0, 120),
      brand: p.brands?.split(",")[0]?.trim().slice(0, 80) || undefined,
      baseUnit: "g",
      kcal100: kcal,
      protein100: num(n["proteins_100g"]) ?? 0,
      carbs100: num(n["carbohydrates_100g"]) ?? 0,
      fat100: num(n["fat_100g"]) ?? 0,
      fiber100: num(n["fiber_100g"]),
      sugar100: num(n["sugars_100g"]),
      sodiumMg100: sodiumG !== undefined ? Math.round(sodiumG * 1000) : undefined,
      servings: serving ? [{ label: p.serving_size?.slice(0, 40) || `1 serving (${serving} g)`, amount: serving }] : [],
      barcode: gtin,
    },
    { source: "off", sourceRef: gtin },
  );
}
