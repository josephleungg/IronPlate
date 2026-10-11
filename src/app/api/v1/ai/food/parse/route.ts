import { z } from "zod";
import { route } from "@/server/http";
import { parseFoodText } from "@/server/services/ai";

export const POST = route({ body: z.object({ text: z.string().trim().min(2).max(400) }) }, async ({ viewer, body }) => ({ data: await parseFoodText(viewer.id, body.text) }));
