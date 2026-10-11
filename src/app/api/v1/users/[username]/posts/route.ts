import { z } from "zod";
import { route, zLimit } from "@/server/http";
import { userIdByUsername, userPosts } from "@/server/services/social";

export const GET = route({ query: z.object({ cursor: z.string().optional(), limit: zLimit }) }, async ({ viewer, params, query }) =>
  userPosts(viewer.id, await userIdByUsername(params.username), query));
