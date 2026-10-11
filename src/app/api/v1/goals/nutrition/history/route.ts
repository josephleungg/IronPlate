import { route } from "@/server/http";
import { goalHistory } from "@/server/services/profile";

export const GET = route({}, ({ viewer }) => goalHistory(viewer.id));
