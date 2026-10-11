import { route } from "@/server/http";
import { completeUpload } from "@/server/services/media";

export const POST = route({}, ({ viewer, params }) => completeUpload(viewer.id, params.id));
