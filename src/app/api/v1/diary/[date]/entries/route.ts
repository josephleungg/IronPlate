import { created, route, zDate } from "@/server/http";
import { addEntry, entryInput } from "@/server/services/diary";

export const POST = route({ body: entryInput }, async ({ viewer, params, body }) => created(await addEntry(viewer.id, zDate.parse(params.date), body)));
