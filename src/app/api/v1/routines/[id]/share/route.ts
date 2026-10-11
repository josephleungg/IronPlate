import { route } from "@/server/http";
import { shareRoutine } from "@/server/services/training";

export const POST = route({}, ({ viewer, params }) => shareRoutine(viewer.id, params.id));
