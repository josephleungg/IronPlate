import { route } from "@/server/http";
import { patchSettings, settingsPatch } from "@/server/services/profile";
import { getMe } from "@/server/services/profile";

export const GET = route({}, async ({ viewer }) => (await getMe(viewer)).settings);
export const PATCH = route({ body: settingsPatch }, ({ viewer, body }) => patchSettings(viewer.id, body));
