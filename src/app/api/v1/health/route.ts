import { sql } from "drizzle-orm";
import { db } from "@/db/driver";
import { uploadsConfigured } from "@/server/services/media";

export async function GET() {
  const started = Date.now();
  try {
    await db.run(sql`select 1`);
    return Response.json({ ok: true, db: "up", dbMs: Date.now() - started, backend: process.env.D1_GATEWAY_URL ? "d1-gateway" : "local-sqlite", uploads: uploadsConfigured(), ai: Boolean(process.env.D1_GATEWAY_URL) });
  } catch (e) {
    return Response.json({ ok: false, db: "down", error: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }
}
