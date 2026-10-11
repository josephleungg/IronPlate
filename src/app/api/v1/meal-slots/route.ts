import { route } from "@/server/http";
import { listMealSlots } from "@/server/services/diary";

export const GET = route({}, async ({ viewer }) => ({ data: await listMealSlots(viewer.id) }));
