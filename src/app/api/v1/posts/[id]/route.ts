import { route } from "@/server/http";
import { deletePost, getPost } from "@/server/services/social";

export const GET = route({}, ({ viewer, params }) => getPost(viewer.id, params.id));
export const DELETE = route({}, ({ viewer, params }) => deletePost(viewer.id, params.id));
