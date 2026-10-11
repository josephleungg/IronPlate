import { z } from "zod";
import { route } from "@/server/http";
import { previousSets } from "@/server/services/training";

export const GET = route({ query: z.object({ ids: z.string().max(2000) }) }, async ({ viewer, query }) => ({
  data: await previousSets(viewer.id, query.ids.split(",").filter(Boolean)),
}));
