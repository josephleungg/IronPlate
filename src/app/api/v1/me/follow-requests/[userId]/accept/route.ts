import { route } from "@/server/http";
import { answerFollowRequest } from "@/server/services/social";

export const POST = route({}, ({ viewer, params }) => answerFollowRequest(viewer.id, params.userId, true));
