import { route } from "@/server/http";
import { listMuscleGroups } from "@/server/services/training";

export const GET = route({}, async () => ({ data: await listMuscleGroups() }));
