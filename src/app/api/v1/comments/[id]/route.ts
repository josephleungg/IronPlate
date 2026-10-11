import { route } from "@/server/http";
import { deleteComment } from "@/server/services/social";

export const DELETE = route({}, ({ viewer, params }) => deleteComment(viewer.id, params.id));
