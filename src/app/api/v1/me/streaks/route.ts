import { route } from "@/server/http";
import { diaryStreak, getUserTimezone } from "@/server/services/diary";

export const GET = route({}, async ({ viewer }) => ({ diary: await diaryStreak(viewer.id, await getUserTimezone(viewer.id)) }));
