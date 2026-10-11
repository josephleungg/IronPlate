import { z } from "zod";
import { route, zDate, zId } from "@/server/http";
import { copyEntries } from "@/server/services/diary";

const body = z.object({ fromDate: zDate, fromMealSlotId: zId.optional(), toMealSlotId: zId.optional() });
export const POST = route({ body }, ({ viewer, params, body }) => copyEntries(viewer.id, zDate.parse(params.date), body));
