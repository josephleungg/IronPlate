import { z } from "zod";
import { route, zDate } from "@/server/http";
import { getMe } from "@/server/services/profile";
import { trainingReport } from "@/server/services/reports";

export const GET = route({ query: z.object({ from: zDate, to: zDate }) }, async ({ viewer, query }) => {
  const me = await getMe(viewer);
  return trainingReport(viewer.id, query.from, query.to, (me.settings?.weekStart ?? 1) as 0 | 1, me.settings?.timezone ?? "UTC");
});
