import { route, zDate } from "@/server/http";
import { setCompleted } from "@/server/services/diary";

export const POST = route({}, ({ viewer, params }) => setCompleted(viewer.id, zDate.parse(params.date), true));
export const DELETE = route({}, ({ viewer, params }) => setCompleted(viewer.id, zDate.parse(params.date), false));
