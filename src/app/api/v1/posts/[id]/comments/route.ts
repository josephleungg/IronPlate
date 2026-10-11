import { created, route } from "@/server/http";
import { addComment, commentInput, listComments } from "@/server/services/social";

export const GET = route({}, async ({ viewer, params }) => ({ data: await listComments(viewer.id, params.id) }));
export const POST = route({ body: commentInput }, async ({ viewer, params, body }) => created(await addComment(viewer.id, params.id, body)));
