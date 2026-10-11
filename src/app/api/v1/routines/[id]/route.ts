import { z } from "zod";
import { VISIBILITY } from "@/db/schema";
import { route, zId } from "@/server/http";
import { deleteRoutine, getRoutine, patchRoutine, replaceRoutine, routineInput } from "@/server/services/training";

export const GET = route({}, ({ viewer, params }) => getRoutine(viewer.id, params.id));
export const PUT = route({ body: routineInput }, ({ viewer, params, body }) => replaceRoutine(viewer.id, params.id, body));
export const PATCH = route({ body: z.object({ name: z.string().trim().min(1).max(80).optional(), notes: z.string().max(1000).nullable().optional(), folderId: zId.nullable().optional(), visibility: z.enum(VISIBILITY).optional() }) }, ({ viewer, params, body }) => patchRoutine(viewer.id, params.id, body));
export const DELETE = route({}, ({ viewer, params }) => deleteRoutine(viewer.id, params.id));
