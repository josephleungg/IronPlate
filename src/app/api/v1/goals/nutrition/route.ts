import { z } from "zod";
import { route, zDate } from "@/server/http";
import { getUserTimezone, goalForDate } from "@/server/services/diary";
import { goalInput, setNutritionGoal } from "@/server/services/profile";
import { localDate } from "@/lib/domain/dates";

export const GET = route({ query: z.object({ date: zDate.optional() }) }, async ({ viewer, query }) =>
  goalForDate(viewer.id, query.date ?? localDate(await getUserTimezone(viewer.id))));
export const PUT = route({ body: goalInput }, ({ viewer, body }) => setNutritionGoal(viewer.id, body));
