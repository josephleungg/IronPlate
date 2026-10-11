import { route } from "@/server/http";
import { deleteFood, foodInput, getFood, updateFood } from "@/server/services/foods";

export const GET = route({}, ({ viewer, params }) => getFood(viewer.id, params.id));
export const PATCH = route({ body: foodInput.partial() }, ({ viewer, params, body }) => updateFood(viewer.id, params.id, body));
export const DELETE = route({}, ({ viewer, params }) => deleteFood(viewer.id, params.id));
