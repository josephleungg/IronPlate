import { route } from "@/server/http";
import { removeFollower } from "@/server/services/social";

export const DELETE = route({}, ({ viewer, params }) => removeFollower(viewer.id, params.userId));
