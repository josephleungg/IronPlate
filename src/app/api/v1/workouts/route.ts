import { z } from "zod";
import { created, route, zLimit } from "@/server/http";
import { listWorkouts, saveWorkout, workoutInput } from "@/server/services/training";

export const GET = route({ query: z.object({ cursor: z.string().optional(), limit: zLimit }) }, ({ viewer, query }) => listWorkouts(viewer.id, query));
export const POST = route({ body: workoutInput }, async ({ viewer, body }) => created(await saveWorkout(viewer.id, body)));
