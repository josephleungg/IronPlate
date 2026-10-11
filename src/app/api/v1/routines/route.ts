import { created, route } from "@/server/http";
import { createRoutine, listRoutines, routineInput } from "@/server/services/training";

export const GET = route({}, ({ viewer }) => listRoutines(viewer.id));
export const POST = route({ body: routineInput }, async ({ viewer, body }) => created(await createRoutine(viewer.id, body)));
