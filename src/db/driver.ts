import { drizzle, type SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

/**
 * One Drizzle instance, two backends, same SQLite dialect:
 *
 *  - Production (Vercel): HTTP calls to the IronPlate gateway Worker, which runs
 *    the SQL against the Cloudflare D1 binding. See workers/gateway.
 *  - Local dev / tests: a SQLite file via Node's built-in `node:sqlite`.
 *
 * Both speak the sqlite-proxy protocol, so the rest of the app never knows which.
 * NOTE: `db.transaction()` does not work over the gateway (stateless HTTP).
 * Use `db.batch([...])` for atomic multi-statement writes.
 */

type Method = "run" | "all" | "get" | "values";
type Query = { sql: string; params: unknown[]; method: Method };
type Rows = { rows: any[] };

export type Db = SqliteRemoteDatabase<typeof schema>;

function gatewayBackend(url: string, token: string) {
  async function post(path: string, body: unknown) {
    const res = await fetch(`${url.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`D1 gateway ${path} failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    }
    return res.json();
  }
  return {
    one: (q: Query): Promise<Rows> => post("/d1/query", q),
    many: (qs: Query[]): Promise<Rows[]> => post("/d1/batch", { queries: qs }),
  };
}

function localBackend(file: string) {
  let dbPromise: Promise<import("node:sqlite").DatabaseSync> | undefined;
  const open = () =>
    (dbPromise ??= (async () => {
      const { DatabaseSync } = await import("node:sqlite");
      const { mkdirSync } = await import("node:fs");
      const { dirname } = await import("node:path");
      if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
      const d = new DatabaseSync(file);
      d.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
      return d;
    })());

  // node:sqlite is synchronous. Running a whole batch with no `await` between statements means no
  // other request can interleave a statement into an open transaction on this single connection.
  function execSync(d: import("node:sqlite").DatabaseSync, q: Query): Rows {
    const stmt = d.prepare(q.sql);
    const params = q.params as any[];
    if (q.method === "run") {
      stmt.run(...params);
      return { rows: [] };
    }
    stmt.setReturnArrays(true);
    if (q.method === "get") return { rows: stmt.get(...params) as any };
    return { rows: stmt.all(...params) as any[] };
  }

  return {
    async one(q: Query): Promise<Rows> {
      return execSync(await open(), q);
    },
    async many(qs: Query[]): Promise<Rows[]> {
      const d = await open();
      d.exec("BEGIN");
      try {
        const out = qs.map((q) => {
          const r = execSync(d, q);
          // batch results are always arrays of rows, even for `get`
          return { rows: q.method === "get" ? (r.rows ? [r.rows] : []) : r.rows };
        });
        d.exec("COMMIT");
        return out;
      } catch (e) {
        d.exec("ROLLBACK");
        throw e;
      }
    },
  };
}

function createDb(): Db {
  const url = process.env.D1_GATEWAY_URL;
  const token = process.env.D1_GATEWAY_TOKEN;
  const backend =
    url && token
      ? gatewayBackend(url, token)
      : localBackend(process.env.LOCAL_DB_PATH ?? ".data/ironplate.db");

  return drizzle(
    async (sql, params, method) => {
      const r = await backend.one({ sql, params, method });
      return { rows: r.rows as any };
    },
    async (queries) => backend.many(queries as Query[]),
    { schema },
  );
}

// Reuse across hot reloads in dev and across invocations in a warm lambda.
const g = globalThis as unknown as { __ironplateDb?: Db };
export const db: Db = (g.__ironplateDb ??= createDb());
