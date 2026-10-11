import "server-only";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins/username";
import { admin } from "better-auth/plugins/admin";
import { db } from "@/db/driver";
import * as schema from "@/db/schema";
import { uuidv7 } from "@/lib/id";
import { createUserDefaults } from "@/server/services/defaults";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Friends-only app: no email provider wired up yet, so no verification step.
    requireEmailVerification: false,
  },
  session: {
    // Avoids a D1 round trip on most requests.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: { database: { generateId: () => uuidv7() } },
  hooks: {
    // Friends-only: when SIGNUP_CODE is set, sign-up requires it.
    before: createAuthMiddleware(async (ctx) => {
      const required = process.env.SIGNUP_CODE;
      if (required && ctx.path === "/sign-up/email") {
        const given = (ctx.body as { inviteCode?: string } | undefined)?.inviteCode;
        if (given !== required) throw new APIError("FORBIDDEN", { message: "That invite code isn't right" });
      }
    }),
  },
  databaseHooks: {
    user: { create: { after: async (user) => createUserDefaults(user) } },
  },
  plugins: [username(), admin(), nextCookies()], // nextCookies must be last
});

export type Session = typeof auth.$Infer.Session;
