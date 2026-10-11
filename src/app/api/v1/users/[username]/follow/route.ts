import { route } from "@/server/http";
import { follow, unfollow, userIdByUsername } from "@/server/services/social";

export const POST = route({}, async ({ viewer, params }) => follow(viewer.id, await userIdByUsername(params.username)));
export const DELETE = route({}, async ({ viewer, params }) => unfollow(viewer.id, await userIdByUsername(params.username)));
