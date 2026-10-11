import { route } from "@/server/http";
import { recentFoods } from "@/server/services/foods";

export const GET = route({}, async ({ viewer }) => ({ data: await recentFoods(viewer.id) }));
