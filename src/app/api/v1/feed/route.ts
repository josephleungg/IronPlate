import { z } from "zod";
import { route, zLimit } from "@/server/http";
import { homeFeed } from "@/server/services/social";

export const GET = route({ query: z.object({ cursor: z.string().optional(), limit: zLimit }) }, ({ viewer, query }) => homeFeed(viewer.id, query));
