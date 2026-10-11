import { route } from "@/server/http";
import { deleteEntry, entryPatch, updateEntry } from "@/server/services/diary";

export const PATCH = route({ body: entryPatch }, ({ viewer, params, body }) => updateEntry(viewer.id, params.id, body));
export const DELETE = route({}, ({ viewer, params }) => deleteEntry(viewer.id, params.id));
