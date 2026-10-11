import { created, route, zDate } from "@/server/http";
import { quickAdd, quickAddInput } from "@/server/services/diary";

export const POST = route({ body: quickAddInput }, async ({ viewer, params, body }) => created(await quickAdd(viewer.id, zDate.parse(params.date), body)));
