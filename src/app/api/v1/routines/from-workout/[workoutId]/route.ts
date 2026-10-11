import { z } from "zod";
import { created, route } from "@/server/http";
import { routineFromWorkout } from "@/server/services/training";

export const POST = route({ body: z.object({ name: z.string().max(80).optional() }).default({}) }, async ({ viewer, params, body }) => created(await routineFromWorkout(viewer.id, params.workoutId, body.name)));
