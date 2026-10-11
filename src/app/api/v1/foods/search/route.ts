import { z } from "zod";
import { route } from "@/server/http";
import { searchFoods } from "@/server/services/foods";

export const GET = route({ query: z.object({ q: z.string().max(100).default(""), limit: z.coerce.number().int().min(1).max(50).default(25) }) }, async ({ viewer, query }) => ({
  data: await searchFoods(viewer.id, query.q, query.limit),
}));
