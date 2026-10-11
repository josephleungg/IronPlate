import { route } from "@/server/http";
import { deleteWorkout, getWorkout, saveWorkout, workoutInput } from "@/server/services/training";

export const GET = route({}, ({ viewer, params }) => getWorkout(viewer.id, params.id));
export const PUT = route({ body: workoutInput }, ({ viewer, params, body }) => saveWorkout(viewer.id, body, params.id));
export const DELETE = route({}, ({ viewer, params }) => deleteWorkout(viewer.id, params.id));
