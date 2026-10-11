import { route } from "@/server/http";
import { listFollowing, userIdByUsername } from "@/server/services/social";

export const GET = route({}, async ({ viewer, params }) => ({ data: await listFollowing(viewer.id, await userIdByUsername(params.username), "followers") }));
