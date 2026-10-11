import { route } from "@/server/http";
import { likePost, unlikePost } from "@/server/services/social";

export const POST = route({}, ({ viewer, params }) => likePost(viewer.id, params.id));
export const DELETE = route({}, ({ viewer, params }) => unlikePost(viewer.id, params.id));
