import { z } from "zod";
import { HttpError } from "../http";
import { searchFoods, type FoodDTO } from "./foods";

const TEXT_MODEL = process.env.AI_TEXT_MODEL ?? "@cf/meta/llama-3.1-8b-instruct";

/** Calls Workers AI through the gateway Worker (so no Cloudflare API token lives on Vercel). */
async function aiRun(input: unknown, model = TEXT_MODEL): Promise<unknown> {
  const url = process.env.D1_GATEWAY_URL;
  const token = process.env.D1_GATEWAY_TOKEN;
  if (!url || !token) throw new HttpError(503, "AI_NOT_CONFIGURED", "AI features need the Cloudflare gateway (D1_GATEWAY_URL/TOKEN)");
  const res = await fetch(`${url.replace(/\/$/, "")}/ai/run`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ model, input }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new HttpError(502, "AI_FAILED", "The AI service didn't respond");
  return ((await res.json()) as { result: unknown }).result;
}

const parsedItems = z.array(z.object({
  name: z.string().min(1).max(80),
  quantity: z.coerce.number().positive().max(5000).default(1),
  unit: z.string().max(20).default("serving"),
})).max(15);

export type FoodSuggestion = { text: string; quantity: number; unit: string; food: FoodDTO | null; servingId: string | null; servings: number };

/**
 * Natural-language logging: "2 eggs and a banana" -> matched foods with a quantity.
 * The result is only ever a suggestion; the user reviews it before anything is saved.
 */
export async function parseFoodText(viewerId: string, text: string): Promise<FoodSuggestion[]> {
  const out = (await aiRun({
    messages: [
      { role: "system", content: 'Extract the foods from the user\'s meal description. Reply with ONLY a JSON array of objects: {"name": string, "quantity": number, "unit": "g"|"ml"|"serving"|"piece"|"cup"|"tbsp"|"oz"}. Use generic food names without brands. No commentary.' },
      { role: "user", content: text },
    ],
    max_tokens: 400,
  })) as { response?: string };
  const raw = out?.response ?? "";
  const json = raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1);
  let items: z.infer<typeof parsedItems>;
  try {
    items = parsedItems.parse(JSON.parse(json));
  } catch {
    throw new HttpError(422, "AI_UNPARSEABLE", "Couldn't understand that description. Try listing foods separated by commas.");
  }
  return Promise.all(items.map(async (it) => {
    const [food] = await searchFoods(viewerId, it.name, 1);
    if (!food) return { text: it.name, quantity: it.quantity, unit: it.unit, food: null, servingId: null, servings: 1 };
    const unit = it.unit.toLowerCase();
    if (unit === "g" || unit === "ml") {
      const hundred = food.servings.find((s) => s.amount === 100) ?? food.servings[0];
      return { text: it.name, quantity: it.quantity, unit, food, servingId: hundred?.id ?? null, servings: it.quantity / (hundred?.amount ?? 100) };
    }
    const def = food.servings.find((s) => s.isDefault && s.amount !== 100 && s.amount !== 1) ?? food.servings.find((s) => s.amount !== 100 && s.amount !== 1) ?? food.servings[0];
    return { text: it.name, quantity: it.quantity, unit, food, servingId: def?.id ?? null, servings: it.quantity };
  }));
}
