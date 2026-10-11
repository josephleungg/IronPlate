import { route } from "@/server/http";
import { lookupBarcode } from "@/server/services/foods";

export const GET = route({}, ({ viewer, params }) => lookupBarcode(viewer.id, params.gtin));
