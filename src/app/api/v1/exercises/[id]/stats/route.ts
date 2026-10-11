import { route } from "@/server/http";
import { exerciseStats, getExercise } from "@/server/services/training";

export const GET = route({}, async ({ viewer, params }) => {
  const exercise = await getExercise(viewer.id, params.id);
  return { exercise, ...(await exerciseStats(viewer.id, params.id)) };
});
