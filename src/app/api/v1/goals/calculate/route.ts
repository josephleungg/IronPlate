import { route } from "@/server/http";
import { calculateGoals, calculateInput } from "@/server/services/profile";

export const POST = route({ body: calculateInput }, async ({ body }) => calculateGoals(body));
