import { route } from "@/server/http";
import { deleteWater } from "@/server/services/diary";

export const DELETE = route({}, ({ viewer, params }) => deleteWater(viewer.id, params.id));
