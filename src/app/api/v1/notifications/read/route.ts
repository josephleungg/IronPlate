import { z } from "zod";
import { route } from "@/server/http";
import { markRead } from "@/server/services/social";

export const POST = route({ body: z.object({ ids: z.array(z.string()).max(100).optional(), all: z.boolean().optional() }) }, ({ viewer, body }) => markRead(viewer.id, body));
