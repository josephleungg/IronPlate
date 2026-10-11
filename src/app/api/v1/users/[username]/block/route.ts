import { route } from "@/server/http";
import { block, unblock, userIdByUsername } from "@/server/services/social";

export const POST = route({}, async ({ viewer, params }) => block(viewer.id, await userIdByUsername(params.username)));
export const DELETE = route({}, async ({ viewer, params }) => unblock(viewer.id, await userIdByUsername(params.username)));
