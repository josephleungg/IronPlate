/** Applies ./drizzle/*.sql to the local SQLite file. Remote D1 uses `wrangler d1 migrations apply`. */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const file = process.env.LOCAL_DB_PATH ?? ".data/ironplate.db";
mkdirSync(dirname(file), { recursive: true });
const d = new DatabaseSync(file);
d.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
d.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");
const applied = new Set((d.prepare("SELECT name FROM _migrations").all() as { name: string }[]).map((r) => r.name));

const dir = "drizzle";
for (const name of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (applied.has(name)) continue;
  const sql = readFileSync(join(dir, name), "utf8");
  d.exec("BEGIN");
  try {
    for (const stmt of sql.split("--> statement-breakpoint")) if (stmt.trim()) d.exec(stmt);
    d.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(name, Date.now());
    d.exec("COMMIT");
    console.log(`applied ${name}`);
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}
console.log(`database ready: ${file}`);
