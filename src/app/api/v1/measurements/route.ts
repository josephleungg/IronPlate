import { z } from "zod";
import { MEASUREMENT_TYPES } from "@/db/schema";
import { created, route, zDate } from "@/server/http";
import { addMeasurement, listMeasurements, measurementInput } from "@/server/services/profile";

export const GET = route({ query: z.object({ type: z.enum(MEASUREMENT_TYPES).default("weight"), from: zDate.optional(), to: zDate.optional() }) }, async ({ viewer, query }) => ({
  data: await listMeasurements(viewer.id, query.type, query.from, query.to),
}));
export const POST = route({ body: measurementInput }, async ({ viewer, body }) => created(await addMeasurement(viewer.id, body)));
