import { route } from "@/server/http";
import { getMe, patchProfile, profilePatch } from "@/server/services/profile";

export const GET = route({}, ({ viewer }) => getMe(viewer));
export const PATCH = route({ body: profilePatch }, ({ viewer, body }) => patchProfile(viewer.id, body));
