import { created, route } from "@/server/http";
import { copyRoutine } from "@/server/services/training";

export const POST = route({}, async ({ viewer, params }) => created(await copyRoutine(viewer.id, params.id)));
