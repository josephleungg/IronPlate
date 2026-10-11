import { z } from "zod";
import { route, zLimit } from "@/server/http";
import { listNotifications } from "@/server/services/social";

export const GET = route({ query: z.object({ cursor: z.string().optional(), limit: zLimit }) }, ({ viewer, query }) => listNotifications(viewer.id, query));
