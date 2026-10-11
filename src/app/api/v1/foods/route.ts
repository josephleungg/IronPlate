import { created, route } from "@/server/http";
import { createFood, foodInput } from "@/server/services/foods";

export const POST = route({ body: foodInput }, async ({ viewer, body }) => created(await createFood(viewer.id, body)));
