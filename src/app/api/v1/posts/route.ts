import { created, route } from "@/server/http";
import { createPost, postInput } from "@/server/services/social";

export const POST = route({ body: postInput }, async ({ viewer, body }) => created(await createPost(viewer.id, body)));
