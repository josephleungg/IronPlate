import { z } from "zod";
import { route, zDate } from "@/server/http";
import { getRange } from "@/server/services/diary";

export const GET = route({ query: z.object({ from: zDate, to: zDate }) }, async ({ viewer, query }) => ({ data: await getRange(viewer.id, query.from, query.to) }));
