import { route } from "@/server/http";
import { getProfile } from "@/server/services/social";

export const GET = route({}, ({ viewer, params }) => getProfile(viewer.id, params.username));
