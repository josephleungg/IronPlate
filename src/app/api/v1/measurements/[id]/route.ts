import { route } from "@/server/http";
import { deleteMeasurement } from "@/server/services/profile";

export const DELETE = route({}, ({ viewer, params }) => deleteMeasurement(viewer.id, params.id));
