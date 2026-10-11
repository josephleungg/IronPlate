import { route } from "@/server/http";
import { myFoods } from "@/server/services/foods";

export const GET = route({}, async ({ viewer }) => ({ data: await myFoods(viewer.id) }));
