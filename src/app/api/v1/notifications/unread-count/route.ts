import { route } from "@/server/http";
import { unreadCount } from "@/server/services/social";

export const GET = route({}, ({ viewer }) => unreadCount(viewer.id));
