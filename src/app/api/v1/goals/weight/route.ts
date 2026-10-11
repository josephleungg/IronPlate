import { route } from "@/server/http";
import { getWeightGoal, setWeightGoal, weightGoalInput } from "@/server/services/profile";

export const GET = route({}, ({ viewer }) => getWeightGoal(viewer.id));
export const PUT = route({ body: weightGoalInput }, ({ viewer, body }) => setWeightGoal(viewer.id, body));
