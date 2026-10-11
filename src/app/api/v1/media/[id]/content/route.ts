import { route } from "@/server/http";
import { signedViewUrl } from "@/server/services/media";

export const GET = route({}, async ({ viewer, params }) => {
  const url = await signedViewUrl(viewer.id, params.id);
  return new Response(null, { status: 302, headers: { location: url, "cache-control": "private, max-age=240" } });
});
