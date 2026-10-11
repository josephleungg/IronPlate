import { route } from "@/server/http";
import { listFollowRequests } from "@/server/services/social";

export const GET = route({}, ({ viewer }) => listFollowRequests(viewer.id));
