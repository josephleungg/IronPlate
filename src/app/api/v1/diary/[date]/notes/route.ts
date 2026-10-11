import { z } from "zod";
import { route, zDate } from "@/server/http";
import { setNotes } from "@/server/services/diary";

export const PUT = route({ body: z.object({ notes: z.string().max(2000).nullable() }) }, ({ viewer, params, body }) => setNotes(viewer.id, zDate.parse(params.date), body.notes));
