import { route, zDate } from "@/server/http";
import { getDay } from "@/server/services/diary";

export const GET = route({}, ({ viewer, params }) => getDay(viewer.id, zDate.parse(params.date)));
