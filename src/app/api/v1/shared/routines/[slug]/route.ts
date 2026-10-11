import { publicRoute } from "@/server/http";
import { getRoutineBySlug } from "@/server/services/training";

export const GET = publicRoute({}, ({ params }) => getRoutineBySlug(params.slug));
