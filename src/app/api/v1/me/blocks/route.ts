import { route } from "@/server/http";
import { listBlocks } from "@/server/services/social";

export const GET = route({}, ({ viewer }) => listBlocks(viewer.id));
