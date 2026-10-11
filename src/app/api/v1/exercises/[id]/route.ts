import { route } from "@/server/http";
import { deleteExercise, getExercise } from "@/server/services/training";

export const GET = route({}, ({ viewer, params }) => getExercise(viewer.id, params.id));
export const DELETE = route({}, ({ viewer, params }) => deleteExercise(viewer.id, params.id));
