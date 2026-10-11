import { z } from "zod";
import { route } from "@/server/http";
import { searchUsers } from "@/server/services/social";

export const GET = route({ query: z.object({ q: z.string().max(40).default("") }) }, async ({ viewer, query }) => ({ data: await searchUsers(viewer.id, query.q) }));
