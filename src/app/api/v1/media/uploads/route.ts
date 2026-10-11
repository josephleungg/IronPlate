import { created, route } from "@/server/http";
import { createUpload, uploadInput } from "@/server/services/media";

export const POST = route({ body: uploadInput }, async ({ viewer, body }) => created(await createUpload(viewer.id, body)));
