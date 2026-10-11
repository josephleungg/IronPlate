import { z } from "zod";
import { created, route, zDate } from "@/server/http";
import { addWater } from "@/server/services/diary";

export const POST = route({ body: z.object({ amountMl: z.number().int().min(1).max(5000) }) }, async ({ viewer, params, body }) => created(await addWater(viewer.id, zDate.parse(params.date), body.amountMl)));
