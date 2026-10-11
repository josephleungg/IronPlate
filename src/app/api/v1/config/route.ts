import { publicRoute } from "@/server/http";

/** Public client config: lets the sign-up form know whether an invite code is needed. */
export const GET = publicRoute({}, async () => ({ inviteRequired: Boolean(process.env.SIGNUP_CODE) }));
