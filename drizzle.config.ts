import { defineConfig } from "drizzle-kit";

// Only used to *generate* SQL migrations into ./drizzle.
// They are applied with `wrangler d1 migrations apply` (remote) or scripts/migrate-local.ts (local).
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
});
