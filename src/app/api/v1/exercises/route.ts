import { z } from "zod";
import { created, route } from "@/server/http";
import { createExercise, exerciseInput, listExercises } from "@/server/services/training";

const query = z.object({ q: z.string().max(80).optional(), muscle: z.string().max(40).optional(), equipment: z.string().max(20).optional(), type: z.string().max(30).optional(), limit: z.coerce.number().int().min(1).max(200).optional() });
export const GET = route({ query }, async ({ viewer, query }) => ({ data: await listExercises(viewer.id, query) }));
export const POST = route({ body: exerciseInput }, async ({ viewer, body }) => created(await createExercise(viewer.id, body)));
