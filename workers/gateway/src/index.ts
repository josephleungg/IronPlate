/**
 * IronPlate gateway: the only thing on Cloudflare that the Vercel app talks to.
 *
 *   POST /d1/query   { sql, params, method }            -> { rows }
 *   POST /d1/batch   { queries: [{sql, params, method}] } -> [{ rows }]   (atomic)
 *   POST /ai/run     { model, input }                    -> { result }
 *   GET  /health
 *
 * Why a Worker instead of D1's REST API: the REST API is subject to Cloudflare's global API rate
 * limit and is meant for admin use. A Worker binding has neither problem and gives real batches.
 * Speaks the drizzle `sqlite-proxy` protocol: rows are arrays of values, not objects.
 *
 * Secured by a shared bearer token (GATEWAY_TOKEN secret). Anyone with the token can run arbitrary
 * SQL, so treat it like a database password and only ever set it on the server (Vercel env vars).
 */

interface Env {
  DB: D1Database;
  AI: Ai;
  GATEWAY_TOKEN: string;
}

type Method = "run" | "all" | "get" | "values";
type Query = { sql: string; params?: unknown[]; method: Method };

const MAX_BATCH = 100;
const MAX_BODY_BYTES = 2_000_000;
const ALLOWED_MODELS = /^@cf\/[a-z0-9._-]+\/[a-z0-9._-]+$/i;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

async function authorized(req: Request, env: Env): Promise<boolean> {
  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!env.GATEWAY_TOKEN || !given) return false;
  // Hash both sides so lengths match, then compare in constant time.
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(given)),
    crypto.subtle.digest("SHA-256", enc.encode(env.GATEWAY_TOKEN)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

function validQuery(q: unknown): q is Query {
  const x = q as Query;
  return (
    typeof x?.sql === "string" &&
    x.sql.length > 0 &&
    x.sql.length <= 100_000 &&
    ["run", "all", "get", "values"].includes(x.method) &&
    (x.params === undefined || Array.isArray(x.params))
  );
}

const bind = (env: Env, q: Query) => env.DB.prepare(q.sql).bind(...(q.params ?? []));

async function runOne(env: Env, q: Query) {
  const stmt = bind(env, q);
  if (q.method === "run") {
    await stmt.run();
    return { rows: [] };
  }
  const rows = await stmt.raw<unknown[]>();
  return { rows: q.method === "get" ? (rows[0] ?? undefined) : rows };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/health") return json({ ok: true });
    if (req.method !== "POST") return json({ error: "Not found" }, 404);
    if (!(await authorized(req, env))) return json({ error: "Unauthorized" }, 401);

    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > MAX_BODY_BYTES) return json({ error: "Body too large" }, 413);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    try {
      if (url.pathname === "/d1/query") {
        if (!validQuery(body)) return json({ error: "Invalid query" }, 400);
        return json(await runOne(env, body));
      }

      if (url.pathname === "/d1/batch") {
        const queries: unknown = body?.queries;
        if (!Array.isArray(queries) || queries.length === 0 || queries.length > MAX_BATCH || !queries.every(validQuery)) {
          return json({ error: `A batch needs 1 to ${MAX_BATCH} valid queries` }, 400);
        }
        // env.DB.batch() runs all statements in a single implicit transaction. It returns row *objects*,
        // so convert to arrays by column order. Don't join tables that share column names inside a batch
        // (the app only batches writes).
        const results = await env.DB.batch(queries.map((q) => bind(env, q)));
        return json(
          results.map((r, i) => ({
            rows: queries[i].method === "run" ? [] : (r.results as Record<string, unknown>[]).map((row) => Object.values(row)),
          })),
        );
      }

      if (url.pathname === "/ai/run") {
        if (typeof body?.model !== "string" || !ALLOWED_MODELS.test(body.model)) return json({ error: "Invalid model" }, 400);
        const result = await env.AI.run(body.model as keyof AiModels, body.input);
        return json({ result });
      }
    } catch (e) {
      // SQL errors are useful to the app; they never include data.
      return json({ error: e instanceof Error ? e.message : "Query failed" }, 500);
    }
    return json({ error: "Not found" }, 404);
  },
} satisfies ExportedHandler<Env>;
